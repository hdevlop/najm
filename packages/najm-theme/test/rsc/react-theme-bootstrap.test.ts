import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as React from "react";

import { createReactThemeBootstrap } from "../../src/server/react";
import type { NajmDesignConfig } from "../../src/contracts";

// ============================================================================
// The RSC contract: one snapshot per request, never shared across requests.
//
// React ships two builds and only the one behind the `react-server` condition
// memoizes `cache()`. Run through `bun run test:rsc`, which adds the condition
// and runs from this folder — the sharing assertions are meaningless without
// it, so they are skipped rather than silently passing under the default build.
// ============================================================================

const REACT_SERVER_BUILD = typeof (React as { useState?: unknown }).useState !== "function";
const requestCache = REACT_SERVER_BUILD
  ? (React as unknown as Record<string, { A: unknown }>)
      .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  : undefined;

/** Enter a React server request: everything inside shares one cache. */
function beginRequest(): void {
  if (!requestCache) return;
  const store = new Map<() => unknown, unknown>();
  requestCache.A = {
    getCacheForType(create: () => unknown) {
      if (!store.has(create)) store.set(create, create());
      return store.get(create);
    },
    cacheSignal: () => null,
  };
}

function endRequest(): void {
  if (requestCache) requestCache.A = null;
}

const FACTORY_DESIGN: NajmDesignConfig = {
  version: 1,
  theme: { tokens: { primary: "#000000" } },
};

const FACTORY_BRANDING = { sidebarLogoExpanded: "/brand/logo.png", authHeroImage: null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// One application module, created once at module scope, exactly as a
// consumer's `lib/serverTheme.ts` does. Recreating it per test would give every
// test its own memoization entry and prove nothing about sharing.
const calls: string[] = [];
let appearanceStatus = 200;
let brandingStatus = 200;
let appearancePayload: unknown = {
  designConfig: { version: 1, theme: { tokens: { primary: "#0ea5e9" } } },
  revision: 4,
};

const serverTheme = createReactThemeBootstrap({
  fetcher: async (path) => {
    calls.push(path);
    if (path.endsWith("/appearance")) {
      return appearanceStatus === 200
        ? json({ data: appearancePayload })
        : json({ message: "nope" }, appearanceStatus);
    }
    return brandingStatus === 200
      ? json({ data: { slots: { sidebarLogoExpanded: "/uploads/a.png" }, revision: 7 } })
      : json({ message: "nope" }, brandingStatus);
  },
  basePath: "/api/theme",
  factory: {
    appearance: () => structuredClone(FACTORY_DESIGN),
    branding: () => ({ ...FACTORY_BRANDING }),
  },
});

beforeEach(() => {
  calls.length = 0;
  appearanceStatus = 200;
  brandingStatus = 200;
  appearancePayload = {
    designConfig: { version: 1, theme: { tokens: { primary: "#0ea5e9" } } },
    revision: 4,
  };
  beginRequest();
});

afterEach(endRequest);

describe("loading", () => {
  it("reads both resources from the configured base path", async () => {
    const snapshot = await serverTheme.load();

    expect(calls.sort()).toEqual(["/api/theme/appearance", "/api/theme/branding"]);
    expect(snapshot.appearance.revision).toBe(4);
    expect(snapshot.branding.slots.sidebarLogoExpanded).toBe("/uploads/a.png");
  });

  it("unwraps Najm's data envelope", async () => {
    expect((await serverTheme.loadAppearance()).designConfig.theme.tokens?.primary).toBe("#0ea5e9");
  });
});

describe("request sharing", () => {
  it.skipIf(!REACT_SERVER_BUILD)(
    "resolves once per request no matter how many layouts ask",
    async () => {
      await Promise.all([
        serverTheme.load(),
        serverTheme.loadAppearance(),
        serverTheme.loadBranding(),
        serverTheme.loadAppearance(),
      ]);

      // Two fetches for four reads: the root layout, a nested layout, and the
      // page share one resolution instead of racing three.
      expect(calls).toHaveLength(2);
    },
  );

  it.skipIf(!REACT_SERVER_BUILD)("gives a later request its own snapshot", async () => {
    await serverTheme.load();
    expect(calls).toHaveLength(2);

    endRequest();
    beginRequest();
    appearancePayload = {
      designConfig: { version: 1, theme: { tokens: { primary: "#ff0000" } } },
      revision: 5,
    };

    const second = await serverTheme.loadAppearance();
    expect(calls).toHaveLength(4);
    expect(second.revision).toBe(5);
  });

  it.skipIf(!REACT_SERVER_BUILD)(
    "retries a transient failure on the next request rather than pinning it",
    async () => {
      appearanceStatus = 503;
      const first = await serverTheme.loadAppearance();
      expect(first.designConfig).toEqual(FACTORY_DESIGN);

      endRequest();
      beginRequest();
      appearanceStatus = 200;

      const second = await serverTheme.loadAppearance();
      expect(second.revision).toBe(4);
    },
  );
});

describe("independent fallback", () => {
  it("keeps a good theme when branding is down", async () => {
    brandingStatus = 500;
    const snapshot = await serverTheme.load();

    expect(snapshot.appearance.revision).toBe(4);
    expect(snapshot.branding.slots.sidebarLogoExpanded).toBe("/brand/logo.png");
    expect(snapshot.branding.revision).toBe(1);
  });

  it("keeps good branding when appearance is down", async () => {
    appearanceStatus = 500;
    const snapshot = await serverTheme.load();

    expect(snapshot.appearance.designConfig).toEqual(FACTORY_DESIGN);
    expect(snapshot.branding.revision).toBe(7);
  });

  it("falls back on a payload that is well-formed JSON but not a valid design", async () => {
    appearancePayload = {
      designConfig: { version: 1, theme: { tokens: { primary: "url(https://evil.test)" } } },
      revision: 9,
    };

    const appearance = await serverTheme.loadAppearance();
    expect(appearance.designConfig).toEqual(FACTORY_DESIGN);
    // Revision 1, not 9: a fallback must not hand the client a revision it
    // could then save against.
    expect(appearance.revision).toBe(1);
  });

  it("falls back on a missing or non-positive revision", async () => {
    appearancePayload = { designConfig: FACTORY_DESIGN, revision: 0 };
    expect((await serverTheme.loadAppearance()).revision).toBe(1);
  });

  it("projects the factory branding map onto slot paths, nulls included", async () => {
    brandingStatus = 500;
    const branding = await serverTheme.loadBranding();

    expect(branding.slots).toEqual({
      sidebarLogoExpanded: "/brand/logo.png",
      authHeroImage: null,
    });
  });
});

describe("diagnostics", () => {
  it("reports the reason without the response body", async () => {
    const seen: { resource: string; reason: string; status?: number }[] = [];
    const loader = createReactThemeBootstrap({
      fetcher: async () => json({ message: "internal detail nobody should log" }, 500),
      basePath: "/api/theme",
      factory: {
        appearance: () => structuredClone(FACTORY_DESIGN),
        branding: () => ({ ...FACTORY_BRANDING }),
      },
      onDiagnostic: (diagnostic) => seen.push(diagnostic),
    });

    await loader.load();

    expect(seen).toHaveLength(2);
    expect(seen.every((entry) => entry.reason === "response-not-ok")).toBe(true);
    expect(seen.every((entry) => entry.status === 500)).toBe(true);
    expect(JSON.stringify(seen)).not.toContain("internal detail");
  });
});

describe("server-only isolation", () => {
  it("does not reach React DOM or any component module", async () => {
    // Importing under the `react-server` condition is the assertion: anything
    // in this module's graph that pulled in `react-dom/client` — which every
    // component entry eventually does — would throw on load.
    const module = await import("../../src/server/react");
    expect(typeof module.createReactThemeBootstrap).toBe("function");
  });
});
