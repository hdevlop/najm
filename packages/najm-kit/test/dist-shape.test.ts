import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards two defects that live only in the built output.
 *
 * Neither is reachable from `tsc` or from the unit tests, which import `src`
 * where there is exactly one module instance and no bundler in the way. Both
 * have shipped from this package before, and both present as a runtime crash or
 * a silently dead provider rather than as a build failure.
 */

const DIST = join(import.meta.dir, "..", "dist");
const ENTRIES = ["index.mjs", "adapters/next.mjs", "adapters/app.mjs"];

const built = existsSync(DIST) && ENTRIES.every((e) => existsSync(join(DIST, e)));
const describeBuilt = built ? describe : describe.skip;

describeBuilt("dist shape", () => {
  test("every entry shares one React context module", () => {
    // With `splitting: false`, each entry bundles its own copy of
    // src/providers — including its own createContext object. A provider from
    // one entry then publishes to a context a hook from another entry never
    // reads, and every consumer throws from inside a correctly nested tree.
    const chunks = readdirSync(DIST).filter((f) => f.startsWith("chunk-"));
    const owner = chunks.find((c) =>
      readFileSync(join(DIST, c), "utf8").includes("NajmPreferencesContext"),
    );

    expect(owner, "no chunk defines NajmPreferencesContext").toBeDefined();

    for (const entry of ENTRIES) {
      const source = readFileSync(join(DIST, entry), "utf8");
      const reachable =
        source.includes(owner!) ||
        // The root entry re-exports through intermediate chunks.
        chunks.some(
          (c) =>
            source.includes(c) &&
            readFileSync(join(DIST, c), "utf8").includes(owner!),
        );
      expect(reachable, `${entry} does not reach ${owner}`).toBe(true);
    }
  });

  test("the app entry keeps its 'use client' directive", () => {
    // esbuild strips module-level directives when bundling, and this is the one
    // entry a server component imports directly: an application's root layout
    // mounts NajmAppProvider, and that import is the boundary into the client
    // graph. Without the directive Next treats the hooks inside as server code
    // and the render fails.
    const source = readFileSync(join(DIST, "adapters/app.mjs"), "utf8");
    expect(source.startsWith("'use client'")).toBe(true);
  });

  test("the root entry stays server-safe", () => {
    // The inverse: marking the root entry as client would drag genuinely
    // server-usable exports (cn, the JSON parsers, the formatters) into the
    // client graph for every consumer.
    const source = readFileSync(join(DIST, "index.mjs"), "utf8");
    expect(source.startsWith("'use client'")).toBe(false);
  });
});
