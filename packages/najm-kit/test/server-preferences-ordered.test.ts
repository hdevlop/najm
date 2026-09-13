import { describe, expect, test } from "bun:test";

import {
  defineNajmPreferences,
  type NajmCookieReader,
  type NajmOrderedPreference,
  type NajmPreferenceI18n,
  type NajmPreferenceSource,
} from "../src/server";

function fakeI18n<const Languages extends readonly string[]>(
  supported: Languages,
  defaultLanguage: Languages[number],
): NajmPreferenceI18n<Languages[number]> {
  const set: ReadonlySet<string> = new Set(supported);
  return {
    supportedLanguages: supported,
    defaultLanguage,
    normalizeLanguage: (value) =>
      typeof value === "string" && set.has(value)
        ? (value as Languages[number])
        : defaultLanguage,
  };
}

function cookieReader(values: Record<string, string>): NajmCookieReader {
  return { get: (name) => (name in values ? { value: values[name]! } : undefined) };
}

const SCHOOL_TIME_ZONES = [
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Algiers",
  "Africa/Cairo",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Istanbul",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

const SCHOOL_CURRENCIES = [
  "MAD",
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "INR",
  "AED",
  "SAR",
  "EGP",
] as const;

describe("ordered preference source types (ledger floor)", () => {
  test("NajmPreferenceSource covers the four ordered sources", () => {
    const sources: NajmPreferenceSource[] = ["cookie", "user", "institution", "fallback"];
    expect(sources).toHaveLength(4);
  });

  test("NajmOrderedPreference carries ordered sources, a guard, and a fallback", () => {
    const descriptor: NajmOrderedPreference<string> = {
      sources: ["cookie", "user", "institution", "fallback"],
      guard: (value): value is string => typeof value === "string",
      fallback: "en",
    };
    expect(descriptor.sources).toEqual(["cookie", "user", "institution", "fallback"]);
    expect(descriptor.guard("x")).toBe(true);
    expect(descriptor.fallback).toBe("en");
  });
});

describe("legacy definitions carry no currency", () => {
  const i18n = fakeI18n(["en", "fr", "ar", "es"] as const, "en");
  const preferences = defineNajmPreferences({
    i18n,
    defaultTimeZone: "Africa/Casablanca",
    cookieNames: {
      language: "kafil-ui-language",
      theme: "kafil-ui-theme",
      timeZone: "kafil-ui-timezone",
    },
  });

  test("no currency state is invented for zero-config consumers", () => {
    // Currency is app-owned policy: Kit invents no MAD, no locale-derived
    // code, and no ordered currency descriptor for legacy consumers.
    expect(preferences.currencies).toHaveLength(0);
    expect(preferences.defaultCurrency).toBeUndefined();
    expect(preferences.ordered.currency).toBeUndefined();
    expect("currency" in preferences.ordered).toBe(false);
  });

  test("resolveOrdered returns exactly the three display fields", () => {
    const snapshot = preferences.resolveOrdered(cookieReader({}));
    expect(snapshot).toEqual({ language: "en", theme: "light", timeZone: "Africa/Casablanca" });
    expect("currency" in snapshot).toBe(false);
  });

  test("exposes cookie → user → institution → fallback for display fields", () => {
    for (const field of ["language", "theme", "timeZone"] as const) {
      expect(preferences.ordered[field].sources).toEqual([
        "cookie",
        "user",
        "institution",
        "fallback",
      ]);
    }
    expect(preferences.ordered.language.fallback).toBe("en");
    expect(preferences.ordered.theme.fallback).toBe("light");
    expect(preferences.ordered.timeZone.fallback).toBe("Africa/Casablanca");
  });

  test("a defaultCurrency without an allowlist is a configuration error", () => {
    expect(() =>
      defineNajmPreferences({
        i18n,
        // @ts-expect-error — no allowlist to draw the default from.
        defaultCurrency: "MAD",
      }),
    ).toThrow(/requires `currencies`/);
  });
});

describe("resolveOrdered — School-style cookie → user → institution → fallback", () => {
  const i18n = fakeI18n(["en", "fr", "ar", "es"] as const, "en");
  const preferences = defineNajmPreferences({
    i18n,
    timeZones: [...SCHOOL_TIME_ZONES],
    defaultTimeZone: "Africa/Casablanca",
    cookieNames: {
      language: "school-ui-language",
      theme: "school-ui-theme",
      timeZone: "school-ui-timezone",
    },
    currencies: [...SCHOOL_CURRENCIES],
    defaultCurrency: "MAD",
  });

  test("an explicitly configured currency keeps its sources, guard, and fallback", () => {
    expect(preferences.currencies).toEqual([...SCHOOL_CURRENCIES]);
    expect(preferences.defaultCurrency).toBe("MAD");
    expect(preferences.ordered.currency!.sources).toEqual(["institution", "fallback"]);
    expect(preferences.ordered.currency!.fallback).toBe("MAD");
    expect(preferences.ordered.currency!.sources).not.toContain("cookie");
    expect(preferences.ordered.currency!.sources).not.toContain("user");
  });

  test("a valid cookie beats user and institution values", () => {
    const snapshot = preferences.resolveOrdered(
      cookieReader({
        "school-ui-language": "fr",
        "school-ui-theme": "dark",
        "school-ui-timezone": "Europe/Paris",
      }),
      {
        user: { language: "ar", theme: "light", timeZone: "UTC" },
        institution: { language: "es", theme: "light", timeZone: "UTC", currency: "EUR" },
      },
    );
    expect(snapshot.language).toBe("fr");
    expect(snapshot.theme).toBe("dark");
    expect(snapshot.timeZone).toBe("Europe/Paris");
    expect(snapshot.currency).toBe("EUR");
  });

  test("each field skips invalid candidates independently", () => {
    const snapshot = preferences.resolveOrdered(
      cookieReader({
        "school-ui-language": "klingon",
        "school-ui-theme": "dark",
        "school-ui-timezone": "Mars/Olympus",
      }),
      {
        user: { language: "xx", theme: "system", timeZone: "Mars/Olympus" },
        institution: { language: "ar", theme: "light", timeZone: "UTC", currency: "USD" },
      },
    );
    // Language: cookie invalid, user invalid, institution valid.
    expect(snapshot.language).toBe("ar");
    // Theme: cookie valid, so user/institution never consulted.
    expect(snapshot.theme).toBe("dark");
    // Time zone: cookie and user invalid, institution valid.
    expect(snapshot.timeZone).toBe("UTC");
    expect(snapshot.currency).toBe("USD");
  });

  test("invalid institution values fall through to the typed fallback", () => {
    const snapshot = preferences.resolveOrdered(cookieReader({}), {
      institution: { language: "klingon", theme: "system", timeZone: "Mars/Olympus", currency: "XX" },
    });
    expect(snapshot).toEqual({ language: "en", theme: "light", timeZone: "Africa/Casablanca", currency: "MAD" });
  });

  test("per-field orders are independent", () => {
    const snapshot = preferences.resolveOrdered(
      cookieReader({ "school-ui-theme": "dark" }),
      {
        user: { language: "fr", theme: "light", timeZone: "Europe/Paris" },
        institution: { language: "ar", theme: "light", timeZone: "UTC", currency: "EUR" },
        orders: {
          // Language skips the user source entirely.
          language: ["cookie", "institution", "fallback"],
          // Theme keeps the default order.
          theme: ["cookie", "user", "institution", "fallback"],
        },
      },
    );
    // User French is skipped for language by the custom order.
    expect(snapshot.language).toBe("ar");
    // Theme cookie still wins.
    expect(snapshot.theme).toBe("dark");
    // Time zone uses the default order: user beats institution.
    expect(snapshot.timeZone).toBe("Europe/Paris");
  });
});

describe("resolveOrdered — Kafil Accept-Language compatibility", () => {
  const i18n = fakeI18n(["en", "fr", "ar", "es"] as const, "en");
  const preferences = defineNajmPreferences({
    i18n,
    defaultTimeZone: "Africa/Casablanca",
    cookieNames: {
      language: "kafil-ui-language",
      theme: "kafil-ui-theme",
      timeZone: "kafil-ui-timezone",
    },
    // Kafil's own MAD fallback, passed explicitly by the app — never a
    // package default. School passes its 12-code list the same way.
    currencies: ["MAD"] as const,
    defaultCurrency: "MAD",
  });

  test("valid cookie → valid user → Accept-Language → default", () => {
    expect(
      preferences.resolveOrdered(cookieReader({ "kafil-ui-language": "fr" }), {
        user: { language: "ar" },
        acceptLanguage: "es-MX,es;q=0.9",
      }).language,
    ).toBe("fr");

    expect(
      preferences.resolveOrdered(cookieReader({}), {
        user: { language: "ar" },
        acceptLanguage: "es-MX,es;q=0.9",
      }).language,
    ).toBe("ar");

    expect(
      preferences.resolveOrdered(cookieReader({}), { acceptLanguage: "es-MX,es;q=0.9" }).language,
    ).toBe("es");

    expect(preferences.resolveOrdered(cookieReader({})).language).toBe("en");
  });

  test("invalid user values fall through to Accept-Language, not to stale state", () => {
    expect(
      preferences.resolveOrdered(cookieReader({}), {
        user: { language: "klingon" },
        acceptLanguage: "fr-FR,fr;q=0.9",
      }).language,
    ).toBe("fr");
  });

  test("existing resolve() and resolveOrdered() agree for Kafil inputs", () => {
    const cookies = cookieReader({});
    const legacy = preferences.resolve(cookies, {
      languageFallback: "ar",
      acceptLanguage: "es-MX,es;q=0.9",
    });
    const ordered = preferences.resolveOrdered(cookies, {
      user: { language: "ar" },
      acceptLanguage: "es-MX,es;q=0.9",
    });
    expect(ordered.language).toBe(legacy.language);
    expect(ordered.theme).toBe(legacy.theme);
    expect(ordered.timeZone).toBe(legacy.timeZone);
  });
});

describe("resolveOrdered — currency institution-only", () => {
  const i18n = fakeI18n(["en", "fr"] as const, "en");
  const preferences = defineNajmPreferences({
    i18n,
    currencies: [...SCHOOL_CURRENCIES],
    defaultCurrency: "MAD",
  });

  test("institution value wins when valid, fallback otherwise", () => {
    expect(
      preferences.resolveOrdered(cookieReader({}), { institution: { currency: "EUR" } }).currency,
    ).toBe("EUR");
    expect(preferences.resolveOrdered(cookieReader({})).currency).toBe("MAD");
    expect(
      preferences.resolveOrdered(cookieReader({}), { institution: { currency: "XX" } }).currency,
    ).toBe("MAD");
  });

  test("cookie, user, and locale values never influence currency", () => {
    const snapshot = preferences.resolveOrdered(
      cookieReader({ "najm-ui-language": "fr", "najm-ui-theme": "dark" }),
      {
        user: { language: "fr", theme: "dark", timeZone: "Europe/Paris" },
        institution: { language: "en", currency: "MAD" },
        acceptLanguage: "fr-FR,fr;q=0.9",
      },
    );
    expect(snapshot.currency).toBe("MAD");
    // Sanity: the display fields did observe their own sources.
    expect(snapshot.language).toBe("fr");
  });

  test("a custom currency list narrows the guard and keeps the fallback inside it", () => {
    const scoped = defineNajmPreferences({
      i18n,
      currencies: ["MAD", "EUR"] as const,
      defaultCurrency: "EUR",
    });
    expect(scoped.currencies).toEqual(["MAD", "EUR"]);
    expect(
      scoped.resolveOrdered(cookieReader({}), { institution: { currency: "USD" } }).currency,
    ).toBe("EUR");
    expect(
      scoped.resolveOrdered(cookieReader({}), { institution: { currency: "MAD" } }).currency,
    ).toBe("MAD");
  });

  test("the fallback defaults to the first configured code", () => {
    const scoped = defineNajmPreferences({ i18n, currencies: ["EUR", "MAD"] as const });
    expect(scoped.defaultCurrency).toBe("EUR");
  });

  test("an empty currency list and an outside-list default are configuration errors", () => {
    expect(() => defineNajmPreferences({ i18n, currencies: [] as const })).toThrow(
      /at least one code/,
    );
    expect(() =>
      defineNajmPreferences({
        i18n,
        currencies: ["MAD"] as const,
        // @ts-expect-error — the type rejects it too; this proves the runtime does.
        defaultCurrency: "EUR",
      }),
    ).toThrow(/not one of the configured codes/);
  });
});
