import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createNajmServerApp } from "../src/app/server";
import { buildKafilStyleApp } from "./apps";
import {
  OperationalError,
  createCounters,
  createFixtureServerApp,
  defaultBackend,
} from "./serverApps";

const packageRoot = resolve(import.meta.dir, "..");
const readSource = (relative: string) => readFileSync(resolve(packageRoot, relative), "utf8");

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolvePromise = resolveFn;
    rejectPromise = rejectFn;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe("createNajmServerApp — factory validation", () => {
  test("rejects an invalid app definition at factory time", () => {
    const counters = createCounters();
    const backend = defaultBackend();
    expect(() =>
      createFixtureServerApp("kafil", { ...backend }, counters, []),
    ).not.toThrow();
    expect(() =>
      createNajmServerApp({
        // @ts-expect-error — proves the runtime validation too.
        app: { id: "bad" },
        auth: {
          getSession: async () => null,
          requireSession: async () => {
            throw new Error("x");
          },
          requireRole: async () => {
            throw new Error("x");
          },
        },
        theme: {
          loadAppearance: async () => ({ revision: 1 }),
          loadBranding: async () => ({ logo: "/x" }),
        },
        readSettings: async () => ({ enabled: true }),
        fallbackSettings: { enabled: false },
        resolvePreferences: () => ({}) as never,
        readCookies: async () => ({ get: () => undefined }),
        readHeaders: async () => ({ get: () => null }),
      }),
    ).toThrow();
  });

  test("rejects missing callbacks at factory time, never per request", () => {
    const app = buildKafilStyleApp();
    const base = {
      app,
      auth: {
        getSession: async () => null,
        requireSession: async (): Promise<never> => {
          throw new Error("x");
        },
        requireRole: async (): Promise<never> => {
          throw new Error("x");
        },
      },
      theme: {
        loadAppearance: async () => ({ revision: 1 }),
        loadBranding: async () => ({ logo: "/x" }),
      },
      readSettings: async () => ({ enabled: true }),
      fallbackSettings: { enabled: false },
      resolvePreferences: () => ({}) as never,
      readCookies: async () => ({ get: () => undefined }),
      readHeaders: async () => ({ get: () => null }),
    };
    for (const key of ["auth", "theme", "readSettings", "resolvePreferences", "readCookies", "readHeaders"] as const) {
      expect(() =>
        createNajmServerApp({ ...base, [key]: undefined as never }),
      ).toThrow(key);
    }
  });
});

describe("lightweight session accessors", () => {
  test("getSession triggers nothing else", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const serverApp = createFixtureServerApp("school", defaultBackend(), counters, diagnostics);
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");

    await serverApp.getSession();
    expect(counters.session).toBe(1);
    expect(counters.cookies).toBe(0);
    expect(counters.headers).toBe(0);
    expect(counters.appearance).toBe(0);
    expect(counters.branding).toBe(0);
    expect(counters.settings).toBe(0);
  });

  test("requireSession and requireRole delegate without side loads", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const backend = defaultBackend({
      session: { user: { language: "fr" }, roles: ["admin"] },
    });
    const serverApp = createFixtureServerApp("school", backend, counters, diagnostics);
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");

    await serverApp.requireSession();
    await serverApp.requireRole(["admin"]);
    expect(counters.session).toBe(2);
    expect(counters.appearance).toBe(0);
    expect(counters.branding).toBe(0);
    expect(counters.settings).toBe(0);
    expect(counters.cookies).toBe(0);
  });
});

describe("resource independence and concurrent starts", () => {
  test("session, cookies/headers, appearance, branding, and settings start before awaiting", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const gates = {
      session: deferred<null>(),
      cookies: deferred<{ get: () => undefined }>(),
      headers: deferred<{ get: () => null }>(),
      appearance: deferred<{ revision: number }>(),
      branding: deferred<{ logo: string }>(),
      settings: deferred<{ enabled: boolean }>(),
    };
    const started: string[] = [];
    const app = buildKafilStyleApp();
    const serverApp = createNajmServerApp({
      app,
      auth: {
        getSession: () => {
          started.push("session");
          return gates.session.promise as Promise<null>;
        },
        requireSession: async (): Promise<never> => {
          throw new Error("unused");
        },
        requireRole: async (): Promise<never> => {
          throw new Error("unused");
        },
      },
      theme: {
        loadAppearance: () => {
          started.push("appearance");
          return gates.appearance.promise;
        },
        loadBranding: () => {
          started.push("branding");
          return gates.branding.promise;
        },
      },
      readSettings: () => {
        started.push("settings");
        return gates.settings.promise;
      },
      fallbackSettings: { enabled: false },
      resolvePreferences: () => ({
        language: "en",
        theme: "light",
        timeZone: "UTC",
        currency: "MAD",
        direction: "ltr",
        locale: "en-MA",
      }),
      readCookies: () => {
        started.push("cookies");
        return gates.cookies.promise;
      },
      readHeaders: () => {
        started.push("headers");
        return gates.headers.promise;
      },
      onDiagnostic: (diagnostic) => diagnostics.push({ ...diagnostic }),
    });

    const pending = serverApp.loadUiSnapshot();
    await Promise.resolve();
    await Promise.resolve();
    expect(started.sort()).toEqual(
      ["appearance", "branding", "cookies", "headers", "session", "settings"].sort(),
    );

    gates.session.resolve(null);
    gates.cookies.resolve({ get: () => undefined });
    gates.headers.resolve({ get: () => null });
    gates.appearance.resolve({ revision: 1 });
    gates.branding.resolve({ logo: "/x" });
    gates.settings.resolve({ enabled: true });
    const snapshot = await pending;
    expect(snapshot.settings).toEqual({ enabled: true });
    expect(counters.session).toBe(0);
  });

  test("appearance and branding failures stay independent", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    // Theme loaders with built-in independence: branding down, appearance fine.
    const app = buildKafilStyleApp();
    const serverApp = createNajmServerApp({
      app,
      auth: { getSession: async () => null, requireSession: async (): Promise<never> => { throw new Error("x"); }, requireRole: async (): Promise<never> => { throw new Error("x"); } },
      theme: {
        loadAppearance: async () => {
          counters.appearance += 1;
          return { revision: 7 };
        },
        loadBranding: async () => {
          counters.branding += 1;
          // A theme bootstrap with its own fallback would resolve here; a
          // factory failure propagates as a config error without discarding
          // the appearance the caller already started.
          throw new Error("factory branding is missing");
        },
      },
      readSettings: async () => {
        counters.settings += 1;
        return { enabled: true };
      },
      fallbackSettings: { enabled: false },
      resolvePreferences: () => ({
        language: "en",
        theme: "light",
        timeZone: "UTC",
        currency: "MAD",
        direction: "ltr",
        locale: "en-MA",
      }),
      readCookies: async () => ({ get: () => undefined }),
      readHeaders: async () => ({ get: () => null }),
    });
    await expect(serverApp.loadUiSnapshot()).rejects.toThrow("factory branding is missing");
    expect(counters.appearance).toBe(1);
  });
});

describe("settings projection and sanitized diagnostics", () => {
  test("Kafil projection returns only { enabled } with a typed fallback", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const serverApp = createFixtureServerApp(
      "kafil",
      defaultBackend({ kafilSettingsError: new Error("connect ECONNREFUSED") }),
      counters,
      diagnostics,
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const settings = await serverApp.loadSettings();
    expect(settings).toEqual({ enabled: false });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe("settings-unavailable");
    expect(diagnostics[0]!.detail).toBe("error");
    expect(JSON.stringify(diagnostics)).not.toContain("connect ECONNREFUSED");
  });

  test("diagnostics never carry raw values, settings, env, cookies, or secrets", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const secret = "SECRET-TOKEN-ABC-123";
    const serverApp = createFixtureServerApp(
      "school",
      defaultBackend({ schoolSettingsError: { body: secret, token: "tok.xyz" } }),
      counters,
      diagnostics,
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const settings = await serverApp.loadSettings();
    expect(settings).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.detail).toBe("non-error thrown: object");
    expect(JSON.stringify(diagnostics)).not.toContain(secret);
  });

  test("a broken diagnostic reporter does not break the render", async () => {
    const app = buildKafilStyleApp();
    const serverApp = createNajmServerApp({
      app,
      auth: { getSession: async () => null, requireSession: async (): Promise<never> => { throw new Error("x"); }, requireRole: async (): Promise<never> => { throw new Error("x"); } },
      theme: {
        loadAppearance: async () => ({ revision: 1 }),
        loadBranding: async () => ({ logo: "/x" }),
      },
      readSettings: async (): Promise<{ enabled: boolean }> => {
        throw new Error("down");
      },
      fallbackSettings: { enabled: false },
      resolvePreferences: () => ({
        language: "en",
        theme: "light",
        timeZone: "UTC",
        currency: "MAD",
        direction: "ltr",
        locale: "en-MA",
      }),
      readCookies: async () => ({ get: () => undefined }),
      readHeaders: async () => ({ get: () => null }),
      onDiagnostic: () => {
        throw new Error("log shipper is down");
      },
    });
    await expect(serverApp.loadSettings()).resolves.toEqual({ enabled: false });
  });
});

describe("session failure policies — no blanket catch", () => {
  test("Kafil-style resolves operational failures to anonymous via its auth stub", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const serverApp = createFixtureServerApp(
      "kafil",
      defaultBackend({ session: null, sessionError: new OperationalError("AUTH_TRANSPORT_ERROR", "down") }),
      counters,
      diagnostics,
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    await expect(serverApp.getSession()).resolves.toBeNull();
  });

  test("School-style propagates operational failures (no universal anonymous fallback)", async () => {
    const counters = createCounters();
    const diagnostics: { code: string; detail?: string }[] = [];
    const failure = new OperationalError("AUTH_TRANSPORT_ERROR", "recovery unavailable");
    const serverApp = createFixtureServerApp(
      "school",
      defaultBackend({ session: null, sessionError: failure }),
      counters,
      diagnostics,
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    await expect(serverApp.getSession()).rejects.toBe(failure);
    await expect(serverApp.loadUiSnapshot()).rejects.toBe(failure);
  });

  test("anonymous stays null for both styles without an error", async () => {
    for (const style of ["kafil", "school"] as const) {
      const serverApp = createFixtureServerApp(style, defaultBackend({ session: null }), createCounters(), []);
      if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
      await expect(serverApp.getSession()).resolves.toBeNull();
    }
  });
});

describe("composed preference orders", () => {
  test("Kafil-style: cookie → user → Accept-Language → default", async () => {
    const serverApp = createFixtureServerApp(
      "kafil",
      defaultBackend({
        session: { user: { language: "ar" } },
        cookies: {},
        acceptLanguage: "es-MX,es;q=0.9",
      }),
      createCounters(),
      [],
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const snapshot = await serverApp.loadUiSnapshot();
    expect(snapshot.preferences.language).toBe("ar");

    const viaBrowser = createFixtureServerApp(
      "kafil",
      defaultBackend({ session: null, cookies: {}, acceptLanguage: "fr-FR,fr;q=0.9" }),
      createCounters(),
      [],
    );
    if (!("loadUiSnapshot" in viaBrowser)) throw new Error("unexpected fixture type");
    expect((await viaBrowser.loadUiSnapshot()).preferences.language).toBe("fr");
  });

  test("School-style: cookie → user → institution → fallback; currency institution-only", async () => {
    const serverApp = createFixtureServerApp(
      "school",
      defaultBackend({
        session: { user: { language: "ar", theme: "dark", timeZone: "Europe/Paris" } },
        cookies: { "school-ui-language": "fr" },
        schoolSettings: {
          schoolName: "S",
          language: "es",
          theme: "light",
          timeZone: "UTC",
          currency: "EUR",
        },
      }),
      createCounters(),
      [],
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const snapshot = await serverApp.loadUiSnapshot();
    // Cookie wins for language; user wins for theme/timeZone over institution.
    expect(snapshot.preferences.language).toBe("fr");
    expect(snapshot.preferences.theme).toBe("dark");
    expect(snapshot.preferences.timeZone).toBe("Europe/Paris");
    expect(snapshot.preferences.currency).toBe("EUR");

    const cookieFree = createFixtureServerApp(
      "school",
      defaultBackend({
        session: null,
        cookies: {},
        acceptLanguage: "fr-FR",
        schoolSettings: {
          schoolName: "S",
          language: "es",
          theme: "light",
          timeZone: "UTC",
          currency: "MAD",
        },
      }),
      createCounters(),
      [],
    );
    if (!("loadUiSnapshot" in cookieFree)) throw new Error("unexpected fixture type");
    const second = await cookieFree.loadUiSnapshot();
    // Institution wins; Accept-Language never leaks into preferences or currency.
    expect(second.preferences.language).toBe("es");
    expect(second.preferences.currency).toBe("MAD");
  });
});

describe("serializable public snapshot", () => {
  test("round-trips through JSON with only the allowlisted public fields", async () => {
    const serverApp = createFixtureServerApp(
      "school",
      defaultBackend({ session: { user: { language: "fr" }, roles: ["admin"] } }),
      createCounters(),
      [],
    );
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const snapshot = await serverApp.loadUiSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual(
      ["app", "appearance", "branding", "preferences", "session", "settings"].sort(),
    );
    expect(snapshot.app).toEqual({ appName: "School fixture" });
    expect(Object.isFrozen(snapshot)).toBe(true);
    const clone = JSON.parse(JSON.stringify(snapshot));
    expect(clone.preferences.language).toBe("fr");
    expect(JSON.stringify(snapshot)).not.toContain("function");
  });

  test("never serializes forbidden internals", async () => {
    const serverApp = createFixtureServerApp("kafil", defaultBackend(), createCounters(), []);
    if (!("loadUiSnapshot" in serverApp)) throw new Error("unexpected fixture type");
    const snapshot = await serverApp.loadUiSnapshot();
    const serialized = JSON.stringify(snapshot);
    for (const forbidden of [
      "remember",
      "QueryClient",
      "getServer",
      "readSettings",
      "resolvePreferences",
      "cafil-server",
      "sms-server",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(snapshot.app).toEqual({ appName: "Kafil fixture", currency: "MAD" });
    for (const key of ["auth", "callbacks", "env", "server", "secret", "token"]) {
      expect(snapshot).not.toHaveProperty(key);
    }
    expect(snapshot.app).not.toHaveProperty("auth");
  });
});

describe("module boundaries — no cwd inference, no backend init, no cycle", () => {
  test("app/server imports only react and the pure app definition", () => {
    const raw = readSource("src/app/server.ts");
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
    const targets = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    const dynamic = [...source.matchAll(/import\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const target of [...targets, ...dynamic]) {
      expect(target.startsWith("najm-"), `app/server must not import ${target}`).toBe(false);
      expect(target.includes("@kafil") || target.includes("@sms")).toBe(false);
      expect(target === "next" || target.startsWith("next/")).toBe(false);
      expect(target.startsWith("node:")).toBe(false);
    }
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("process.cwd");
    expect(source).not.toContain("findWorkspaceRoot");
  });
});
