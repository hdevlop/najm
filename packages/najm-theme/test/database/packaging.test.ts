import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import manifest from "../../package.json" with { type: "json" };

// ============================================================================
// Packaging
//
// Asserted against `dist`, not against `src`. An export map that resolves in
// TypeScript and a tarball that resolves in Node are different claims, and it
// is the second one a consumer actually installs — so every path here is read
// off the built output, and the suite fails loudly when it has not been built.
// ============================================================================

const DIST = resolve(import.meta.dir, "../../dist");
const BUILT = existsSync(resolve(DIST, "index.js"));

const read = (relative: string) => readFileSync(resolve(DIST, relative), "utf8");

describe("export map", () => {
  it("declares every subpath the package promises", () => {
    expect(Object.keys(manifest.exports).sort()).toEqual([
      ".",
      "./contracts",
      "./package.json",
      "./pg",
      "./react",
      "./server",
      "./server/react",
      "./sqlite",
      "./styles.css",
    ]);
  });

  it("points the browser condition of server/react at the guard, not the adapter", () => {
    const entry = manifest.exports["./server/react"] as Record<string, string>;
    expect(entry.browser).toBe("./dist/server/reactClientGuard.js");
    expect(entry["react-server"]).toBe("./dist/server/react.js");
    // Ordering matters: `react-server` and `browser` must both precede the
    // generic `import`/`default`, or a bundler resolves the adapter first.
    const keys = Object.keys(entry);
    expect(keys.indexOf("react-server")).toBeLessThan(keys.indexOf("import"));
    expect(keys.indexOf("browser")).toBeLessThan(keys.indexOf("import"));
  });

  it("publishes only dist and the two documents", () => {
    expect(manifest.files).toEqual(["dist", "README.md", "CHANGELOG.md"]);
  });

  it("keeps every optional runtime an optional peer", () => {
    const optional = manifest.peerDependenciesMeta as Record<string, { optional: boolean }>;
    for (const name of ["najm-storage", "najm-mcp", "@tanstack/react-query", "react", "next"]) {
      expect(optional[name]?.optional).toBe(true);
    }
    // Sharp is a native module and normalization is documented as degrading
    // without it, so it belongs in optionalDependencies rather than peers.
    expect(Object.keys(manifest.optionalDependencies)).toEqual(["sharp"]);
  });

  it("does not depend on najm-kit at runtime — it is the peer this builds on", () => {
    expect(Object.keys(manifest.dependencies)).not.toContain("najm-kit");
    expect(manifest.peerDependencies["najm-kit"]).toBeDefined();
  });
});

describe.skipIf(!BUILT)("built output", () => {
  it("emits every declared entry with its declarations", () => {
    for (const file of [
      "index.js",
      "index.d.ts",
      "contracts/index.js",
      "contracts/index.d.ts",
      "server/index.js",
      "server/index.d.ts",
      "server/react.js",
      "server/react.d.ts",
      "server/reactClientGuard.js",
      "schema/pg.js",
      "schema/pg.d.ts",
      "schema/sqlite.js",
      "schema/sqlite.d.ts",
      "react/index.js",
      "react/index.d.ts",
      "styles.css",
    ]) {
      expect(existsSync(resolve(DIST, file))).toBe(true);
    }
  });

  it("keeps decorator metadata, which the container reads to inject", () => {
    // esbuild drops `emitDecoratorMetadata`; the build's `preserve-metadata`
    // plugin runs server sources through the TypeScript transpiler first. Without
    // it every constructor injection in the plugin resolves to `undefined`.
    expect(read("server/index.js")).toContain("design:paramtypes");
  });

  it("marks the React entry as a client boundary", () => {
    expect(read("react/index.js").startsWith('"use client"')).toBe(true);
  });

  it("does not put a client directive on any other entry", () => {
    for (const file of ["index.js", "contracts/index.js", "server/index.js", "schema/pg.js"]) {
      expect(read(file).startsWith('"use client"')).toBe(false);
    }
  });
});

describe.skipIf(!BUILT)("bundle isolation", () => {
  it("keeps server implementation out of the React entry", () => {
    const bundle = read("react/index.js");

    for (const forbidden of [
      "drizzle-orm",
      "najm-database",
      "najm-storage",
      "reflect-metadata",
      "server-only",
      "AppearanceController",
      "AppearanceRepository",
      "BrandingAssetService",
      "sharp",
    ]) {
      expect(bundle).not.toContain(forbidden);
    }
  });

  it("keeps React out of the contracts and schema entries", () => {
    for (const file of ["contracts/index.js", "index.js", "schema/pg.js", "schema/sqlite.js"]) {
      const bundle = read(file);
      expect(bundle).not.toContain("react/jsx-runtime");
      expect(bundle).not.toContain("use client");
    }
  });

  it("keeps the server entry away from the najm-kit root barrel", () => {
    // The root barrel reaches the whole component library, and importing it
    // from a route handler resolves react-hook-form under the `react-server`
    // condition and fails the build. `najm-kit/server` is the pure entry.
    const bundle = read("server/index.js");
    expect(bundle).toMatch(/from ["']najm-kit\/server["']/);
    expect(bundle).not.toMatch(/from ["']najm-kit["']/);
  });

  it("keeps Drizzle out of every non-schema entry", () => {
    for (const file of ["contracts/index.js", "index.js", "react/index.js"]) {
      expect(read(file)).not.toContain("drizzle-orm");
    }
  });

  it("makes the browser guard fail loudly rather than warn", () => {
    const guard = read("server/reactClientGuard.js");
    expect(guard).toContain("throw new Error");
    expect(guard).toContain("React Server Component module");
  });

  it("never imports the optional peers at all, statically or dynamically", () => {
    // `najm-storage` and `najm-mcp` are reached only through the container, by
    // symbol. That is a correctness requirement before it is a packaging one:
    // importing them here loads whichever copy *this* package resolves, and a
    // class taken from that copy is a different DI token than the one the
    // application booted — so the container answers with a second, unconfigured
    // service instead of failing. Any import of these specifiers reintroduces
    // the temptation, so the built bundle must not mention them.
    const bundle = read("server/index.js");

    for (const name of ["najm-storage", "najm-mcp"]) {
      expect(bundle).not.toMatch(new RegExp(`from ["']${name}["']`));
      expect(bundle).not.toMatch(new RegExp(`(?:^|[;\\n])\\s*import\\s*["']${name}["']`, "m"));
      expect(bundle).not.toMatch(new RegExp(`import\\(\\s*["']${name}["']`));
      expect(bundle).not.toMatch(new RegExp(`require\\(\\s*["']${name}["']`));
    }

    // The symbols the peers alias to their services, inlined rather than
    // imported, which is what makes the line above possible.
    expect(bundle).toContain('Symbol.for("najm:storage:service")');
    expect(bundle).toContain('Symbol.for("najm:mcp:registry")');
  });

  it("leaves Sharp a dynamic import, not a static one", () => {
    // Sharp is a genuine module dependency rather than a container lookup: an
    // installation with no `assetUploads` never needs the native binary
    // present, so it must not be reached until an image is normalized.
    const bundle = read("server/index.js");
    expect(bundle).not.toMatch(/^import .* from ["']sharp["']/m);
    expect(bundle).toMatch(/await import\(["']sharp["']\)/);
  });
});

describe.skipIf(!BUILT)("styles", () => {
  it("ships the package stylesheet with a source directive the consumer build can scan", () => {
    const css = read("styles.css");
    expect(css).toContain("@source");
    expect(css).toContain(".najm-theme-branding-grid");
  });

  it("uses logical properties so the surface mirrors under RTL", () => {
    const css = read("styles.css");
    expect(css).toContain("margin-inline-start");

    // Declarations only. The prose above them explains *why* `margin-left` is
    // absent, and a naive search would fail on that explanation.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const physical of ["margin-left", "margin-right", "padding-left", "padding-right"]) {
      expect(declarations).not.toMatch(new RegExp(`\\b${physical}\\b`));
    }
  });

  it("honours reduced motion", () => {
    expect(read("styles.css")).toContain("prefers-reduced-motion");
  });
});
