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
//   acceptLanguage: (await headers()).get("accept-language"),
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
  /**
   * The raw `Accept-Language` request header. Used only after the language
   * cookie and `languageFallback`; quality weights and regional language tags
   * are matched against the application's supported languages.
   */
  acceptLanguage?: string | null;
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
  Currency extends string = never,
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
  /**
   * Currency codes this application accepts. Omit it entirely unless the
   * application resolves an institution-owned currency: legacy consumers
   * without a currency keep no currency state at all, and no package default
   * (no `MAD`, no locale-derived code) is invented for them. Currency stays
   * app-owned policy — this list only guards the institution values the
   * application explicitly passes to `resolveOrdered()`.
   *
   * Currency is institution-owned: it is never read from a cookie, a user
   * record, a locale, or an `Accept-Language` header. This list exists so a
   * corrupt or hand-edited institution row cannot reach money formatting,
   * where the failure mode is an amount rendered in the wrong currency.
   */
  currencies?: readonly Currency[];
  /**
   * Defaults to the first configured currency. Requires `currencies`.
   *
   * `NoInfer` for the same reason as `defaultTimeZone`: naming the default
   * must not narrow the accepted list.
   */
  defaultCurrency?: NoInfer<Currency>;
  /** Merged over the `najm-ui-*` defaults, per key. */
  cookieNames?: Partial<NajmPreferenceCookieNames>;
  /** Merged over the secure defaults, per key. */
  cookieOptions?: Partial<NajmPreferenceCookieOptions>;
  /** Body field names, if this application's client posts something else. */
  fields?: Partial<Record<"language" | "theme" | "timeZone", string>>;
  /** Rejection messages, per preference. The defaults are generic and safe. */
  messages?: Partial<Record<"language" | "theme" | "timeZone", string>>;
}

/**
 * One ordered preference source.
 *
 * `cookie` is the browser's most recent explicit choice, `user` the
 * authenticated user's stored value, `institution` the institution's default
 * (for example a school settings row), and `fallback` the typed application
 * default. Resolution tries each source in order and skips invalid
 * candidates — an unsupported value never wins the round.
 */
export type NajmPreferenceSource = "cookie" | "user" | "institution" | "fallback";

/**
 * A preference value together with the order its sources are tried in.
 *
 * Additive extension of the existing preference contract: the original
 * `resolve()` semantics are preserved unchanged, and this descriptor only
 * describes how `resolveOrdered()` walks the same guards.
 */
export interface NajmOrderedPreference<T> {
  readonly sources: readonly NajmPreferenceSource[];
  readonly guard: (value: unknown) => value is T;
  readonly fallback: T;
}

/**
 * Currency stays institution-owned.
 *
 * Refinement note on the frozen ledger sketch (§4.5): the ledger lists only
 * `sources: ["institution", "fallback"]` for currency, which alone cannot
 * resolve a value. This keeps that exact `sources` restriction and adds the
 * `guard` + `fallback` the resolver needs, so currency is expressible as
 * institution → fallback only and never derives from locale, cookie, or user.
 */
export interface NajmCurrencyPreference<T> {
  readonly sources: readonly ["institution", "fallback"];
  readonly guard: (value: unknown) => value is T;
  readonly fallback: T;
}

/**
 * The ordered descriptors for every preference.
 *
 * `currency` exists only when the application explicitly configured a
 * currency allowlist: legacy definitions carry no currency state, and
 * `resolveOrdered()` on such a definition returns no `currency` field.
 */
export type NajmInstitutionalPreferences<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
  Currency extends string = never,
> = {
  readonly language: NajmOrderedPreference<Language>;
  readonly theme: NajmOrderedPreference<NajmMode>;
  readonly timeZone: NajmOrderedPreference<TimeZone>;
} & ([Currency] extends [never]
  ? { readonly currency?: undefined }
  : { readonly currency: NajmCurrencyPreference<Currency> });

/** Per-request user values for ordered resolution. No currency: never user-owned. */
export interface NajmOrderedUserValues {
  readonly language?: unknown;
  readonly theme?: unknown;
  readonly timeZone?: unknown;
}

/** Per-request institution values for ordered resolution. */
export interface NajmOrderedInstitutionValues {
  readonly language?: unknown;
  readonly theme?: unknown;
  readonly timeZone?: unknown;
  readonly currency?: unknown;
}

/**
 * Independent per-field source orders.
 *
 * Each field walks its own list, so language can be
 * cookie → user → institution → fallback while currency stays fixed at
 * institution → fallback. Currency accepts no order override by type.
 */
export interface NajmOrderedPreferenceOrders {
  readonly language?: readonly NajmPreferenceSource[];
  readonly theme?: readonly NajmPreferenceSource[];
  readonly timeZone?: readonly NajmPreferenceSource[];
}

export interface NajmOrderedResolveInput {
  readonly user?: NajmOrderedUserValues;
  readonly institution?: NajmOrderedInstitutionValues;
  /**
   * The raw `Accept-Language` request header. Tried only at the language
   * `fallback` step, before the configured default — so Kafil keeps
   * cookie → user → Accept-Language → default while an institution caller
   * that passes no header keeps cookie → user → institution → default.
   */
  readonly acceptLanguage?: string | null;
  readonly orders?: NajmOrderedPreferenceOrders;
}

/**
 * Valid-first ordered resolution result.
 *
 * Without an explicitly configured currency the snapshot carries exactly the
 * three display fields; with one it additionally carries the
 * institution-only `currency`. Either way currency never derives from a
 * cookie, user value, locale, or `Accept-Language`.
 */
export type NajmOrderedPreferenceSnapshot<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
  Currency extends string = never,
> = [Currency] extends [never]
  ? {
      language: Language;
      theme: NajmMode;
      timeZone: TimeZone;
    }
  : {
      language: Language;
      theme: NajmMode;
      timeZone: TimeZone;
      currency: Currency;
    };

/** One preference's POST (write) and DELETE (clear) handlers. */
export interface NajmPreferenceRoute {
  readonly POST: NajmPreferenceHandler;
  readonly DELETE: NajmPreferenceHandler;
}

/**
 * POST and DELETE belong together in `najm-kit/server`.
 *
 * `handlers` (POST-only functions) are preserved for backward compatibility:
 * `routes.language.POST` is the same function as `handlers.language`.
 */
export interface NajmPreferenceRoutes {
  readonly language: NajmPreferenceRoute;
  readonly theme: NajmPreferenceRoute;
  readonly timeZone: NajmPreferenceRoute;
}

/** Where display-preference DELETEs are sent. Defaults to `/api/ui-*`. */
export interface NajmUiPreferenceEndpoints {
  readonly language: string;
  readonly theme: string;
  readonly timeZone: string;
}

export const NAJM_UI_PREFERENCE_ENDPOINTS: NajmUiPreferenceEndpoints = Object.freeze({
  language: "/api/ui-language",
  theme: "/api/ui-theme",
  timeZone: "/api/ui-timezone",
});

export interface NajmClearPreferencesOptions {
  readonly endpoints?: Partial<NajmUiPreferenceEndpoints>;
  /**
   * Injectable for tests. Defaults to the global `fetch`. Called once per
   * preference with `{ method: "DELETE", credentials: "same-origin" }`.
   */
  readonly fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface NajmPreferences<
  Language extends string = string,
  TimeZone extends string = NajmTimeZone,
  Currency extends string = never,
> {
  readonly cookieNames: Readonly<NajmPreferenceCookieNames>;
  readonly cookieOptions: Readonly<NajmPreferenceCookieOptions>;
  readonly timeZones: readonly TimeZone[];
  readonly defaultTimeZone: TimeZone;
  readonly defaultTheme: NajmMode;
  readonly defaultLanguage: Language;
  /**
   * Empty unless the application explicitly configured `currencies`.
   * Legacy definitions carry no currency state.
   */
  readonly currencies: readonly Currency[];
  /** `undefined` unless the application explicitly configured a currency. */
  readonly defaultCurrency: [Currency] extends [never] ? undefined : Currency;
  /** Every preference for this request, resolved from cookies. */
  resolve(
    cookies: NajmCookieReader,
    options?: NajmPreferenceResolveOptions,
  ): NajmPreferenceSnapshot<Language, TimeZone>;
  /**
   * Valid-first ordered resolution, independently per field.
   *
   * Skips invalid candidates; currency reads only the institution value and
   * never a cookie, user value, locale, or `Accept-Language`.
   */
  resolveOrdered(
    cookies: NajmCookieReader,
    input?: NajmOrderedResolveInput,
  ): NajmOrderedPreferenceSnapshot<Language, TimeZone, Currency>;
  /** Ordered descriptors (guards, fallbacks, default source orders). */
  readonly ordered: NajmInstitutionalPreferences<Language, TimeZone, Currency>;
  handlers: NajmPreferenceHandlers;
  routes: NajmPreferenceRoutes;
}

/** The language of a configured definition, so applications alias nothing. */
export type NajmPreferenceLanguage<P> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  P extends NajmPreferences<infer Language, any, any> ? Language : never;

/** The time zone of a configured definition. */
export type NajmPreferenceTimeZone<P> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  P extends NajmPreferences<string, infer TimeZone, any> ? TimeZone : never;

/** The currency of a configured definition, or `never` when none was configured. */
export type NajmPreferenceCurrency<P> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  P extends NajmPreferences<string, any, infer Currency> ? Currency : never;

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

interface AcceptedLanguageRange {
  range: string;
  quality: number;
  order: number;
}

const LANGUAGE_RANGE_PATTERN = /^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/i;
const LANGUAGE_QUALITY_PATTERN = /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;

/** Parse the subset of RFC 9110 Accept-Language needed for language lookup. */
function parseAcceptLanguage(value: string | null | undefined): AcceptedLanguageRange[] {
  if (!value) return [];

  return value
    .split(",")
    .map((entry, order): AcceptedLanguageRange | null => {
      const [rawRange, ...parameters] = entry.split(";");
      const range = rawRange?.trim().toLowerCase() ?? "";
      if (!LANGUAGE_RANGE_PATTERN.test(range)) return null;

      let quality = 1;
      for (const rawParameter of parameters) {
        const match = LANGUAGE_QUALITY_PATTERN.exec(rawParameter.trim());
        if (!match) return null;
        quality = Number(match[1]);
      }

      return { range, quality, order };
    })
    .filter((entry): entry is AcceptedLanguageRange => entry !== null)
    .sort((left, right) => right.quality - left.quality || left.order - right.order);
}

function lookupAcceptedLanguage<Language extends string>(
  value: string | null | undefined,
  supportedLanguages: readonly Language[],
  defaultLanguage: Language,
): Language | undefined {
  const supported = supportedLanguages.map((language) => ({
    language,
    normalized: language.toLowerCase(),
  }));

  for (const preference of parseAcceptLanguage(value)) {
    if (preference.quality === 0) continue;
    if (preference.range === "*") return defaultLanguage;

    let candidate = preference.range;
    while (candidate) {
      const match = supported.find(
        (entry) =>
          entry.normalized === candidate || entry.normalized.startsWith(`${candidate}-`),
      );
      if (match) return match.language;

      const separator = candidate.lastIndexOf("-");
      if (separator === -1) break;
      candidate = candidate.slice(0, separator);
    }
  }

  return undefined;
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
  const Currency extends string = never,
>(
  config: NajmPreferencesConfig<Language, TimeZone, Currency>,
): NajmPreferences<Language, TimeZone, Currency> {
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

  // Currency is strictly opt-in: without an explicit `currencies` allowlist
  // the definition carries no currency state at all — no package default, no
  // locale-derived code. Only an application that configures both the
  // allowlist and (optionally, defaulting to the first entry) the fallback
  // gets `ordered.currency` and a `currency` field from `resolveOrdered()`.
  const hasCurrency = config.currencies !== undefined;
  if (config.defaultCurrency !== undefined && !hasCurrency) {
    throw new Error("najm-kit/server: `defaultCurrency` requires `currencies`");
  }
  const currencies = Object.freeze([...((config.currencies ?? []) as readonly Currency[])]);
  if (hasCurrency && currencies.length === 0) {
    throw new Error("najm-kit/server: `currencies` must list at least one code");
  }
  const currencySet: ReadonlySet<string> = new Set(currencies);
  const defaultCurrency = (
    hasCurrency ? (config.defaultCurrency ?? currencies[0]) : undefined
  ) as [Currency] extends [never] ? undefined : Currency;
  if (hasCurrency && !currencySet.has(defaultCurrency as string)) {
    throw new Error(
      `najm-kit/server: default currency "${config.defaultCurrency}" is not one of the configured codes`,
    );
  }

  const isTheme = (value: unknown): value is NajmMode =>
    typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);

  const isTimeZone = (value: unknown): value is TimeZone =>
    typeof value === "string" && timeZoneSet.has(value);

  const isLanguage = (value: unknown): value is Language =>
    typeof value === "string" && (i18n.supportedLanguages as readonly string[]).includes(value);

  const isCurrency = (value: unknown): value is Currency =>
    typeof value === "string" && currencySet.has(value);

  const DEFAULT_ORDER: readonly NajmPreferenceSource[] = Object.freeze([
    "cookie",
    "user",
    "institution",
    "fallback",
  ]);

  const orderedBase = Object.freeze({
    language: Object.freeze({
      sources: DEFAULT_ORDER,
      guard: isLanguage,
      fallback: i18n.defaultLanguage,
    }),
    theme: Object.freeze({ sources: DEFAULT_ORDER, guard: isTheme, fallback: defaultTheme }),
    timeZone: Object.freeze({
      sources: DEFAULT_ORDER,
      guard: isTimeZone,
      fallback: defaultTimeZone,
    }),
  });
  const ordered = (
    hasCurrency
      ? Object.freeze({
          ...orderedBase,
          currency: Object.freeze({
            sources: Object.freeze(["institution", "fallback"]) as readonly [
              "institution",
              "fallback",
            ],
            guard: isCurrency,
            fallback: defaultCurrency as Currency,
          }),
        })
      : orderedBase
  ) as NajmInstitutionalPreferences<Language, TimeZone, Currency>;

  function resolve(
    cookies: NajmCookieReader,
    options: NajmPreferenceResolveOptions = {},
  ): NajmPreferenceSnapshot<Language, TimeZone> {
    // The cookie wins whenever it is valid. A signed-in user's stored language
    // then beats browser negotiation, which is only used for a first visit
    // without an explicit or account preference. Invalid stored values fall
    // through instead of pinning the UI or suppressing a usable browser locale.
    const languageCookie = cookies.get(cookieNames.language)?.value;
    const language = isLanguage(languageCookie)
      ? languageCookie
      : isLanguage(options.languageFallback)
        ? options.languageFallback
        : (lookupAcceptedLanguage(
            options.acceptLanguage,
            i18n.supportedLanguages,
            i18n.defaultLanguage,
          ) ?? i18n.defaultLanguage);

    const themeCookie = cookies.get(cookieNames.theme)?.value;
    const timeZoneCookie = cookies.get(cookieNames.timeZone)?.value;

    return {
      language,
      theme: isTheme(themeCookie) ? themeCookie : defaultTheme,
      timeZone: isTimeZone(timeZoneCookie) ? timeZoneCookie : defaultTimeZone,
    };
  }

  function candidateFor(
    source: NajmPreferenceSource,
    field: "language" | "theme" | "timeZone",
    cookies: NajmCookieReader,
    input: NajmOrderedResolveInput,
  ): unknown {
    switch (source) {
      case "cookie":
        return cookies.get(
          field === "language"
            ? cookieNames.language
            : field === "theme"
              ? cookieNames.theme
              : cookieNames.timeZone,
        )?.value;
      case "user":
        return input.user?.[field];
      case "institution":
        return input.institution?.[field];
      case "fallback":
        return undefined;
    }
  }

  function resolveOrdered(
    cookies: NajmCookieReader,
    input: NajmOrderedResolveInput = {},
  ): NajmOrderedPreferenceSnapshot<Language, TimeZone, Currency> {
    const languageOrder = input.orders?.language ?? ordered.language.sources;
    const themeOrder = input.orders?.theme ?? ordered.theme.sources;
    const timeZoneOrder = input.orders?.timeZone ?? ordered.timeZone.sources;

    const languageFallback =
      lookupAcceptedLanguage(input.acceptLanguage, i18n.supportedLanguages, i18n.defaultLanguage) ??
      ordered.language.fallback;

    let language: Language = ordered.language.fallback;
    let languageFound = false;
    for (const source of languageOrder) {
      if (source === "fallback") {
        language = languageFallback;
        languageFound = true;
        break;
      }
      const candidate = candidateFor(source, "language", cookies, input);
      if (isLanguage(candidate)) {
        language = candidate;
        languageFound = true;
        break;
      }
    }
    if (!languageFound) language = languageFallback;

    let theme: NajmMode = ordered.theme.fallback;
    let themeFound = false;
    for (const source of themeOrder) {
      if (source === "fallback") {
        theme = ordered.theme.fallback;
        themeFound = true;
        break;
      }
      const candidate = candidateFor(source, "theme", cookies, input);
      if (isTheme(candidate)) {
        theme = candidate;
        themeFound = true;
        break;
      }
    }
    if (!themeFound) theme = ordered.theme.fallback;

    let timeZone: TimeZone = ordered.timeZone.fallback;
    let timeZoneFound = false;
    for (const source of timeZoneOrder) {
      if (source === "fallback") {
        timeZone = ordered.timeZone.fallback;
        timeZoneFound = true;
        break;
      }
      const candidate = candidateFor(source, "timeZone", cookies, input);
      if (isTimeZone(candidate)) {
        timeZone = candidate;
        timeZoneFound = true;
        break;
      }
    }
    if (!timeZoneFound) timeZone = ordered.timeZone.fallback;

    if (!hasCurrency) {
      return { language, theme, timeZone } as NajmOrderedPreferenceSnapshot<
        Language,
        TimeZone,
        Currency
      >;
    }

    // Institution-only by construction: cookies, user values, locales, and
    // Accept-Language are never consulted here, even if a caller passes them.
    const { currency: currencyDescriptor } = ordered as {
      currency: NajmCurrencyPreference<Currency>;
    };
    const currency = isCurrency(input.institution?.currency)
      ? input.institution.currency
      : currencyDescriptor.fallback;

    return { language, theme, timeZone, currency } as NajmOrderedPreferenceSnapshot<
      Language,
      TimeZone,
      Currency
    >;
  }

  function cleared(field: "language" | "theme" | "timeZone"): Response {
    const name =
      field === "language"
        ? cookieNames.language
        : field === "theme"
          ? cookieNames.theme
          : cookieNames.timeZone;
    return Response.json(
      { cleared: true },
      { headers: { "Set-Cookie": serializeClearCookie(name, cookieOptions) } },
    );
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

  const routes: NajmPreferenceRoutes = Object.freeze({
    language: Object.freeze({ POST: handlers.language, DELETE: () => Promise.resolve(cleared("language")) }),
    theme: Object.freeze({ POST: handlers.theme, DELETE: () => Promise.resolve(cleared("theme")) }),
    timeZone: Object.freeze({ POST: handlers.timeZone, DELETE: () => Promise.resolve(cleared("timeZone")) }),
  });

  return Object.freeze({
    cookieNames,
    cookieOptions,
    timeZones,
    defaultTimeZone,
    defaultTheme,
    defaultLanguage: i18n.defaultLanguage,
    currencies,
    defaultCurrency,
    ordered,
    resolve,
    resolveOrdered,
    handlers: Object.freeze(handlers),
    routes,
  });
}

/**
 * Serialize a clearing `Set-Cookie` for a preference cookie.
 *
 * Observable contract (matching School's `ui-*` DELETE routes): HTTP 200
 * `{ cleared: true }`, the same cookie name and `Path` the POST handler
 * wrote, and an expired cookie value. This serialization additionally
 * carries the configured `Domain`, `Secure`, `HttpOnly`, and `SameSite` so
 * the clearing cookie matches a scoped cookie the POST handler wrote — a
 * bare `Path=/` clear would leave a `Domain`- or `Secure`-scoped choice
 * behind. `Max-Age=0` plus a past `Expires` covers both expiry mechanisms
 * browsers honor. It is browser-compatible with Next's `cookies.delete()`
 * output without claiming byte-identical serialization.
 */
function serializeClearCookie(name: string, options: NajmPreferenceCookieOptions): string {
  if (!COOKIE_NAME_PATTERN.test(name)) {
    throw new Error("najm-kit/server: refusing to serialize an unsafe preference cookie");
  }
  const parts = [
    `${name}=`,
    `Path=${options.path}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite[0]!.toUpperCase()}${options.sameSite.slice(1)}`);
  return parts.join("; ");
}

/**
 * Clear the three display-preference cookies with best-effort semantics.
 *
 * Never throws and never short-circuits: each endpoint is attempted inside
 * its own async boundary, so a synchronously throwing `fetchFn` for one
 * endpoint cannot prevent attempts to the other two. Every outcome is
 * settled independently, so a display-cookie failure can never prevent an
 * auth logout. Callers compose it with their auth logout (see
 * `logoutWithNajmPreferenceCleanup`) rather than awaiting it as a gate.
 */
export async function clearNajmUiPreferences(
  options: NajmClearPreferencesOptions = {},
): Promise<void> {
  const endpoints: NajmUiPreferenceEndpoints = {
    ...NAJM_UI_PREFERENCE_ENDPOINTS,
    ...options.endpoints,
  };
  let fetchFn = options.fetchFn;
  if (!fetchFn) {
    const host = globalThis as { fetch?: typeof fetch };
    if (typeof host.fetch !== "function") return;
    fetchFn = host.fetch.bind(host);
  }
  const attempt = async (endpoint: string): Promise<void> => {
    try {
      await fetchFn(endpoint, { method: "DELETE", credentials: "same-origin" });
    } catch {
      // Best-effort per endpoint: one display cookie never blocks the others.
    }
  };
  await Promise.allSettled(
    [endpoints.language, endpoints.theme, endpoints.timeZone].map((endpoint) => attempt(endpoint)),
  );
}

/**
 * Run an auth logout with best-effort display-preference cleanup.
 *
 * Mirrors School's `SignOutButton` + `onSuccess(clearSchoolUiPreferences)`
 * ordering: the auth logout runs first and its outcome is authoritative. If
 * it rejects, the identical error propagates and cleanup never runs (there
 * is no `onSuccess` without a success). If it resolves, cleanup runs
 * best-effort and its rejection can never replace the successful auth
 * result — the exact logout value is returned either way.
 *
 * Structural on purpose: the logout callback is the app's `najm-auth` call,
 * so `najm-kit/server` never imports `najm-auth`.
 */
export async function logoutWithNajmPreferenceCleanup<T>(options: {
  readonly logout: () => Promise<T>;
  readonly clearPreferences: () => Promise<unknown>;
}): Promise<T> {
  const result = await options.logout();
  try {
    await options.clearPreferences();
  } catch {
    // Best-effort: a display-cookie failure never replaces a logout result.
  }
  return result;
}
