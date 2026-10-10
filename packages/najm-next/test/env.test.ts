import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isNextBuildPhase } from "../src/env";

const packageRoot = resolve(import.meta.dir, "..");
const read = (relative: string) => readFileSync(resolve(packageRoot, relative), "utf8");
const originalPhase = process.env.NEXT_PHASE;

afterEach(() => {
  if (originalPhase === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = originalPhase;
});

describe("najm-next/env", () => {
  test("only the production-build phase is the build phase", () => {
    delete process.env.NEXT_PHASE;
    expect(isNextBuildPhase()).toBe(false);

    for (const phase of ["phase-production-server", "phase-development-server", "phase-export", "phase-test", ""]) {
      process.env.NEXT_PHASE = phase;
      expect(isNextBuildPhase(), phase).toBe(false);
    }

    process.env.NEXT_PHASE = "phase-production-build";
    expect(isNextBuildPhase()).toBe(true);
  });

  test("source imports nothing, so a server or seed can load it without Next", () => {
    const code = read("src/env.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/\bimport\b|\brequire\(/);
  });

  test("is exported with types and built from its own entry", () => {
    const manifest = JSON.parse(read("package.json"));
    expect(manifest.exports["./env"]).toEqual({
      types: "./dist/env.d.ts",
      import: "./dist/env.js",
      default: "./dist/env.js",
    });
    expect(read("tsup.config.ts")).toContain("env: 'src/env.ts'");
  });

  test.skipIf(!existsSync(resolve(packageRoot, "dist/env.js")))("the built entry imports nothing and runs outside Next", async () => {
    const built = read("dist/env.js");
    expect(built).not.toMatch(/\bimport\b|\brequire\(/);
    expect(built).not.toContain("use client");
    expect(read("dist/env.d.ts")).toContain("isNextBuildPhase");

    const { isNextBuildPhase: builtIsNextBuildPhase } = await import("../dist/env.js");
    process.env.NEXT_PHASE = "phase-production-build";
    expect(builtIsNextBuildPhase()).toBe(true);
  });
});
