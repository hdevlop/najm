/**
 * Shared Kafil-style and School-style server-app fixtures.
 *
 * One builder, two policies — never a duplicated loader/resolver. Both
 * fixtures compose the same `createNajmServerApp` with different session
 * failure policies and preference orders:
 *
 * - Kafil-style: cookie → user → Accept-Language → default for language;
 *   theme/timeZone fall back to configured defaults; settings projection is
 *   `{ enabled: boolean }` with `{ enabled: false }` fallback; session
 *   failures resolve to anonymous via a nullable auth stub (mirroring the
 *   current Kafil layout catch-all, mapped to explicit classification here).
 * - School-style: cookie → user → institution → fallback per field;
 *   currency institution-only; settings projection is the UI settings shape
 *   (or `null` when unavailable); operational auth failures propagate via a
 *   strict auth stub (mirroring the current School layout propagation).
 *
 * Structural only: no `najm-auth`, `najm-kit`, `najm-theme`, backend, or
 * Next import. Guards mirror the Kit contract (valid-first, invalid-skip)
 * without adding a runtime dependency, keeping `najm-next/app/server`
 * dependency-free.
 */

import { createNajmServerApp, type NajmServerApp } from "../src/app/server";
import { buildKafilStyleApp, buildSchoolStyleApp } from "./apps";

export interface FixtureSession {
  readonly user: { readonly language?: unknown; readonly theme?: unknown; readonly timeZone?: unknown };
  readonly roles?: readonly string[];
}

export interface KafilStyleSettings {
  readonly enabled: boolean;
}

export interface SchoolStyleSettings {
  readonly schoolName: string;
  readonly language: string;
  readonly theme: string;
  readonly timeZone: string;
  readonly currency: string;
}

export interface FixturePreferences {
  readonly language: string;
  readonly theme: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly direction: "ltr" | "rtl";
  readonly locale: string;
}

export interface FixtureAppearance {
  readonly revision: number;
}

export interface FixtureBranding {
  readonly logo: string;
}

const KAFIL_LANGUAGES = ["en", "fr", "ar", "es"] as const;
const SCHOOL_LANGUAGES = ["en", "fr", "ar", "es"] as const;
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

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function firstValid<T>(candidates: readonly unknown[], guard: (v: unknown) => v is T, fallback: T): T {
  for (const candidate of candidates) {
    if (guard(candidate)) return candidate;
  }
  return fallback;
}

function lookupAcceptLanguage(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const entry of header.split(",")) {
    const [range] = entry.split(";");
    const tag = range?.trim().toLowerCase() ?? "";
    if (!tag || tag.startsWith("*")) continue;
    const base = tag.split("-")[0]!;
    const match = (SCHOOL_LANGUAGES as readonly string[]).find(
      (language) => language === tag || language === base,
    );
    if (match) return match;
  }
  return undefined;
}

export class OperationalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OperationalError";
    this.code = code;
  }
}

export interface FixtureCounters {
  session: number;
  cookies: number;
  headers: number;
  appearance: number;
  branding: number;
  settings: number;
}

export function createCounters(): FixtureCounters {
  return { session: 0, cookies: 0, headers: 0, appearance: 0, branding: 0, settings: 0 };
}

export interface FixtureBackend {
  session: FixtureSession | null;
  sessionError?: unknown;
  cookies: Record<string, string>;
  acceptLanguage?: string | null;
  appearance: FixtureAppearance;
  appearanceError?: unknown;
  branding: FixtureBranding;
  brandingError?: unknown;
  kafilSettings: KafilStyleSettings;
  kafilSettingsError?: unknown;
  schoolSettings: SchoolStyleSettings | null;
  schoolSettingsError?: unknown;
}

export type FixtureStyle = "kafil" | "school";

export type FixtureServerApp =
  | NajmServerApp<KafilStyleSettings, FixturePreferences, FixtureAppearance, FixtureBranding>
  | NajmServerApp<
      SchoolStyleSettings | null,
      FixturePreferences,
      FixtureAppearance,
      FixtureBranding
    >;

/**
 * The single composed builder. Both styles share every line below; only the
 * policy inputs differ.
 */
export function createFixtureServerApp(
  style: FixtureStyle,
  backend: FixtureBackend,
  counters: FixtureCounters,
  diagnostics: { code: string; detail?: string }[],
): FixtureServerApp {
  const app = style === "kafil" ? buildKafilStyleApp() : buildSchoolStyleApp();

  const auth = {
    async getSession() {
      counters.session += 1;
      if (backend.sessionError !== undefined) {
        if (style === "kafil") return null;
        throw backend.sessionError;
      }
      // Fresh object per read, like a real cookie verification — never a
      // shared reference callers could mutate across requests.
      return backend.session ? structuredClone(backend.session) : null;
    },
    async requireSession() {
      counters.session += 1;
      if (backend.session) return structuredClone(backend.session);
      if (backend.sessionError !== undefined) throw backend.sessionError;
      throw new OperationalError("NO_SESSION", "No active session");
    },
    async requireRole(roles: readonly string[]) {
      counters.session += 1;
      if (backend.sessionError !== undefined) {
        if (style === "kafil" && backend.session === null) {
          throw new OperationalError("NO_SESSION", "No active session");
        }
        throw backend.sessionError;
      }
      if (!backend.session) throw new OperationalError("NO_SESSION", "No active session");
      const held = backend.session.roles ?? [];
      if (!held.some((role) => (roles as readonly string[]).includes(role))) {
        throw new OperationalError("FORBIDDEN", "Missing role");
      }
      return structuredClone(backend.session);
    },
  };

  const theme = {
    async loadAppearance(): Promise<FixtureAppearance> {
      counters.appearance += 1;
      if (backend.appearanceError !== undefined) throw backend.appearanceError;
      return structuredClone(backend.appearance);
    },
    async loadBranding(): Promise<FixtureBranding> {
      counters.branding += 1;
      if (backend.brandingError !== undefined) throw backend.brandingError;
      return structuredClone(backend.branding);
    },
  };

  const readCookies = async () => {
    counters.cookies += 1;
    const store = backend.cookies;
    return {
      get: (name: string) =>
        name in store ? { value: store[name]! } : undefined,
    };
  };

  const readHeaders = async () => {
    counters.headers += 1;
    const acceptLanguage = backend.acceptLanguage ?? null;
    return {
      get: (name: string) =>
        name.toLowerCase() === "accept-language" ? acceptLanguage : null,
    };
  };

  if (style === "kafil") {
    return createNajmServerApp<KafilStyleSettings, FixturePreferences, FixtureAppearance, FixtureBranding>({
      app,
      auth,
      theme,
      readSettings: async () => {
        counters.settings += 1;
        if (backend.kafilSettingsError !== undefined) throw backend.kafilSettingsError;
        return structuredClone(backend.kafilSettings);
      },
      fallbackSettings: { enabled: false },
      readCookies,
      readHeaders,
      onDiagnostic: (diagnostic) => diagnostics.push({ ...diagnostic }),
      resolvePreferences: ({ cookies, session, settings }) => {
        const user = session?.user as
          | { language?: unknown; theme?: unknown; timeZone?: unknown }
          | undefined;
        const languageCookie = cookies.get("kafil-ui-language")?.value;
        const language = firstValid(
          [
            languageCookie,
            user?.language,
            lookupAcceptLanguage(backend.acceptLanguage),
          ],
          (value): value is string => isOneOf(value, KAFIL_LANGUAGES),
          "en",
        );
        const themeCookie = cookies.get("kafil-ui-theme")?.value;
        const themeValue = firstValid(
          [themeCookie],
          (value): value is string => value === "light" || value === "dark",
          "light",
        );
        const timeZoneCookie = cookies.get("kafil-ui-timezone")?.value;
        const timeZone = firstValid(
          [timeZoneCookie],
          (value): value is string => typeof value === "string" && value.length > 0,
          "Africa/Casablanca",
        );
        void settings;
        return {
          language,
          theme: themeValue,
          timeZone,
          currency: "MAD",
          direction: language === "ar" ? ("rtl" as const) : ("ltr" as const),
          locale: `${language}-MA`,
        };
      },
    });
  }

  return createNajmServerApp<
    SchoolStyleSettings | null,
    FixturePreferences,
    FixtureAppearance,
    FixtureBranding
  >({
    app,
    auth,
    theme,
    readSettings: async () => {
      counters.settings += 1;
      if (backend.schoolSettingsError !== undefined) throw backend.schoolSettingsError;
      return backend.schoolSettings ? structuredClone(backend.schoolSettings) : null;
    },
    fallbackSettings: null,
    readCookies,
    readHeaders,
    onDiagnostic: (diagnostic) => diagnostics.push({ ...diagnostic }),
    resolvePreferences: ({ cookies, session, settings }) => {
      const user = session?.user as
        | { language?: unknown; theme?: unknown; timeZone?: unknown }
        | undefined;
      const language = firstValid(
        [cookies.get("school-ui-language")?.value, user?.language, settings?.language],
        (value): value is string => isOneOf(value, SCHOOL_LANGUAGES),
        "en",
      );
      const themeValue = firstValid(
        [cookies.get("school-ui-theme")?.value, user?.theme, settings?.theme],
        (value): value is string => value === "light" || value === "dark",
        "light",
      );
      const timeZone = firstValid(
        [cookies.get("school-ui-timezone")?.value, user?.timeZone, settings?.timeZone],
        (value): value is string => isOneOf(value, SCHOOL_TIME_ZONES),
        "Africa/Casablanca",
      );
      const currency = firstValid(
        [settings?.currency],
        (value): value is string => isOneOf(value, SCHOOL_CURRENCIES),
        "MAD",
      );
      return {
        language,
        theme: themeValue,
        timeZone,
        currency,
        direction: language === "ar" ? ("rtl" as const) : ("ltr" as const),
        locale: `${language}-MA`,
      };
    },
  });
}

export function defaultBackend(overrides: Partial<FixtureBackend> = {}): FixtureBackend {
  return {
    session: null,
    cookies: {},
    acceptLanguage: null,
    appearance: { revision: 7 },
    branding: { logo: "/uploaded-logo.png" },
    kafilSettings: { enabled: true },
    schoolSettings: {
      schoolName: "Fixture School",
      language: "fr",
      theme: "light",
      timeZone: "Africa/Casablanca",
      currency: "MAD",
    },
    ...overrides,
  };
}
