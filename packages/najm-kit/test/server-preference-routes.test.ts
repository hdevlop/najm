import { describe, expect, test } from "bun:test";

import {
  defineNajmPreferences,
  type NajmCookieReader,
  type NajmPreferenceI18n,
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

const i18n = fakeI18n(["en", "fr", "ar", "es"] as const, "en");

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

function del(): Request {
  return new Request("https://example.test/api/preference", { method: "DELETE" });
}

function setCookie(response: Response): string | null {
  return response.headers.get("set-cookie");
}

describe("preference routes — POST compatibility", () => {
  test("routes.POST is the same handler as handlers (exact POST properties preserved)", async () => {
    const preferences = defineNajmPreferences({ i18n });

    expect(preferences.routes.language.POST).toBe(preferences.handlers.language);
    expect(preferences.routes.theme.POST).toBe(preferences.handlers.theme);
    expect(preferences.routes.timeZone.POST).toBe(preferences.handlers.timeZone);

    const response = await preferences.routes.theme.POST(post({ theme: "dark" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ theme: "dark" });
    expect(setCookie(response)).toBe(
      "najm-ui-theme=dark; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax",
    );
  });

  test("custom School names, options, fields, and messages are honored on POST", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      cookieNames: {
        language: "school-ui-language",
        theme: "school-ui-theme",
        timeZone: "school-ui-timezone",
      },
      cookieOptions: { secure: true, sameSite: "strict" },
      messages: {
        language: "Unsupported language.",
        theme: "Unsupported color theme.",
        timeZone: "Unsupported time zone.",
      },
    });

    const ok = await preferences.routes.theme.POST(post({ theme: "dark" }));
    expect(ok.status).toBe(200);
    expect(setCookie(ok)).toBe(
      "school-ui-theme=dark; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict",
    );

    const rejected = await preferences.routes.theme.POST(post({ theme: "system" }));
    expect(rejected.status).toBe(400);
    expect(setCookie(rejected)).toBeNull();
    expect(await rejected.json()).toEqual({ message: "Unsupported color theme." });

    const rejectedLanguage = await preferences.routes.language.POST(post({ language: "klingon" }));
    expect(rejectedLanguage.status).toBe(400);
    expect(await rejectedLanguage.json()).toEqual({ message: "Unsupported language." });

    const rejectedZone = await preferences.routes.timeZone.POST(post({ timeZone: "Mars/Olympus" }));
    expect(rejectedZone.status).toBe(400);
    expect(await rejectedZone.json()).toEqual({ message: "Unsupported time zone." });
  });

  test("malformed bodies are controlled 400s without a cookie", async () => {
    const preferences = defineNajmPreferences({ i18n });
    for (const raw of ["{", "", "not json", "[1,2,3]", "null", '"dark"']) {
      const response = await preferences.routes.theme.POST(post(undefined, raw));
      expect(response.status, raw).toBe(400);
      expect(setCookie(response)).toBeNull();
    }
  });
});

describe("preference routes — DELETE compatibility", () => {
  test("DELETE answers { cleared: true } and expires the matching cookie", async () => {
    const preferences = defineNajmPreferences({ i18n });

    for (const field of ["language", "theme", "timeZone"] as const) {
      const response = await preferences.routes[field].DELETE(del());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ cleared: true });

      const cookie = setCookie(response)!;
      const expectedName =
        field === "language"
          ? "najm-ui-language"
          : field === "theme"
            ? "najm-ui-theme"
            : "najm-ui-timezone";
      expect(cookie.startsWith(`${expectedName}=;`)).toBe(true);
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    }
  });

  test("DELETE carries custom School names and cookie attributes", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      cookieNames: {
        language: "school-ui-language",
        theme: "school-ui-theme",
        timeZone: "school-ui-timezone",
      },
      cookieOptions: { secure: true, sameSite: "strict", path: "/app", domain: "example.test" },
    });

    const response = await preferences.routes.theme.DELETE(del());
    const cookie = setCookie(response)!;
    expect(cookie.startsWith("school-ui-theme=;")).toBe(true);
    expect(cookie).toContain("Path=/app");
    expect(cookie).toContain("Domain=example.test");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=0");
  });

  test("DELETE is stable without a cookie present and never echoes a body", async () => {
    const preferences = defineNajmPreferences({ i18n });
    const response = await preferences.routes.language.DELETE(
      new Request("https://example.test/api/preference", { method: "DELETE" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cleared: true });
    expect(setCookie(response)).toContain("najm-ui-language=;");
  });

  test("a resolver still reads what POST wrote, and DELETE clears the same name", async () => {
    const preferences = defineNajmPreferences({
      i18n,
      cookieNames: { theme: "school-ui-theme" },
    });
    const written = setCookie(await preferences.routes.theme.POST(post({ theme: "dark" })))!;
    const [pair] = written.split("; ");
    const [name, value] = pair!.split("=")!;
    expect(preferences.resolve(cookieReader({ [name!]: value! })).theme).toBe("dark");

    const cleared = setCookie(await preferences.routes.theme.DELETE(del()))!;
    expect(cleared.startsWith("school-ui-theme=;")).toBe(true);
  });
});
