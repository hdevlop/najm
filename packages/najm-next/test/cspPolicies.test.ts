import { describe, expect, test } from "bun:test";
import {
  assertNajmNonce,
  createNajmCsp,
  createNajmNonce,
  NAJM_CSP_HEADER,
  NAJM_CSP_POLICY_MODE,
  NAJM_NONCE_HEADER,
} from "../src/security";
import { buildKafilStyleApp, buildSchoolStyleApp } from "./apps";

const KAFIL_LOCATION = { imgSrc: ["https://tiles.example"], connectSrc: [] as string[] };
const EMPTY_LOCATION = { imgSrc: [] as string[], connectSrc: [] as string[] };

function directive(policy: string, name: string): string {
  const found = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name));
  if (!found) throw new Error(`policy is missing ${name}`);
  return found;
}

describe("nonce generation", () => {
  test("creates a fresh valid nonce for every call", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNajmNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(() => assertNajmNonce(nonce)).not.toThrow();
  });

  test("rejects directive-injection nonces", () => {
    for (const bad of ["bad'; script-src *", "a\nb", "", "x".repeat(300), 42, null, undefined]) {
      expect(() => assertNajmNonce(bad)).toThrow(TypeError);
    }
    expect(() => createNajmCsp("bad'; script-src *", {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app: buildKafilStyleApp(),
      locationCsp: EMPTY_LOCATION,
    })).toThrow();
  });
});

describe("Kafil-style production policy", () => {
  const policy = createNajmCsp("test-nonce_1234567890=", {
    mode: NAJM_CSP_POLICY_MODE,
    isDevelopment: false,
    app: buildKafilStyleApp(),
    locationCsp: KAFIL_LOCATION,
  });

  test("authorizes scripts only through the request nonce", () => {
    const scriptSrc = directive(policy, "script-src");

    expect(scriptSrc).toContain("'nonce-test-nonce_1234567890='");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("*");
  });

  test("keeps imagery, isolation, and reporting intact", () => {
    expect(directive(policy, "img-src")).toBe(
      "img-src 'self' data: blob: https://cdnjs.cloudflare.com https://tile.openstreetmap.org https://tiles.example",
    );
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("report-uri /api/csp-report");
    expect(policy).toContain("connect-src 'self'");
  });

  test("retains the documented style requirement without production eval", () => {
    expect(directive(policy, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("unsafe-eval");
  });
});

describe("School-style production policy", () => {
  const policy = createNajmCsp("school-nonce-12345678", {
    mode: NAJM_CSP_POLICY_MODE,
    isDevelopment: false,
    app: buildSchoolStyleApp(),
    locationCsp: EMPTY_LOCATION,
  });

  test("carries the Google provider allowlist and keeps production strict", () => {
    expect(directive(policy, "connect-src")).toContain("https://*.googleapis.com");
    expect(directive(policy, "connect-src")).toContain("https://*.google.com");
    expect(directive(policy, "font-src")).toContain("https://*.gstatic.com");
    expect(directive(policy, "frame-src")).toBe("frame-src 'self' https://www.google.com");
    expect(directive(policy, "img-src")).toContain("https://*.googleapis.com");
    expect(directive(policy, "img-src")).toContain("https://*.gstatic.com");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain(" *;");
  });

  test("accepts validated provider contributions without weakening script policy", () => {
    const googlePolicy = createNajmCsp("school-nonce-12345678", {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app: buildSchoolStyleApp(),
      locationCsp: {
        imgSrc: ["https://maps.gstatic.com"],
        connectSrc: ["https://maps.googleapis.com"],
        scriptSrc: ["https://maps.googleapis.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        frameSrc: [],
      },
    });

    expect(directive(googlePolicy, "script-src")).toContain("https://maps.googleapis.com");
    expect(directive(googlePolicy, "font-src")).toContain("https://fonts.gstatic.com");
    expect(googlePolicy).not.toContain("unsafe-eval");
    expect(() => createNajmCsp("school-nonce-12345678", {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app: buildSchoolStyleApp(),
      locationCsp: {
        imgSrc: [],
        connectSrc: [],
        scriptSrc: ["'unsafe-eval'"],
      },
    })).toThrow();
  });
});

describe("policy composition rules", () => {
  test("nonce mode is explicit and development eval stays dev-only", () => {
    const app = buildKafilStyleApp();
    expect(() =>
      createNajmCsp(createNajmNonce(), {
        // @ts-expect-error — only "nonce" is a valid mode.
        mode: "static",
        isDevelopment: false,
        app,
        locationCsp: EMPTY_LOCATION,
      }),
    ).toThrow("mode");

    const dev = createNajmCsp(createNajmNonce(), {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: true,
      app,
      locationCsp: EMPTY_LOCATION,
    });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
  });

  test("deduplicates origins across app, location, and override contributions", () => {
    const policy = createNajmCsp(createNajmNonce(), {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app: buildKafilStyleApp(),
      locationCsp: { imgSrc: ["https://tile.openstreetmap.org"], connectSrc: [] },
      overrides: { extraImgSrc: ["https://tile.openstreetmap.org"] },
    });
    const sources = directive(policy, "img-src").split(" ").filter(Boolean);
    expect(sources.filter((source) => source === "https://tile.openstreetmap.org")).toHaveLength(1);
  });

  test("rejects overrides that would weaken the policy", () => {
    const app = buildKafilStyleApp();
    const base = {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app,
      locationCsp: EMPTY_LOCATION,
    } as const;
    expect(() => createNajmCsp(createNajmNonce(), {
      ...base, overrides: { extraScriptSrc: ["'unsafe-eval'"] },
    })).toThrow("unsafe-eval");
    expect(() => createNajmCsp(createNajmNonce(), {
      ...base, overrides: { extraImgSrc: ["https://evil.test/x; script-src *"] },
    })).toThrow();
    expect(() => createNajmCsp(createNajmNonce(), {
      ...base, overrides: { extraFrameSrc: ["https://frames.example"] },
    })).toThrow("'none' must stand alone");
    expect(() => createNajmCsp(createNajmNonce(), {
      ...base, locationCsp: { imgSrc: ["http://tiles.example/tiles.png"], connectSrc: [] },
    })).toThrow();
  });

  test("every accepted app CSP field reaches the composed policy", async () => {
    const { defineNajmApp } = await import("../src/app");
    const nonce = "sentinel-nonce-12345678";
    const base = buildKafilStyleApp();
    const options = {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      locationCsp: EMPTY_LOCATION,
    } as const;

    const withField = (csp: typeof base.csp) => defineNajmApp({ ...base, csp });
    expect(createNajmCsp(nonce, {
      ...options,
      app: withField({ ...base.csp, extraImgSrc: [...(base.csp.extraImgSrc ?? []), "https://sentinel-img.example"] }),
    })).toContain("https://sentinel-img.example");
    expect(createNajmCsp(nonce, {
      ...options,
      app: withField({ ...base.csp, extraConnectSrc: ["https://sentinel-connect.example"] }),
    })).toContain("https://sentinel-connect.example");
    expect(createNajmCsp(nonce, {
      ...options,
      app: withField({ ...base.csp, extraFontSrc: ["https://sentinel-font.example"] }),
    })).toContain("https://sentinel-font.example");
    expect(createNajmCsp(nonce, {
      ...options,
      app: withField({ ...base.csp, frameSrc: ["https://sentinel-frame.example"] }),
    })).toContain("frame-src https://sentinel-frame.example");
    // The pinned report path is the fifth accepted field.
    expect(createNajmCsp(nonce, { ...options, app: base })).toContain("report-uri /api/csp-report");
  });

  test("development policy follows the installed Next 16 guidance", () => {
    // Installed Next 16 CSP guide (content-security-policy.md, "Development
    // Environment"): development requires only 'unsafe-eval' — React uses
    // eval to reconstruct server error stacks — and the dev example retains
    // upgrade-insecure-requests. No ws:/wss: scheme is composed here without
    // runtime evidence; real HMR WebSocket/browser behavior remains a
    // consumer acceptance item, not proven by this unit check.
    const nonce = createNajmNonce();
    const app = buildKafilStyleApp();
    const dev = createNajmCsp(nonce, {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: true,
      app,
      locationCsp: EMPTY_LOCATION,
    });

    expect(directive(dev, "connect-src")).toContain("'self'");
    expect(dev).toContain("upgrade-insecure-requests");
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("ws:");

    const prod = createNajmCsp(nonce, {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment: false,
      app,
      locationCsp: EMPTY_LOCATION,
    });
    expect(prod).toContain("upgrade-insecure-requests");
    expect(prod).not.toContain("'unsafe-eval'");
  });

  test("exports stable header names", () => {
    expect(NAJM_CSP_HEADER).toBe("Content-Security-Policy");
    expect(NAJM_NONCE_HEADER).toBe("x-nonce");
  });
});
