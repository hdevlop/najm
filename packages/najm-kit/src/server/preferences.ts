// ============================================================================
// najm-kit/server — language, theme, and time-zone preferences
// ============================================================================
//
// Every Najm application writes the same four files: three route handlers that
// each parse a JSON body, validate one value, set one cookie, and answer 400
// otherwise, plus a root layout that reads those three cookies back and
// normalizes them before the first paint. Written per app they drift — one
// forgets `HttpOnly`, another writes the cookie before validating, a third
// keeps a hand-maintained time-zone allow-list that rejects zones its own
// `TimeZoneInput` offers.
//
// This is that code, once, as configuration:
//
// ```ts
// // src/preferences.ts
// export const preferences = defineNajmPreferences({ i18n: appI18n });
//
// // src/app/api/ui-theme/route.ts
// export const POST = preferences.handlers.theme;
//
// // src/app/layout.tsx
// const { language, theme, timeZone } = preferences.resolve(await cookies(), {
//   languageFallback: session?.user.language,
// });
// ```
//
// Convention-first: `light`, the two theme modes, `UTC`, the canonical zone
// list, the `najm-ui-*` cookie names, the cookie attributes, and the request
// field names are all defaults. An application states only what genuinely
// differs — usually its i18n definition and nothing else.
//
// No React, no Next.js, no Node built-in: Web `Request`/`Response` and a
// structural cookie reader, so this runs in a route handler, an edge function,
// or a test with a hand-built `Request`.
// ============================================================================

import { NAJM_DEFAULT_TIME_ZONE, NAJM_TIME_ZONES, type NajmTimeZone } from "../lib/timeZones";
import type { NajmMode } from "../theme/types";

/** The theme modes a user can choose. Design tokens are not a user preference. */
const THEME_MODES: readonly NajmMode[] = ["light", "dark"];

const DEFAULT_THEME: NajmMode = "light";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * The part of an i18n definition this contract needs.
 *
 * Structural on purpose: `najm-i18n` is an *optional* peer of this package, and
 * a preference handler must not be the reason a consumer has to install it. A
 * `najm-i18n` definition satisfies this shape as it is.
 */
export interface NajmPreferenceI18n<Language extends string = string> {
  readonly supportedLanguages: readonly Language[];
  readonly defaultLanguage: Language;
  normalizeLanguage(value: unknown): Language;
}

/** Cookie names, one per preference. */
export interface NajmPreferenceCookieNames {
  language: string;
  theme: string;
  timeZone: string;
}

/**
 * Cookie attributes, applied to all three.
 *
 * `httpOnly` is the default because nothing in the browser reads these back —
 * the client provider holds the value it just set, and the server reads the
 * cookie. `secure` is left unset by default rather than `true`: these cookies
 * must survive `http://localhost`, and a deployment terminating TLS at the
 * edge sees no difference. Applications serving only HTTPS should set it.
 */
export interface NajmPreferenceCookieOptions {
  httpOnly: boolean;
  maxAge: number;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure?: boolean;
  domain?: string;
}

const DEFAULT_COOKIE_NAMES: NajmPreferenceCookieNames = {
  language: "najm-ui-language",
  theme: "najm-ui-theme",
  timeZone: "najm-ui-timezone",
};

const DEFAULT_COOKIE_OPTIONS: NajmPreferenceCookieOptions = {
  httpOnly: true,
  maxAge: ONE_YEAR_IN_SECONDS,
  path: "/",
  sameSite: "lax",
};

/**
 * Anything shaped like Next's cookie store.
 *
 * Structural rather than an import: this file must stay free of `next`, and a
 * test can pass `{ get: (name) => ... }` without building a request.
 */
export interface NajmCookieReader {
  get(name: string): { value: string } | undefined;
}

export interface NajmPreferenceSnapshot<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
> {
  language: Language;
  theme: NajmMode;
  timeZone: TimeZone;
}

export interface NajmPreferenceResolveOptions {
  /**
   * Used only when the language cookie is absent or holds an unsupported
   * value — a signed-in user's stored language, typically. Never overrides a
   * valid cookie: the cookie is what the user last chose in this browser.
   */
  languageFallback?: unknown;
}

/** A route handler, ready to `export const POST = ...`. */
export type NajmPreferenceHandler = (request: Request) => Promise<Response>;

export interface NajmPreferenceHandlers {
  /** Reads `{ language }`. */
  language: NajmPreferenceHandler;
  /** Reads `{ theme }`. */
  theme: NajmPreferenceHandler;
  /** Reads `{ timeZone }`. */
  timeZone: NajmPreferenceHandler;
}

export interface NajmPreferencesConfig<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
> {
  /** The application's catalog definition. The one required field. */
  i18n: NajmPreferenceI18n<Language>;
  /**
   * Zones this application accepts. Defaults to the canonical list that
   * `TimeZoneInput` offers.
   *
   * Pass this *only* alongside a matching `items` on the input. Two lists that
   * disagree is the bug the shared default exists to prevent.
   */
  timeZones?: readonly TimeZone[];
  /**
   * Defaults to `UTC`, or to the first configured zone if `UTC` is not in it.
   *
   * `NoInfer` so this field cannot narrow `TimeZone`. Without it, an
   * application that names `Africa/Casablanca` and takes the canonical list
   * gets a definition typed as accepting *only* Casablanca — the opposite of
   * what it configured, and a type error at every other zone downstream.
   */
  defaultTimeZone?: NoInfer<TimeZone>;
  /** Defaults to `light`. */
  defaultTheme?: NajmMode;
  /** Merged over the `najm-ui-*` defaults, per key. */
  cookieNames?: Partial<NajmPreferenceCookieNames>;
  /** Merged over the secure defaults, per key. */
  cookieOptions?: Partial<NajmPreferenceCookieOptions>;
  /** Body field names, if this application's client posts something else. */
  fields?: Partial<Record<"language" | "theme" | "timeZone", string>>;
  /** Rejection messages, per preference. The defaults are generic and safe. */
  messages?: Partial<Record<"language" | "theme" | "timeZone", string>>;
}

export interface NajmPreferences<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
> {
  readonly cookieNames: Readonly<NajmPreferenceCookieNames>;
  readonly cookieOptions: Readonly<NajmPreferenceCookieOptions>;
  readonly timeZones: readonly TimeZone[];
  readonly defaultTimeZone: TimeZone;
  readonly defaultTheme: NajmMode;
  readonly defaultLanguage: Language;
  /** Every preference for this request, resolved from cookies. */
  resolve(
    cookies: NajmCookieReader,
    options?: NajmPreferenceResolveOptions,
  ): NajmPreferenceSnapshot<Language, TimeZone>;
  handlers: NajmPreferenceHandlers;
}

/** The language of a configured definition, so applications alias nothing. */
export type NajmPreferenceLanguage<P> =
  P extends NajmPreferences<infer Language, string> ? Language : never;

/** The time zone of a configured definition. */
export type NajmPreferenceTimeZone<P> =
  P extends NajmPreferences<string, infer TimeZone> ? TimeZone : never;

const COOKIE_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;
const COOKIE_VALUE_PATTERN = /^[A-Za-z0-9!#$%&'()*+\-./:<=>?@[\]^_`|~]*$/;

/**
 * A `Set-Cookie` value.
 *
 * The value is never percent-encoded, and does not need to be: everything
 * reaching this function has already passed an allow-list of language tags,
 * `light` / `dark`, or IANA zone identifiers. Encoding would change the bytes
 * the layout reads back and silently invalidate cookies already in the wild.
 * The patterns guard a future allow-list that admits something exotic.
 */
function serializeCookie(
  name: string,
  value: string,
  options: NajmPreferenceCookieOptions,
): string {
  if (!COOKIE_NAME_PATTERN.test(name) || !COOKIE_VALUE_PATTERN.test(value)) {
    throw new Error("najm-kit/server: refusing to serialize an unsafe preference cookie");
  }

  const parts = [`${name}=${value}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite[0]!.toUpperCase()}${options.sameSite.slice(1)}`);
  return parts.join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The posted field, or `undefined`.
 *
 * Malformed JSON, a non-object body, and a missing field are all the same
 * answer — an unsupported value — and all end in the same 400. Nothing from
 * the body reaches the response, a log, or an error message.
 */
async function readField(request: Request, field: string): Promise<unknown> {
  const body: unknown = await request.json().catch(() => null);
  return isRecord(body) ? body[field] : undefined;
}

function rejection(message: string): Response {
  return Response.json({ message }, { status: 400 });
}

function accepted(field: string, value: string, cookie: string): Response {
  return Response.json({ [field]: value }, { headers: { "Set-Cookie": cookie } });
}

/**
 * Configures the preference contract for one application.
 *
 * @example Zero configuration beyond the catalog
 * ```ts
 * export const preferences = defineNajmPreferences({ i18n: appI18n });
 * ```
 *
 * @example An application with published cookie names to keep
 * ```ts
 * export const preferences = defineNajmPreferences({
 *   i18n: appI18n,
 *   defaultTimeZone: "Africa/Casablanca",
 *   cookieNames: {
 *     language: "app-ui-language",
 *     theme: "app-ui-theme",
 *     timeZone: "app-ui-timezone",
 *   },
 * });
 * ```
 */
export function defineNajmPreferences<
  Language extends string,
  const TimeZone extends string = NajmTimeZone,
>(config: NajmPreferencesConfig<Language, TimeZone>): NajmPreferences<Language, TimeZone> {
  const { i18n } = config;

  const timeZones = Object.freeze([
    ...(config.timeZones ?? (NAJM_TIME_ZONES as readonly string[] as readonly TimeZone[])),
  ]);
  if (timeZones.length === 0) {
    throw new Error("najm-kit/server: `timeZones` must list at least one zone");
  }

  const timeZoneSet: ReadonlySet<string> = new Set(timeZones);

  // `UTC` is the package default, but an application that narrowed the list
  // without it would otherwise get a default it rejects on the very next POST.
  const fallbackTimeZone = (
    timeZoneSet.has(NAJM_DEFAULT_TIME_ZONE) ? NAJM_DEFAULT_TIME_ZONE : timeZones[0]
  ) as TimeZone;
  const defaultTimeZone = config.defaultTimeZone ?? fallbackTimeZone;
  if (!timeZoneSet.has(defaultTimeZone)) {
    throw new Error(
      `najm-kit/server: default time zone "${defaultTimeZone}" is not one of the configured zones`,
    );
  }

  const defaultTheme = config.defaultTheme ?? DEFAULT_THEME;
  if (!THEME_MODES.includes(defaultTheme)) {
    throw new Error(`najm-kit/server: default theme "${defaultTheme}" is not a supported mode`);
  }

  const cookieNames = Object.freeze({ ...DEFAULT_COOKIE_NAMES, ...config.cookieNames });
  const cookieOptions = Object.freeze({ ...DEFAULT_COOKIE_OPTIONS, ...config.cookieOptions });

  const fields = {
    language: config.fields?.language ?? "language",
    theme: config.fields?.theme ?? "theme",
    timeZone: config.fields?.timeZone ?? "timeZone",
  };

  const messages = {
    language: config.messages?.language ?? "Unsupported language.",
    theme: config.messages?.theme ?? "Unsupported theme.",
    timeZone: config.messages?.timeZone ?? "Unsupported time zone.",
  };

  const isTheme = (value: unknown): value is NajmMode =>
    typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);

  const isTimeZone = (value: unknown): value is TimeZone =>
    typeof value === "string" && timeZoneSet.has(value);

  const isLanguage = (value: unknown): value is Language =>
    typeof value === "string" && (i18n.supportedLanguages as readonly string[]).includes(value);

  function resolve(
    cookies: NajmCookieReader,
    options: NajmPreferenceResolveOptions = {},
  ): NajmPreferenceSnapshot<Language, TimeZone> {
    // The cookie wins whenever it is valid; the fallback covers a first visit
    // on a new device, where a signed-in user's stored language beats the
    // catalog default. An invalid cookie falls through to the same path as a
    // missing one, so a stale value from a dropped locale cannot pin the UI.
    const languageCookie = cookies.get(cookieNames.language)?.value;
    const language = isLanguage(languageCookie)
      ? languageCookie
      : i18n.normalizeLanguage(options.languageFallback);

    const themeCookie = cookies.get(cookieNames.theme)?.value;
    const timeZoneCookie = cookies.get(cookieNames.timeZone)?.value;

    return {
      language,
      theme: isTheme(themeCookie) ? themeCookie : defaultTheme,
      timeZone: isTimeZone(timeZoneCookie) ? timeZoneCookie : defaultTimeZone,
    };
  }

  const handlers: NajmPreferenceHandlers = {
    async language(request) {
      const value = await readField(request, fields.language);
      // Validated before normalization: `normalizeLanguage` answers with the
      // default for anything at all, so normalizing first would quietly accept
      // `{ language: "klingon" }` and write `en` into the cookie.
      if (!isLanguage(value)) return rejection(messages.language);
      const language = i18n.normalizeLanguage(value);
      return accepted(
        fields.language,
        language,
        serializeCookie(cookieNames.language, language, cookieOptions),
      );
    },

    async theme(request) {
      const value = await readField(request, fields.theme);
      if (!isTheme(value)) return rejection(messages.theme);
      return accepted(fields.theme, value, serializeCookie(cookieNames.theme, value, cookieOptions));
    },

    async timeZone(request) {
      const value = await readField(request, fields.timeZone);
      if (!isTimeZone(value)) return rejection(messages.timeZone);
      return accepted(
        fields.timeZone,
        value,
        serializeCookie(cookieNames.timeZone, value, cookieOptions),
      );
    },
  };

  return Object.freeze({
    cookieNames,
    cookieOptions,
    timeZones,
    defaultTimeZone,
    defaultTheme,
    defaultLanguage: i18n.defaultLanguage,
    resolve,
    handlers: Object.freeze(handlers),
  });
}
