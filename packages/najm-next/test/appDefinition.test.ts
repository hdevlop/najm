import { describe, expect, test } from "bun:test";
import {
  assertNajmAppDefinition,
  assertNajmCspSource,
  defineNajmApp,
  isNajmCspSource,
  NAJM_CSP_REPORT_PATH,
  type NajmAppDefinition,
} from "../src/app";
import { buildKafilStyleApp, buildSchoolStyleApp } from "./apps";

describe("najm-next/app definition", () => {
  test("accepts both Kafil-style and School-style policies", () => {
    const kafil = buildKafilStyleApp();
    const school = buildSchoolStyleApp();

    expect(kafil.auth.proxySessionMode).toBe("optimistic");
    expect(school.auth.proxySessionMode).toBe("authoritative");
    expect(kafil.auth.rememberCookieName).toBe("kafil.remember");
    expect(school.auth.rememberCookieName).toBe("sms.remember");
    expect(kafil.csp.frameSrc).toEqual(["'none'"]);
    expect(school.csp.frameSrc).toEqual(["'self'", "https://www.google.com"]);
    expect(NAJM_CSP_REPORT_PATH).toBe("/api/csp-report");
  });

  test("freezes the definition so shared config cannot be mutated", () => {
    const app = buildKafilStyleApp();

    expect(Object.isFrozen(app)).toBe(true);
    expect(Object.isFrozen(app.auth.publicRoutes)).toBe(true);
    expect(() => {
      (app as { id: string }).id = "mutated";
    }).toThrow();
  });

  test("rejects an invalid proxy session mode without a default", () => {
    const base = buildKafilStyleApp();
    expect(() =>
      defineNajmApp({ ...base, auth: { ...base.auth, proxySessionMode: "sometimes" as never } }),
    ).toThrow('proxySessionMode');
  });

  test("rejects routes that are not app-absolute paths", () => {
    const base = buildKafilStyleApp();
    for (const bad of ["https://evil.test/x", "no-leading-slash", "/has space", "/semi;colon"]) {
      expect(() => defineNajmApp({ ...base, auth: { ...base.auth, loginRoute: bad } })).toThrow("loginRoute");
    }
  });

  test("rejects duplicate preference cookie names", () => {
    const base = buildKafilStyleApp();
    expect(() =>
      defineNajmApp({
        ...base,
        preferences: {
          ...base.preferences,
          cookieNames: { language: "dup", theme: "dup", timeZone: "tz" },
        },
      }),
    ).toThrow("distinct");
  });

  test("rejects a non-IANA default timezone", () => {
    const base = buildKafilStyleApp();
    expect(() =>
      defineNajmApp({ ...base, preferences: { ...base.preferences, defaultTimeZone: "Casablanca" } }),
    ).toThrow("defaultTimeZone");
    // UTC and IANA zones are accepted.
    expect(() => defineNajmApp({ ...base, preferences: { ...base.preferences, defaultTimeZone: "UTC" } })).not.toThrow();
  });

  test("pins the report path to the backend-free route", () => {
    const base = buildKafilStyleApp();
    expect(() =>
      defineNajmApp({ ...base, csp: { ...base.csp, reportPath: "/api/other" as never } }),
    ).toThrow("reportPath");
  });

  test("rejects an invalid environment prefix", () => {
    const base = buildKafilStyleApp();
    expect(() => defineNajmApp({ ...base, location: { environmentPrefix: "bad-prefix" } })).toThrow(
      "environmentPrefix",
    );
  });

  test("assertNajmAppDefinition accepts a valid definition and rejects junk", () => {
    expect(() => assertNajmAppDefinition(buildSchoolStyleApp())).not.toThrow();
    for (const junk of [null, [], "app", 42, {}, { id: "x" }]) {
      expect(() => assertNajmAppDefinition(junk)).toThrow(TypeError);
    }
  });

  test("definition JSON round-trips (serializable, no functions)", () => {
    const app: NajmAppDefinition = buildKafilStyleApp();
    expect(() => structuredClone(JSON.parse(JSON.stringify(app)))).not.toThrow();
    expect(JSON.stringify(app)).not.toContain("function");
  });
});

describe("CSP source validation", () => {
  test("accepts approved keywords and https origins", () => {
    for (const source of [
      "'self'",
      "'none'",
      "data:",
      "blob:",
      "https://tile.openstreetmap.org",
      "https://*.googleapis.com",
      "https://tiles.example:8443/{z}/{x}/{y}.png",
    ]) {
      expect(isNajmCspSource(source)).toBe(true);
      expect(() => assertNajmCspSource(source, "test")).not.toThrow();
    }
  });

  test("rejects injection and weakening tokens", () => {
    for (const source of [
      "*",
      "https://*",
      "'unsafe-eval'",
      "http://tiles.example/tiles.png",
      "https://evil.test/x; script-src *",
      "https://evil.test/x\r\nSet-Cookie: a=b",
      "https://user:pass@evil.test/",
      "'self' 'nonce-abc'",
      "",
      42,
      null,
    ]) {
      expect(isNajmCspSource(source)).toBe(false);
      expect(() => assertNajmCspSource(source, "test")).toThrow(TypeError);
    }
  });
});
