import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as React from "react";

import {
  createCounters,
  createFixtureServerApp,
  defaultBackend,
} from "../serverApps";

// React ships two builds. Only the one behind the `react-server` condition
// memoizes `cache()`; the default build hands the function back untouched.
// Assertions about sharing run under `bun run test:rsc`, which adds the
// condition and runs from this folder.
const REACT_SERVER_BUILD = typeof (React as { useState?: unknown }).useState !== "function";
const requestCache = REACT_SERVER_BUILD
  ? (React as unknown as Record<string, { A: unknown }>).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  : undefined;

/** Enter a React server request: everything inside shares one cache. */
function beginRequest(): void {
  if (!requestCache) return;
  const store = new Map<() => unknown, unknown>();
  requestCache.A = {
    getCacheForType(create: () => unknown) {
      if (!store.has(create)) store.set(create, create());
      return store.get(create);
    },
    cacheSignal: () => null,
  };
}

function endRequest(): void {
  if (requestCache) requestCache.A = null;
}

/**
 * One application module per style, created once at module scope exactly as a
 * consumer's `najm.server.ts` does. Recreating per test would give every test
 * its own memoization entry and prove nothing about sharing.
 */
const kafilCounters = createCounters();
const kafilDiagnostics: { code: string; detail?: string }[] = [];
const kafilBackend = defaultBackend({
  session: { user: { language: "fr" }, roles: ["operator"] },
  cookies: {},
  acceptLanguage: "fr-FR",
  kafilSettings: { enabled: true },
});
const kafilApp = createFixtureServerApp("kafil", kafilBackend, kafilCounters, kafilDiagnostics);
if (!("loadUiSnapshot" in kafilApp)) throw new Error("unexpected kafil fixture type");

const schoolCounters = createCounters();
const schoolDiagnostics: { code: string; detail?: string }[] = [];
const schoolBackend = defaultBackend({
  session: { user: { language: "ar" }, roles: ["admin"] },
  cookies: {},
  schoolSettings: {
    schoolName: "Fixture School",
    language: "es",
    theme: "light",
    timeZone: "UTC",
    currency: "EUR",
  },
});
const schoolApp = createFixtureServerApp("school", schoolBackend, schoolCounters, schoolDiagnostics);
if (!("loadUiSnapshot" in schoolApp)) throw new Error("unexpected school fixture type");

beforeEach(() => {
  kafilCounters.session = 0;
  kafilCounters.cookies = 0;
  kafilCounters.headers = 0;
  kafilCounters.appearance = 0;
  kafilCounters.branding = 0;
  kafilCounters.settings = 0;
  kafilDiagnostics.length = 0;
  schoolCounters.session = 0;
  schoolCounters.cookies = 0;
  schoolCounters.headers = 0;
  schoolCounters.appearance = 0;
  schoolCounters.branding = 0;
  schoolCounters.settings = 0;
  schoolDiagnostics.length = 0;
  // Reset shared backend state so tests never observe each other's mutations.
  // The factory instances stay module-scoped (the property under test).
  kafilBackend.session = { user: { language: "fr" }, roles: ["operator"] };
  kafilBackend.sessionError = undefined;
  kafilBackend.cookies = {};
  kafilBackend.acceptLanguage = "fr-FR";
  kafilBackend.appearance = { revision: 7 };
  kafilBackend.appearanceError = undefined;
  kafilBackend.branding = { logo: "/uploaded-logo.png" };
  kafilBackend.brandingError = undefined;
  kafilBackend.kafilSettings = { enabled: true };
  kafilBackend.kafilSettingsError = undefined;
  schoolBackend.session = { user: { language: "ar" }, roles: ["admin"] };
  schoolBackend.sessionError = undefined;
  schoolBackend.cookies = {};
  schoolBackend.acceptLanguage = null;
  schoolBackend.appearance = { revision: 7 };
  schoolBackend.appearanceError = undefined;
  schoolBackend.branding = { logo: "/uploaded-logo.png" };
  schoolBackend.brandingError = undefined;
  schoolBackend.schoolSettings = {
    schoolName: "Fixture School",
    language: "es",
    theme: "light",
    timeZone: "UTC",
    currency: "EUR",
  };
  schoolBackend.schoolSettingsError = undefined;
  beginRequest();
});

afterEach(endRequest);

const describeShared = REACT_SERVER_BUILD ? describe : describe.skip;

describeShared("one server bootstrap per React request", () => {
  test("concurrent settings and snapshot reads share one settings resolution", async () => {
    const [snapshot, settings, second] = await Promise.all([
      kafilApp.loadUiSnapshot(),
      kafilApp.loadSettings(),
      kafilApp.loadUiSnapshot(),
    ]);

    expect(kafilCounters.settings).toBe(1);
    expect(settings).toEqual({ enabled: true });
    expect(second).toBe(snapshot);
    expect(snapshot.settings).toEqual(settings);
  });

  test("a nested layout reading after the root sees the same snapshot", async () => {
    const root = await schoolApp.loadUiSnapshot();
    const nestedSettings = await schoolApp.loadSettings();
    const page = await schoolApp.loadUiSnapshot();

    expect(schoolCounters.settings).toBe(1);
    expect(page).toBe(root);
    expect(nestedSettings).toEqual(root.settings);
  });

  test("a failed settings read stays stable for the whole render", async () => {
    kafilBackend.kafilSettingsError = new Error("connect ECONNREFUSED");
    try {
      const first = await kafilApp.loadSettings();
      // Even once the backend recovers mid-render, the render keeps one answer.
      kafilBackend.kafilSettingsError = undefined;
      kafilBackend.kafilSettings = { enabled: true };
      const second = await kafilApp.loadSettings();
      const snapshot = await kafilApp.loadUiSnapshot();

      expect(first).toEqual({ enabled: false });
      expect(second).toEqual(first);
      expect(snapshot.settings).toEqual(first);
      expect(kafilDiagnostics).toHaveLength(1);
      expect(kafilDiagnostics[0]!.code).toBe("settings-unavailable");
    } finally {
      kafilBackend.kafilSettingsError = undefined;
      kafilBackend.kafilSettings = { enabled: true };
    }
  });

  test("a later request retries rather than reusing a process-global fallback", async () => {
    kafilBackend.kafilSettingsError = new Error("down");
    try {
      expect(await kafilApp.loadSettings()).toEqual({ enabled: false });
    } finally {
      kafilBackend.kafilSettingsError = undefined;
    }

    endRequest();
    beginRequest();
    kafilCounters.settings = 0;
    kafilDiagnostics.length = 0;
    kafilBackend.kafilSettings = { enabled: true };

    expect(await kafilApp.loadSettings()).toEqual({ enabled: true });
    expect(kafilCounters.settings).toBe(1);
  });

  test("separate requests share no snapshot, settings, or diagnostics", async () => {
    const first = await schoolApp.loadUiSnapshot();
    expect(schoolCounters.settings).toBe(1);

    endRequest();
    beginRequest();
    schoolCounters.session = 0;
    schoolCounters.cookies = 0;
    schoolCounters.headers = 0;
    schoolCounters.appearance = 0;
    schoolCounters.branding = 0;
    schoolCounters.settings = 0;
    schoolDiagnostics.length = 0;

    const second = await schoolApp.loadUiSnapshot();
    expect(second).not.toBe(first);
    expect(second.settings).toEqual(first.settings);
    expect(second.settings).not.toBe(first.settings);
    expect(schoolDiagnostics).toEqual([]);
  });

  test("no cross-request session leakage between users", async () => {
    // User language beats the institution default, so the first request
    // renders French from the session while the institution holds Spanish.
    schoolBackend.session = { user: { language: "fr" }, roles: ["admin"] };
    const first = await schoolApp.loadUiSnapshot();
    expect(first.session?.user).toEqual({ language: "fr" });
    expect(first.preferences.language).toBe("fr");

    endRequest();
    beginRequest();
    schoolCounters.session = 0;
    schoolCounters.settings = 0;
    schoolDiagnostics.length = 0;
    schoolBackend.session = { user: { language: "ar" }, roles: ["principal"] };
    schoolBackend.cookies = { "school-ui-language": "ar" };

    const second = await schoolApp.loadUiSnapshot();
    expect(second.session?.user).toEqual({ language: "ar" });
    expect(second.preferences.language).toBe("ar");
    expect(second).not.toBe(first);
    expect(second.session).not.toBe(first.session);
  });
});

describe("adapter contract", () => {
  test("exposes lightweight accessors plus memoized loaders", () => {
    for (const app of [kafilApp, schoolApp]) {
      expect(typeof app.getSession).toBe("function");
      expect(typeof app.requireSession).toBe("function");
      expect(typeof app.requireRole).toBe("function");
      expect(typeof app.loadSettings).toBe("function");
      expect(typeof app.loadUiSnapshot).toBe("function");
    }
  });
});
