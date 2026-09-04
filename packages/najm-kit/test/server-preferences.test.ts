import { describe, expect, test } from "bun:test";

import {
  NAJM_TIME_ZONES,
  defineNajmPreferences,
  type NajmCookieReader,
  type NajmPreferenceI18n,
  type NajmPreferenceTimeZone,
} from "../src/server";
import { timeZones as timeZoneItems } from "../src/components/inputs/TimeZoneInput";

/**
 * A structural stand-in for a `najm-i18n` definition.
 *
 * Deliberately hand-built rather than imported: the contract accepts a shape,
 * not a package, and a test that reached for `defineI18n` would quietly make
 * `najm-i18n` a hard dependency of every consumer's route handlers.
 */
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

const i18n = fakeI18n(["en", "fr", "ar", "es"] as const, "en");

/** Anything shaped like Next's cookie store. */
function cookieReader(values: Record<string, string>): NajmCookieReader {
  return { get: (name) => (name in values ? { value: values[name]! } : undefined) };
}

function post(body: unknown, raw?: string): Request {
  return new Request("https://example.test/api/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

function setCookie(response: Response): string | null {
  return response.headers.get("set-cookie");
}

describe("defineNajmPreferences — zero configuration", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("applies every Najm default from `{ i18n }` alone", () => {
    expect(preferences.cookieNames).toEqual({
      language: "najm-ui-language",
      theme: "najm-ui-theme",
      timeZone: "najm-ui-timezone",
    });
    expect(preferences.cookieOptions).toEqual({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    expect(preferences.defaultTheme).toBe("light");
    expect(preferences.defaultTimeZone).toBe("UTC");
    expect(preferences.defaultLanguage).toBe("en");
    expect(preferences.timeZones).toEqual([...NAJM_TIME_ZONES]);
  });

  test("resolves the configured defaults with no cookies at all", () => {
    expect(preferences.resolve(cookieReader({}))).toEqual({
      language: "en",
      theme: "light",
      timeZone: "UTC",
    });
  });
});

describe("theme", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("resolves light and dark from the cookie", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(preferences.resolve(cookieReader({ "najm-ui-theme": theme })).theme).toBe(theme);
    }
  });

  test("falls back to light for a missing, empty, or unknown stored value", () => {
    for (const stored of [undefined, "", "high-contrast", "LIGHT", "system"]) {
      const cookies = stored === undefined ? {} : { "najm-ui-theme": stored };
      expect(preferences.resolve(cookieReader(cookies)).theme).toBe("light");
    }
  });

  test("accepts a posted mode and returns the normalized value", async () => {
    const response = await preferences.handlers.theme(post({ theme: "dark" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ theme: "dark" });
    expect(setCookie(response)).toBe(
      "najm-ui-theme=dark; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax",
    );
  });

  test("rejects anything else without writing a cookie", async () => {
    for (const theme of ["system", "", "Dark", null, 7, { theme: "dark" }]) {
      const response = await preferences.handlers.theme(post({ theme }));

      expect(response.status).toBe(400);
      expect(setCookie(response)).toBeNull();
      expect(await response.json()).toEqual({ message: "Unsupported theme." });
    }
  });

  test("a design token is not a theme preference", async () => {
    const response = await preferences.handlers.theme(post({ theme: "dark-emerald" }));
    expect(response.status).toBe(400);
    expect(setCookie(response)).toBeNull();
  });
});

describe("time zone", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("every canonical value is a valid IANA zone", () => {
    for (const zone of NAJM_TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone }), zone).not.toThrow();
      expect(
        new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone,
      ).toBeTruthy();
    }
  });

  test("the input offers exactly the zones the handler accepts", async () => {
    // The mismatch this whole module exists to prevent: a zone in the dropdown
    // that the server rejects. Both sides are read here, not copied.
    expect(timeZoneItems.map((item) => item.value)).toEqual([...NAJM_TIME_ZONES]);

    for (const item of timeZoneItems) {
      const response = await preferences.handlers.timeZone(post({ timeZone: item.value }));
      expect(response.status, item.value).toBe(200);
      expect(await response.json()).toEqual({ timeZone: item.value });
    }
  });

  test("resolves every canonical zone from the cookie", () => {
    for (const zone of NAJM_TIME_ZONES) {
      expect(preferences.resolve(cookieReader({ "najm-ui-timezone": zone })).timeZone).toBe(zone);
    }
  });

  test("falls back to the default for values outside the list", () => {
    for (const stored of ["", "Mars/Olympus", "utc", "Europe/Casablanca"]) {
      expect(preferences.resolve(cookieReader({ "najm-ui-timezone": stored })).timeZone).toBe("UTC");
    }
  });

  test("rejects unknown, empty, and non-string values without a cookie", async () => {
    for (const timeZone of ["Mars/Olympus", "", null, 42, ["UTC"]]) {
      const response = await preferences.handlers.timeZone(post({ timeZone }));

      expect(response.status).toBe(400);
      expect(setCookie(response)).toBeNull();
      expect(await response.json()).toEqual({ message: "Unsupported time zone." });
    }
  });

  test("a custom list narrows both the handler and the resolver", async () => {
    // The escape hatch, for an application that also passes matching `items`
    // to `TimeZoneInput`. It must not weaken the default contract.
    const scoped = defineNajmPreferences({
      i18n,
      timeZones: ["Europe/Paris", "Africa/Casablanca"] as const,
      defaultTimeZone: "Africa/Casablanca",
    });

    expect(scoped.timeZones).toEqual(["Europe/Paris", "Africa/Casablanca"]);
    expect(await (await scoped.handlers.timeZone(post({ timeZone: "Europe/Paris" }))).json()).toEqual(
      { timeZone: "Europe/Paris" },
    );

    // In the canonical list, absent from this one.
    const rejected = await scoped.handlers.timeZone(post({ timeZone: "Asia/Tokyo" }));
    expect(rejected.status).toBe(400);
    expect(scoped.resolve(cookieReader({ "najm-ui-timezone": "Asia/Tokyo" })).timeZone).toBe(
      "Africa/Casablanca",
    );
  });

  test("a narrowed list without UTC defaults to its own first zone", () => {
    const scoped = defineNajmPreferences({ i18n, timeZones: ["Asia/Tokyo", "Europe/Paris"] as const });
    expect(scoped.defaultTimeZone).toBe("Asia/Tokyo");
  });

  test("a default outside the configured list is a configuration error", () => {
    expect(() =>
      defineNajmPreferences({
        i18n,
        timeZones: ["Europe/Paris"] as const,
        // @ts-expect-error — `NoInfer` keeps the list authoritative, so this is
        // a type error as well as the runtime throw asserted below.
        defaultTimeZone: "Asia/Tokyo",
      }),
    ).toThrow(/not one of the configured zones/);
    expect(() => defineNajmPreferences({ i18n, timeZones: [] as const })).toThrow(
      /at least one zone/,
    );
  });
});

describe("language", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("accepts every supported language", async () => {
    for (const language of i18n.supportedLanguages) {
      const response = await preferences.handlers.language(post({ language }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ language });
      expect(setCookie(response)).toContain(`najm-ui-language=${language}`);
    }
  });

  test("rejects an unsupported language instead of normalizing it into a cookie", async () => {
    // The bug validation-before-normalization prevents: `normalizeLanguage`
    // answers `en` for anything, so a normalize-first handler would happily
    // store `en` and report success for a language it does not have.
    const response = await preferences.handlers.language(post({ language: "klingon" }));

    expect(response.status).toBe(400);
    expect(setCookie(response)).toBeNull();
    expect(await response.json()).toEqual({ message: "Unsupported language." });
  });

  test("resolution prefers the cookie, then the fallback, then the default", () => {
    const withCookie = preferences.resolve(cookieReader({ "najm-ui-language": "fr" }), {
      languageFallback: "ar",
    });
    expect(withCookie.language).toBe("fr");

    const withFallback = preferences.resolve(cookieReader({}), { languageFallback: "ar" });
    expect(withFallback.language).toBe("ar");

    expect(preferences.resolve(cookieReader({})).language).toBe("en");
  });

  test("an invalid cookie falls through to the fallback, not to the stale value", () => {
    const resolved = preferences.resolve(cookieReader({ "najm-ui-language": "klingon" }), {
      languageFallback: "fr",
    });
    expect(resolved.language).toBe("fr");

    const noFallback = preferences.resolve(cookieReader({ "najm-ui-language": "klingon" }));
    expect(noFallback.language).toBe("en");
  });

  test("an unusable fallback lands on the catalog default", () => {
    for (const fallback of [null, undefined, 42, "klingon", {}]) {
      expect(preferences.resolve(cookieReader({}), { languageFallback: fallback }).language).toBe(
        "en",
      );
    }
  });
});

describe("request bodies", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("malformed JSON is a controlled 400, not an unhandled throw", async () => {
    for (const raw of ["{", "", "not json", "[1,2,3]", "null", '"dark"']) {
      const response = await preferences.handlers.theme(post(undefined, raw));

      expect(response.status, raw).toBe(400);
      expect(setCookie(response)).toBeNull();
    }
  });

  test("a missing field is rejected like an invalid one", async () => {
    const response = await preferences.handlers.timeZone(post({ zone: "UTC" }));
    expect(response.status).toBe(400);
    expect(setCookie(response)).toBeNull();
  });

  test("no rejection echoes the submitted value", async () => {
    const secret = "Mars/Olympus-90d1f0a4";
    const response = await preferences.handlers.timeZone(post({ timeZone: secret }));

    expect(await response.text()).not.toContain(secret);
  });
});

describe("cookie configuration", () => {
  test("names and options are overridden per key, keeping every other default", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      defaultTimeZone: "Africa/Casablanca",
      cookieNames: {
        language: "app-ui-language",
        theme: "app-ui-theme",
        timeZone: "app-ui-timezone",
      },
      cookieOptions: { secure: true, sameSite: "strict" },
    });

    expect(preferences.cookieNames.theme).toBe("app-ui-theme");
    expect(preferences.cookieOptions).toEqual({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
    // Overriding the zone default did not narrow the canonical list — at
    // runtime *or* in the inferred type. A definition typed as accepting only
    // its own default would fail on every other zone the input still offers.
    expect(preferences.timeZones).toEqual([...NAJM_TIME_ZONES]);
    const inferred: NajmPreferenceTimeZone<typeof preferences> = "Asia/Tokyo";
    expect(preferences.resolve(cookieReader({ "app-ui-timezone": inferred })).timeZone).toBe(
      "Asia/Tokyo",
    );
    expect(preferences.defaultTheme).toBe("light");

    const response = await preferences.handlers.theme(post({ theme: "dark" }));
    expect(setCookie(response)).toBe(
      "app-ui-theme=dark; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict",
    );
  });

  test("the serialized attributes match the configured options", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      cookieOptions: { secure: true, maxAge: 60, path: "/app", domain: "example.test" },
    });

    const response = await preferences.handlers.theme(post({ theme: "light" }));
    expect(setCookie(response)).toBe(
      "najm-ui-theme=light; Path=/app; Max-Age=60; Domain=example.test; HttpOnly; Secure; SameSite=Lax",
    );
  });

  test("a resolver reads back exactly what a handler wrote", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      cookieNames: { theme: "app-ui-theme" },
    });

    const written = setCookie(await preferences.handlers.theme(post({ theme: "dark" })))!;
    const [pair] = written.split("; ");
    const [name, value] = pair!.split("=");

    expect(preferences.resolve(cookieReader({ [name!]: value! })).theme).toBe("dark");
  });

  test("an invalid default theme is a configuration error", () => {
    expect(() =>
      // @ts-expect-error — the type rejects it too; this proves the runtime does.
      defineNajmPreferences({ i18n, defaultTheme: "system" }),
    ).toThrow(/not a supported mode/);
  });
});

describe("immutability", () => {
  const preferences = defineNajmPreferences({ i18n });

  test("configuration and cookie options cannot be mutated by a consumer", () => {
    expect(Object.isFrozen(preferences)).toBe(true);
    expect(Object.isFrozen(preferences.cookieNames)).toBe(true);
    expect(Object.isFrozen(preferences.cookieOptions)).toBe(true);
    expect(Object.isFrozen(preferences.timeZones)).toBe(true);
    expect(Object.isFrozen(preferences.handlers)).toBe(true);
  });

  test("a caller's own list is copied, not captured", () => {
    const mine: string[] = ["Europe/Paris", "Asia/Tokyo"];
    const scoped = defineNajmPreferences({ i18n, timeZones: mine });

    mine.push("Mars/Olympus");
    expect(scoped.timeZones).toEqual(["Europe/Paris", "Asia/Tokyo"]);
  });
});
