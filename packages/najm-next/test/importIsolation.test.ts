import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "..");
const read = (relative: string) => readFileSync(resolve(packageRoot, relative), "utf8");

/** Static module specifiers actually imported by a source file (not prose). */
function importTargets(source: string): string[] {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
  const targets: string[] = [];
  for (const pattern of [/from\s+["']([^"']+)["']/g, /import\s*\(\s*["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']/g]) {
    for (const match of code.matchAll(pattern)) targets.push(match[1]!);
  }
  return targets;
}

const NEW_ENTRIES = {
  "./app": "dist/app.js",
  "./security": "dist/security.js",
  "./security/reports": "dist/security/reports.js",
  "./instrumentation/client": "dist/instrumentation/client.js",
} as const;

describe("public entrypoints", () => {
  test("every new subpath is exported with types", () => {
    const manifest = JSON.parse(read("package.json"));

    for (const [subpath, js] of Object.entries(NEW_ENTRIES)) {
      expect(manifest.exports[subpath]?.import).toBe(`./${js}`);
      expect(manifest.exports[subpath]?.types).toBe(`./${js.replace(/\.js$/, ".d.ts")}`);
    }
  });

  test("tsup builds every new subpath from its own source file", () => {
    const config = read("tsup.config.ts");

    for (const entry of ["src/app.ts", "src/security.ts", "src/security/reports.ts", "src/instrumentation/client.ts"]) {
      expect(config).toContain(entry);
    }
  });
});

describe("import isolation (DX-01/DX-02)", () => {
  test("najm-next/app is dependency-free: zero imports of any kind", () => {
    const source = read("src/app.ts");

    expect(importTargets(source)).toEqual([]);
    expect(source).not.toContain("process.env");
  });

  test("security and reports never initialize theme/database/RSC or backend packages", () => {
    // Reports is fully standalone; security may only reuse the pure app
    // definition (inlined at build — no runtime package dependency).
    expect(importTargets(read("src/security/reports.ts"))).toEqual([]);
    expect(importTargets(read("src/security.ts"))).toEqual(["./app", "./app"]);

    for (const file of ["src/security.ts", "src/security/reports.ts"]) {
      const source = read(file);

      for (const forbidden of [
        "server-only",
        "next/headers",
        "next/navigation",
        "next/server",
        "node:fs",
        "process.env",
        'from "react"',
        "from 'react'",
      ]) {
        expect(source, `${file} must not reference ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("client initializer stays client-safe and dependency-free", () => {
    const source = read("src/instrumentation/client.ts");

    expect(importTargets(source)).toEqual([]);
    expect(source).not.toContain("server-only");
    expect(source).not.toContain("next/headers");
    expect(source).not.toContain("document.");
  });

  test("root tsconfig maps every new subpath", () => {
    const tsconfig = readFileSync(resolve(packageRoot, "..", "..", "tsconfig.json"), "utf8");

    for (const subpath of ["najm-next/app", "najm-next/security", "najm-next/security/reports", "najm-next/instrumentation/client"]) {
      expect(tsconfig).toContain(`"${subpath}"`);
    }
  });
});
