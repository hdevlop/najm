import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  createUiBootstrapLoader,
  type UiBootstrapDiagnostic,
} from "../src/server";

/** Stand-in for an application's appearance payload. */
interface Appearance {
  designConfig: { version: number };
  revision: number;
}

/** Stand-in for an application's branding payload. */
interface Branding {
  sidebarLogoExpandedPath: string;
  revision: number;
}

const FACTORY_APPEARANCE: Appearance = { designConfig: { version: 1 }, revision: 0 };
const FACTORY_BRANDING: Branding = { sidebarLogoExpandedPath: "/factory.svg", revision: 0 };

const savedAppearance: Appearance = { designConfig: { version: 2 }, revision: 7 };
const savedBranding: Branding = { sidebarLogoExpandedPath: "/uploaded.png", revision: 3 };

const isPositiveRevision = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

function parseAppearance(input: unknown): Appearance | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  if (!isPositiveRevision(value.revision)) return undefined;
  if (!value.designConfig || typeof value.designConfig !== "object") return undefined;
  return { designConfig: value.designConfig as Appearance["designConfig"], revision: value.revision };
}

/** The other supported shape: a parser that throws instead of returning undefined. */
function parseBranding(input: unknown): Branding {
  if (!input || typeof input !== "object") throw new TypeError("branding must be an object");
  const value = input as Record<string, unknown>;
  if (!isPositiveRevision(value.revision)) throw new TypeError("branding revision must be positive");
  if (typeof value.sidebarLogoExpandedPath !== "string") throw new TypeError("missing logo path");
  return { sidebarLogoExpandedPath: value.sidebarLogoExpandedPath, revision: value.revision };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Routes by path so a test can break exactly one resource. */
function routed(
  routes: Partial<Record<string, () => Promise<Response> | Response>>,
  seen: string[] = [],
) {
  return async (path: string) => {
    seen.push(path);
    const route = routes[path];
    if (!route) throw new Error(`unrouted path ${path}`);
    return route();
  };
}

const okRoutes = {
  "/api/appearance": () => json({ data: savedAppearance }),
  "/api/branding": () => json({ data: savedBranding }),
};

function loader(
  fetcher: (path: string) => Promise<Response>,
  diagnostics: UiBootstrapDiagnostic[] = [],
) {
  return createUiBootstrapLoader({
    fetcher,
    resources: {
      appearance: {
        path: "/api/appearance",
        parse: parseAppearance,
        fallback: (): Appearance => structuredClone(FACTORY_APPEARANCE),
      },
      branding: {
        path: "/api/branding",
        parse: parseBranding,
        fallback: (): Branding => structuredClone(FACTORY_BRANDING),
      },
    },
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
}

describe("createUiBootstrapLoader", () => {
  test("returns one combined snapshot when both resources are valid", async () => {
    const diagnostics: UiBootstrapDiagnostic[] = [];
    const snapshot = await loader(routed(okRoutes), diagnostics).load();

    expect(snapshot).toEqual({ appearance: savedAppearance, branding: savedBranding });
    expect(diagnostics).toEqual([]);
  });

  test("infers each resource's own payload type", async () => {
    const snapshot = await loader(routed(okRoutes)).load();

    // Compile-time assertions; `tsc` is what actually enforces them.
    const revision: number = snapshot.appearance.revision;
    const logo: string = snapshot.branding.sidebarLogoExpandedPath;
    expect(revision).toBe(7);
    expect(logo).toBe("/uploaded.png");
  });

  test("starts both resources before awaiting either", async () => {
    const started: string[] = [];
    let releaseAppearance!: () => void;
    const appearanceGate = new Promise<void>((resolve) => {
      releaseAppearance = resolve;
    });

    const fetcher = async (path: string) => {
      started.push(path);
      // Appearance is answered last, so a serial implementation would never
      // reach the branding fetch while this is pending.
      if (path === "/api/appearance") await appearanceGate;
      return json({ data: path === "/api/appearance" ? savedAppearance : savedBranding });
    };

    const pending = loader(fetcher).load();
    await Promise.resolve();
    expect(started).toEqual(["/api/appearance", "/api/branding"]);

    releaseAppearance();
    await expect(pending).resolves.toEqual({
      appearance: savedAppearance,
      branding: savedBranding,
    });
  });

  test("a non-success status falls back only for the failed resource", async () => {
    const diagnostics: UiBootstrapDiagnostic[] = [];
    const snapshot = await loader(
      routed({ ...okRoutes, "/api/appearance": () => json({ data: savedAppearance }, 503) }),
      diagnostics,
    ).load();

    expect(snapshot.appearance).toEqual(FACTORY_APPEARANCE);
    expect(snapshot.branding).toEqual(savedBranding);
    expect(diagnostics).toEqual([
      {
        resource: "appearance",
        reason: "response-not-ok",
        path: "/api/appearance",
        status: 503,
      },
    ]);
  });

  test("a branding failure preserves a valid appearance", async () => {
    const diagnostics: UiBootstrapDiagnostic[] = [];
    const snapshot = await loader(
      routed({ ...okRoutes, "/api/branding": () => json({ data: { revision: 4 } }) }),
      diagnostics,
    ).load();

    expect(snapshot.appearance).toEqual(savedAppearance);
    expect(snapshot.branding).toEqual(FACTORY_BRANDING);
    expect(diagnostics.map((d) => d.resource)).toEqual(["branding"]);
  });

  const invalid: [string, () => Response, UiBootstrapDiagnostic["reason"]][] = [
    [
      "invalid JSON",
      () => new Response("<html>502</html>", { headers: { "content-type": "text/html" } }),
      "invalid-json",
    ],
    ["a missing data envelope", () => json({ appearance: savedAppearance }), "invalid-envelope"],
    ["a null data envelope", () => json({ data: null }), "invalid-payload"],
    [
      "a non-positive revision",
      () => json({ data: { ...savedAppearance, revision: 0 } }),
      "invalid-payload",
    ],
    [
      "a payload the parser rejects",
      () => json({ data: { revision: 5 } }),
      "invalid-payload",
    ],
  ];

  for (const [label, route, reason] of invalid) {
    test(`${label} falls back safely`, async () => {
      const diagnostics: UiBootstrapDiagnostic[] = [];
      const snapshot = await loader(
        routed({ ...okRoutes, "/api/appearance": route }),
        diagnostics,
      ).load();

      expect(snapshot.appearance).toEqual(FACTORY_APPEARANCE);
      expect(snapshot.branding).toEqual(savedBranding);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.reason).toBe(reason);
      expect(diagnostics[0]!.path).toBe("/api/appearance");
    });
  }

  test("a rejected fetch falls back and emits one sanitized diagnostic", async () => {
    const diagnostics: UiBootstrapDiagnostic[] = [];
    const snapshot = await loader(
      routed({
        ...okRoutes,
        "/api/appearance": () => Promise.reject(new TypeError("connect ECONNREFUSED")),
      }),
      diagnostics,
    ).load();

    expect(snapshot.appearance).toEqual(FACTORY_APPEARANCE);
    expect(diagnostics).toEqual([
      {
        resource: "appearance",
        reason: "fetch-failed",
        path: "/api/appearance",
        error: "TypeError: connect ECONNREFUSED",
      },
    ]);
  });

  test("a non-Error rejection never reaches the diagnostic", async () => {
    // A thrown response object carries the body, and sometimes a Set-Cookie.
    const secret = { body: "super-secret-session", token: "abc.def.ghi" };
    const diagnostics: UiBootstrapDiagnostic[] = [];
    await loader(
      routed({ ...okRoutes, "/api/branding": () => Promise.reject(secret) }),
      diagnostics,
    ).load();

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.error).toBe("non-error thrown: object");
    expect(JSON.stringify(diagnostics)).not.toContain("super-secret-session");
    expect(JSON.stringify(diagnostics)).not.toContain("abc.def.ghi");
  });

  test("a factory failure stays a visible error", async () => {
    // A broken factory theme is the application's configuration error. Catching
    // it here would swap one silent fallback for another and render a blank
    // page with nothing to go on.
    const failing = createUiBootstrapLoader({
      fetcher: async () => json({ data: null }),
      resources: {
        appearance: {
          path: "/api/appearance",
          parse: parseAppearance,
          fallback: (): Appearance => {
            throw new Error("factory theme is missing");
          },
        },
      },
    });

    await expect(failing.load()).rejects.toThrow("factory theme is missing");
  });

  test("a broken diagnostic reporter does not break the render", async () => {
    const failing = createUiBootstrapLoader({
      fetcher: async () => json({ data: null }),
      resources: {
        appearance: {
          path: "/api/appearance",
          parse: parseAppearance,
          fallback: (): Appearance => structuredClone(FACTORY_APPEARANCE),
        },
      },
      onDiagnostic: () => {
        throw new Error("the log shipper is down");
      },
    });

    await expect(failing.load()).resolves.toEqual({ appearance: FACTORY_APPEARANCE });
  });

  test("loads do not share mutable fallback state", async () => {
    const ui = loader(routed({ ...okRoutes, "/api/branding": () => json({ data: null }) }));

    const first = await ui.load();
    const second = await ui.load();

    expect(first.branding).not.toBe(second.branding);
    first.branding.sidebarLogoExpandedPath = "/mutated.png";
    expect(second.branding).toEqual(FACTORY_BRANDING);
    expect(FACTORY_BRANDING.sidebarLogoExpandedPath).toBe("/factory.svg");
  });

  test("does not freeze or otherwise mutate the application's own values", async () => {
    const snapshot = await loader(routed(okRoutes)).load();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.appearance)).toBe(false);
    expect(Object.isFrozen(snapshot.branding)).toBe(false);
  });

  test("accepts a custom envelope selector", async () => {
    const ui = createUiBootstrapLoader({
      fetcher: async () => json(savedBranding),
      select: (payload) => payload,
      resources: {
        branding: {
          path: "/branding.json",
          parse: parseBranding,
          fallback: (): Branding => structuredClone(FACTORY_BRANDING),
        },
      },
    });

    await expect(ui.load()).resolves.toEqual({ branding: savedBranding });
  });

  test("a selector that throws is reported as an invalid envelope", async () => {
    const diagnostics: UiBootstrapDiagnostic[] = [];
    const ui = createUiBootstrapLoader({
      fetcher: async () => json({ data: savedBranding }),
      resources: {
        branding: {
          path: "/api/branding",
          parse: parseBranding,
          fallback: (): Branding => structuredClone(FACTORY_BRANDING),
          select: () => {
            throw new RangeError("unexpected envelope version");
          },
        },
      },
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await expect(ui.load()).resolves.toEqual({ branding: FACTORY_BRANDING });
    expect(diagnostics[0]).toEqual({
      resource: "branding",
      reason: "invalid-envelope",
      path: "/api/branding",
      error: "RangeError: unexpected envelope version",
    });
  });
});

describe("per-resource loading", () => {
  test("loadResource fetches only that resource", async () => {
    const seen: string[] = [];
    const branding = await loader(routed(okRoutes, seen)).loadResource("branding");

    expect(branding).toEqual(savedBranding);
    expect(seen).toEqual(["/api/branding"]);
  });

  test("loaders exposes one accessor per configured resource", async () => {
    const ui = loader(routed(okRoutes));

    expect(Object.keys(ui.loaders).sort()).toEqual(["appearance", "branding"]);
    await expect(ui.loaders.appearance()).resolves.toEqual(savedAppearance);
  });
});

describe("package boundary", () => {
  const SERVER_SRC = join(import.meta.dir, "..", "src", "server");
  const CONSUMERS = ["@kafil/", "kafil", "@sms/", "school"];

  test("the server entry imports no consumer, React, Next, or Node built-in", () => {
    for (const file of readdirSync(SERVER_SRC)) {
      const source = readFileSync(join(SERVER_SRC, file), "utf8");
      const imports = [...source.matchAll(/^\s*(?:import|export)[^;]*from\s+["']([^"']+)["']/gm)]
        .map((match) => match[1]!);

      for (const specifier of imports) {
        for (const consumer of CONSUMERS) {
          expect(specifier.includes(consumer), `${file} imports ${specifier}`).toBe(false);
        }
        expect(specifier.startsWith("node:"), `${file} imports ${specifier}`).toBe(false);
        expect(specifier === "next" || specifier.startsWith("next/")).toBe(false);
        expect(specifier).not.toBe("server-only");

        // Only the React Server Component adapter may reach React at all.
        if (file !== "react.ts") expect(specifier).not.toBe("react");
      }
    }
  });
});
