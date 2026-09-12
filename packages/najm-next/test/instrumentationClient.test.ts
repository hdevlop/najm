import { afterEach, describe, expect, test } from "bun:test";
import { initNajmZodStrictCsp } from "../src/instrumentation/client";

type GlobalWithZodConfig = typeof globalThis & {
  __zod_globalConfig?: { jitless?: boolean; [key: string]: unknown };
};

afterEach(() => {
  const host = globalThis as GlobalWithZodConfig;
  if (host.__zod_globalConfig && "jitless" in host.__zod_globalConfig) {
    delete host.__zod_globalConfig.jitless;
  }
});

describe("shared strict-CSP client initialization", () => {
  test("opts Zod into JIT-less evaluation before it loads", () => {
    const host = globalThis as GlobalWithZodConfig;
    delete host.__zod_globalConfig;

    initNajmZodStrictCsp();

    expect(host.__zod_globalConfig?.jitless).toBe(true);
  });

  test("preserves an existing global config instead of replacing it", () => {
    const host = globalThis as GlobalWithZodConfig;
    const existing = { customError: undefined };
    host.__zod_globalConfig = existing;

    initNajmZodStrictCsp();

    expect(host.__zod_globalConfig).toBe(existing);
    expect(host.__zod_globalConfig?.jitless).toBe(true);
  });

  test("is idempotent", () => {
    initNajmZodStrictCsp();
    initNajmZodStrictCsp();
    expect((globalThis as GlobalWithZodConfig).__zod_globalConfig?.jitless).toBe(true);
  });

  test("the module is import-safe with no DOM available", async () => {
    expect(typeof window).toBe("undefined");
    // Importing must not throw and must not touch server-only state. The
    // auto-run is browser-gated, so an explicit call is still required here.
    const module = await import("../src/instrumentation/client");
    expect(typeof module.initNajmZodStrictCsp).toBe("function");
  });

  test("the module source stays client-only", async () => {
    const source = await Bun.file(new URL("../src/instrumentation/client.ts", import.meta.url)).text();

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("next/headers");
    expect(source).not.toContain("next/navigation");
    expect(source).not.toContain("node:");
    expect(source).not.toContain("process.env");
    expect(source).not.toMatch(/^import /m);
    expect(source).toContain("typeof window");
    expect(source).toContain("__zod_globalConfig");
  });
});
