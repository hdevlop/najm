import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the boundary the server entries exist to draw.
 *
 * A regression here does not fail `tsc` and does not fail a unit test that
 * imports `src`. It fails in a consumer's production build — or worse, it does
 * not fail at all and ships the application's internal fetcher, its endpoint
 * paths, and its factory values into a browser bundle.
 */

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  files: string[];
  exports: Record<string, Record<string, string>>;
};

describe("server export map", () => {
  test("najm-kit/server resolves to the pure entry", () => {
    expect(pkg.exports["./server"]).toEqual({
      types: "./dist/server/index.d.ts",
      import: "./dist/server/index.mjs",
      default: "./dist/server/index.mjs",
    });
  });

  test("najm-kit/server/react sends browser bundles to the guard", () => {
    const entry = pkg.exports["./server/react"]!;

    // Order matters: `browser` must precede `import`/`default` so a bundler
    // targeting the browser stops at the guard.
    expect(Object.keys(entry)).toEqual([
      "types",
      "react-server",
      "browser",
      "import",
      "default",
    ]);
    expect(entry.browser).toBe("./dist/server/reactClientGuard.mjs");
    expect(entry["react-server"]).toBe("./dist/server/react.mjs");
  });

  test("dist is packed", () => {
    expect(pkg.files).toContain("dist");
  });
});

describe("client-component guard", () => {
  test("importing the adapter from a browser bundle fails with an explanation", async () => {
    // What a Client Component's build resolves to. It throws on evaluation, so
    // the failure is the build's, with a message naming the right entry.
    const attempt = import("../src/server/reactClientGuard");

    await expect(attempt).rejects.toThrow(/najm-kit\/server\/react is a React Server Component/);
    await expect(attempt).rejects.toThrow(/NajmAppProvider/);
  });
});

const ENTRIES = ["server/index.mjs", "server/react.mjs", "server/reactClientGuard.mjs"];
const built = existsSync(DIST) && ENTRIES.every((entry) => existsSync(join(DIST, entry)));
const describeBuilt = built ? describe : describe.skip;

/** Follows an entry's own chunk graph; entry files are re-export stubs. */
function bundleGraph(entry: string): string {
  const seen = new Set<string>();
  const queue = [entry];
  let graph = "";
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(join(DIST, file))) continue;
    seen.add(file);
    const source = readFileSync(join(DIST, file), "utf8");
    graph += source;
    for (const chunk of source.match(/chunk-[A-Z0-9]+\.mjs/g) ?? []) queue.push(chunk);
  }
  return graph;
}

describeBuilt("server entries in dist", () => {
  test("emits JavaScript and declarations for all three entries", () => {
    for (const entry of ENTRIES) {
      expect(existsSync(join(DIST, entry)), `missing ${entry}`).toBe(true);
      expect(
        existsSync(join(DIST, entry.replace(/\.mjs$/, ".d.ts"))),
        `missing declarations for ${entry}`,
      ).toBe(true);
    }
  });

  test("declares the public contract", () => {
    const pure = readFileSync(join(DIST, "server/index.d.ts"), "utf8");
    for (const name of [
      "createUiBootstrapLoader",
      "UiBootstrapConfig",
      "UiBootstrapDiagnostic",
      "UiBootstrapFailureReason",
      "UiBootstrapFetcher",
      "UiBootstrapLoader",
      "UiBootstrapResource",
      "UiBootstrapSnapshot",
      "parseNajmDesignConfig",
      "NajmDesignConfig",
      "defineNajmPreferences",
      "NajmPreferences",
      "NajmPreferencesConfig",
      "NajmPreferenceHandlers",
      "NajmPreferenceI18n",
      "NajmPreferenceSnapshot",
      "NajmCookieReader",
      "NAJM_TIME_ZONES",
      "NajmTimeZone",
      "NajmMode",
    ]) {
      expect(pure.includes(name), `expected ${name} in server/index.d.ts`).toBe(true);
    }

    const react = readFileSync(join(DIST, "server/react.d.ts"), "utf8");
    expect(react).toContain("createReactServerUiBootstrap");
    expect(react).toContain("ReactServerUiBootstrap");
  });

  test("the pure entry carries no React import", () => {
    // `react` under the `react-server` condition has no `createContext`, and
    // this entry is meant to be reachable from a route handler and a plain
    // script as well as a render.
    const graph = bundleGraph("server/index.mjs");
    expect(graph).not.toMatch(/from\s*["']react["']/);
    expect(graph).not.toContain("createContext");
    expect(graph).not.toContain("react-hook-form");
  });

  test("the server entries never reach a client-only React API", () => {
    for (const entry of ["server/index.mjs", "server/react.mjs"]) {
      const graph = bundleGraph(entry);
      for (const token of ["createContext", "react-hook-form", "sonner", "use client"]) {
        expect(graph, `${entry} reaches ${token}`).not.toContain(token);
      }
    }
  });

  test("the client entries never reach the server adapter", () => {
    // The inverse, and the one that actually costs a consumer something: a
    // stray re-export from the root barrel would put the application's
    // fetcher and factory values into every browser bundle.
    for (const entry of ["index.mjs", "adapters/next.mjs", "adapters/app.mjs"]) {
      const graph = bundleGraph(entry);
      expect(graph, `${entry} reaches the UI bootstrap loader`).not.toContain("UiBootstrap");
      expect(graph, `${entry} reaches the preference contract`).not.toContain(
        "defineNajmPreferences",
      );
      expect(graph, `${entry} imports server-only`).not.toContain("server-only");
      expect(graph, `${entry} reaches the client guard`).not.toContain(
        "is a React Server Component module",
      );
    }
  });
});
