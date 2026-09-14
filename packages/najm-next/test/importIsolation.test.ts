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
  "./app/server": "dist/app/server.js",
  "./app/next": "dist/app/next.js",
  "./app/react": "dist/app/react.js",
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

    for (const entry of ["src/app.ts", "src/app/server.ts", "src/app/next.ts", "src/app/react.tsx", "src/security.ts", "src/security/reports.ts", "src/instrumentation/client.ts"]) {
      expect(config).toContain(entry);
    }
    expect(config).toContain("'dist', 'app', 'react.js'");
    expect(config).toContain("`'use client';\\n${source}`");
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

    for (const subpath of ["najm-next/app", "najm-next/app/server", "najm-next/app/next", "najm-next/app/react", "najm-next/security", "najm-next/security/reports", "najm-next/instrumentation/client"]) {
      expect(tsconfig).toContain(`"${subpath}"`);
    }
  });

  test("app/server is a leaf: react peer + pure app definition only, no Najm runtime deps or cycles", () => {
    const source = read("src/app/server.ts");
    const targets = importTargets(source);

    for (const target of targets) {
      expect(target.startsWith("najm-"), `app/server must not import ${target}`).toBe(false);
      expect(target.includes("@kafil") || target.includes("@sms")).toBe(false);
      expect(target === "next" || target.startsWith("next/")).toBe(false);
      expect(target.startsWith("node:")).toBe(false);
    }
    // Allowed: "react" (declared peer) and "../app" (pure definition).
    for (const target of targets) {
      const allowed = target === "react" || target === "../app" || target.startsWith("../app");
      expect(allowed, `unexpected app/server import ${target}`).toBe(true);
    }
    expect(source).not.toContain("process.cwd");
    expect(source).not.toContain("findWorkspaceRoot");
  });

  test("app/next is the explicit optional-owner integration leaf", () => {
    const targets = importTargets(read("src/app/next.ts"));
    expect(targets).toContain("next/headers");
    expect(targets).toContain("najm-auth/client/server/react");
    expect(targets).toContain("najm-auth/client/server");
    expect(targets).toContain("najm-kit/server");
    expect(targets).toContain("najm-theme/contracts");
    expect(targets).toContain("./server");
    expect(read("src/app.ts")).not.toContain("./app/next");
  });

  test("app/react composes structural providers without importing optional owners", () => {
    const source = read("src/app/react.tsx");
    expect(source.startsWith('\"use client\"')).toBe(true);
    expect(importTargets(source)).toEqual(["react"]);
    for (const optional of ["najm-auth", "najm-kit", "najm-theme", "@tanstack/react-query", "leaflet", "@googlemaps"]) {
      expect(source).not.toContain(`from \"${optional}`);
    }
  });

  test("security, config, and app remain isolated from server bootstrap, backends, and UI init", () => {
    for (const file of ["src/app.ts", "src/security.ts", "src/security/reports.ts", "src/config.ts", "src/configurable.ts"]) {
      let source: string;
      try {
        source = read(file);
      } catch {
        continue;
      }
      const targets = importTargets(source);
      for (const target of targets) {
        expect(target.includes("app/server"), `${file} must not reach the server bootstrap`).toBe(false);
        expect(target.startsWith("najm-"), `${file} must not import ${target}`).toBe(false);
        expect(target.includes("@kafil") || target.includes("@sms")).toBe(false);
      }
      expect(source, `${file} must not initialize theme`).not.toContain("loadAppearance");
      expect(source, `${file} must not initialize theme`).not.toContain("loadBranding");
      expect(source, `${file} must not read the backend`).not.toContain("getServer");
    }
    // The pure definition stays import-free even after the server leaf exists.
    expect(importTargets(read("src/app.ts"))).toEqual([]);
  });
});
