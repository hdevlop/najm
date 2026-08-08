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

/**
 * Entries a server component or route handler may import.
 *
 * `react` under the `react-server` condition has no `createContext`, so an
 * entry that reaches one crashes on module evaluation rather than at a call
 * site — which is why this is checked on the built output and not by `tsc`.
 */
const SERVER_SAFE_ENTRIES = ["format.mjs", "pagination.mjs"];

const built = existsSync(DIST) && ENTRIES.every((e) => existsSync(join(DIST, e)));
const describeBuilt = built ? describe : describe.skip;

describeBuilt("dist shape", () => {
  test("every entry shares one React context module", () => {
    // With `splitting: false`, each entry bundles its own copy of
    // src/providers — including its own createContext object. A provider from
    // one entry then publishes to a context a hook from another entry never
    // reads, and every consumer throws from inside a correctly nested tree.
    const chunks = readdirSync(DIST).filter((f) => f.startsWith("chunk-"));

    // Match the `createContext` call rather than the bare name. The exported
    // hook `useNajmPreferencesContext` contains the context's name as a
    // substring, so any chunk that merely re-exports the hook used to register
    // as a second definition — which sent this test looking for the wrong owner
    // and failed on an output that was actually correct.
    const CREATES_CONTEXT =
      /\bNajmPreferencesContext\s*=\s*(?:\w+\.)?createContext\b/;
    const owners = chunks.filter((c) =>
      CREATES_CONTEXT.test(readFileSync(join(DIST, c), "utf8")),
    );

    expect(
      owners.length,
      `NajmPreferencesContext must be created exactly once, found in: ${owners.join(", ") || "no chunk"}`,
    ).toBe(1);
    const owner = owners[0];

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

  test("the leaf entries reach no client-only React API", () => {
    // The root barrel is one module reaching the whole component library, so
    // server code cannot import it: react-hook-form resolves to its
    // `react-server` build (no `Controller`) and the build fails, and anything
    // calling `createContext` crashes on module evaluation because that export
    // does not exist there either. These entries exist to be the server's way
    // in, and both failures cost a full application build to discover — hence
    // asserting on the bundled graph here.
    const forbidden = ["createContext", "react-hook-form", "sonner"];

    for (const entry of SERVER_SAFE_ENTRIES) {
      if (!existsSync(join(DIST, entry))) continue;

      // Follow the entry's own chunk graph; the entry file is a re-export stub.
      const seen = new Set<string>();
      const queue = [entry];
      let graph = "";
      while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file) || !existsSync(join(DIST, file))) continue;
        seen.add(file);
        const source = readFileSync(join(DIST, file), "utf8");
        graph += source;
        for (const chunk of source.match(/chunk-[A-Z0-9]+\.mjs/g) ?? []) {
          queue.push(chunk);
        }
      }

      for (const token of forbidden) {
        expect(graph, `${entry} reaches ${token}`).not.toContain(token);
      }
    }
  });
});
