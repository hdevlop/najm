/**
 * `najm-next/app` — shared-safe application policy definition.
 *
 * Pure by contract: this module imports nothing. No React, no Next.js server
 * APIs, no environment objects, no filesystem, no auth/theme/backend packages,
 * and no request state. A config-only consumer with none of the optional
 * dependencies installed must be able to import this entrypoint.
 *
 * Values defined here are serializable data. They describe policy; the
 * request-time mechanics (nonce generation, header composition, proxy
 * wiring) live in `najm-next/security` and must stay out of this module so
 * proxy-adjacent imports never pay for — or accidentally initialize — backend
 * or UI runtimes.
 */

/** How the Next proxy treats an otherwise valid signed session snapshot. */
export type NajmProxySessionMode = "optimistic" | "authoritative";

export interface NajmAppRoutePolicy {
  readonly publicRoutes: readonly string[];
  readonly protectedRoutes: readonly string[];
  readonly roleRoutes?: Readonly<Record<string, readonly string[]>>;
  readonly loginRoute: string;
  readonly forbiddenRoute: string;
}

export interface NajmAppAuthPolicy extends NajmAppRoutePolicy {
  readonly apiBaseURL: string;
  readonly authPrefix: string;
  /**
   * Structurally compatible with `ProxySessionMode` from
   * `najm-auth/client/server`. Kept as a local structural union so this
   * entrypoint has no runtime dependency on Najm Auth.
   */
  readonly proxySessionMode: NajmProxySessionMode;
  readonly rememberCookieName: string;
  readonly refreshThreshold?: number;
  readonly tabSync?: boolean;
}

export interface NajmAppPreferenceCookies {
  readonly language: string;
  readonly theme: string;
  readonly timeZone: string;
}

export interface NajmAppPreferencesPolicy {
  readonly cookieNames: NajmAppPreferenceCookies;
  readonly defaultTimeZone: string;
}

export interface NajmAppCspPolicy {
  /**
   * Fixed report endpoint. The route must stay directly reachable without
   * booting the Najm backend (see `najm-next/security/reports`).
   */
  readonly reportPath: "/api/csp-report";
  readonly extraImgSrc?: readonly string[];
  readonly extraConnectSrc?: readonly string[];
  readonly extraFontSrc?: readonly string[];
  /**
   * Enforced `frame-src`. Kafil-style apps use `["none"]`; School-style apps
   * list their provider frames (for example `["'self'",
   * "https://www.google.com"]`).
   */
  readonly frameSrc: readonly string[];
}

export type NajmAppLocationProvider = "disabled" | "leaflet" | "google";

export interface NajmAppLocationPolicy {
  /** Defaults to the normalized application id plus `_LOCATION`. */
  readonly environmentPrefix?: string;
  readonly allowedProviders?: readonly NajmAppLocationProvider[];
  readonly defaults?: {
    readonly provider?: NajmAppLocationProvider;
    readonly center?: { readonly latitude: number; readonly longitude: number };
    readonly zoom?: number;
    readonly leaflet?: {
      readonly tileUrl?: string;
      readonly attribution?: string;
    };
    readonly google?: {
      readonly mapId?: string;
      readonly language?: string;
      readonly region?: string;
      readonly apiKeyEnvironmentFallbacks?: readonly string[];
    };
  };
}

export interface NajmAppDefinition {
  readonly id: string;
  readonly auth: NajmAppAuthPolicy;
  readonly preferences: NajmAppPreferencesPolicy;
  readonly csp: NajmAppCspPolicy;
  /** Declares that the server snapshot owns Najm Theme appearance. */
  readonly theme?: true;
  /** Declares that the server snapshot owns Najm Theme branding. */
  readonly branding?: true;
  /** Omit to install no location context; `true` uses the shared Leaflet preset. */
  readonly location?: true | NajmAppLocationPolicy;
}

/** The single report endpoint shared by every Najm Next application. */
export const NAJM_CSP_REPORT_PATH = "/api/csp-report" as const;

/**
 * Server environment record passed explicitly by the app (never read inside
 * this module). Structural match for the location runtime resolver input.
 */
export type NajmEnvRecord = Readonly<Record<string, string | undefined>>;

const QUOTED_KEYWORDS = new Set(["'self'", "'none'", "'strict-dynamic'", "'unsafe-inline'"]);
const BARE_SCHEMES = new Set(["data:", "blob:"]);
const HOST_PATTERN = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*(?::\d{1,5})?(?:\/\S*)?$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

/**
 * Whether a value is a safe CSP allowlist token: an approved keyword, a bare
 * `data:`/`blob:` scheme, or an `https://` origin (optionally with a `*.`
 * subdomain wildcard, port, or path). Anything else — including `*`,
 * `http://`, embedded credentials, quotes, or header separators — is rejected
 * so app configuration can never inject a new directive.
 *
 * `'unsafe-eval'` is deliberately not an allowed extra: development tooling
 * owns that token through the security composition, never app configuration.
 */
export function isNajmCspSource(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  if (QUOTED_KEYWORDS.has(value) || BARE_SCHEMES.has(value)) return true;
  if (CONTROL_PATTERN.test(value) || /[\s"'(),;\\]/.test(value)) return false;
  const lower = value.toLowerCase();
  if (!lower.startsWith("https://")) return false;
  const host = value.slice("https://".length);
  if (host === "" || host.startsWith(".") || host.includes("@")) return false;
  if (host.startsWith("*.")) {
    const rest = host.slice(2);
    return rest !== "" && !rest.startsWith(".") && HOST_PATTERN.test(rest);
  }
  return HOST_PATTERN.test(host);
}

export function assertNajmCspSource(value: unknown, field: string): asserts value is string {
  if (!isNajmCspSource(value)) {
    throw new TypeError(`najm-next/app: ${field} is not a safe CSP source: ${formatValue(value)}`);
  }
}

const APP_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const ENV_PREFIX_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const COOKIE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const TIME_ZONE_PATTERN = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*\/[A-Za-z0-9_+-]+)$/;
const ROUTE_FORBIDDEN_PATTERN = /[\s"'();,\\]/;

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  return typeof value;
}

function assertRoute(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value === "" || !value.startsWith("/")) {
    throw new TypeError(`najm-next/app: ${field} must be an app-absolute path starting with "/": ${formatValue(value)}`);
  }
  if (value.includes("://") || ROUTE_FORBIDDEN_PATTERN.test(value) || CONTROL_PATTERN.test(value)) {
    throw new TypeError(`najm-next/app: ${field} contains unsupported characters: ${formatValue(value)}`);
  }
}

function assertRouteList(value: unknown, field: string): asserts value is readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`najm-next/app: ${field} must be an array of route patterns`);
  }
  for (const entry of value) assertRoute(entry, field);
}

function assertCookieName(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !COOKIE_NAME_PATTERN.test(value)) {
    throw new TypeError(`najm-next/app: ${field} must be a valid cookie name: ${formatValue(value)}`);
  }
}

/**
 * Structural validation for a shared-safe app definition. Throws a `TypeError`
 * describing the first invalid field. Called by `defineNajmApp` and re-used
 * by server/proxy composition so an invalid policy fails fast at startup,
 * never per request.
 */
export function assertNajmAppDefinition(value: unknown): asserts value is NajmAppDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("najm-next/app: app definition must be an object");
  }
  const def = value as Record<string, unknown>;

  if (typeof def.id !== "string" || !APP_ID_PATTERN.test(def.id)) {
    throw new TypeError(`najm-next/app: id must match ${APP_ID_PATTERN}: ${formatValue(def.id)}`);
  }

  const auth = def.auth as Record<string, unknown> | undefined;
  if (typeof auth !== "object" || auth === null || Array.isArray(auth)) {
    throw new TypeError("najm-next/app: auth policy must be an object");
  }
  assertRouteList(auth.publicRoutes, "auth.publicRoutes");
  assertRouteList(auth.protectedRoutes, "auth.protectedRoutes");
  if (auth.roleRoutes !== undefined) {
    if (typeof auth.roleRoutes !== "object" || auth.roleRoutes === null || Array.isArray(auth.roleRoutes)) {
      throw new TypeError("najm-next/app: auth.roleRoutes must be a record of route to roles");
    }
    for (const [pattern, roles] of Object.entries(auth.roleRoutes)) {
      assertRoute(pattern, "auth.roleRoutes pattern");
      if (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => typeof role !== "string" || role === "")) {
        throw new TypeError(`najm-next/app: auth.roleRoutes[${JSON.stringify(pattern)}] must be a non-empty string array`);
      }
    }
  }
  assertRoute(auth.loginRoute, "auth.loginRoute");
  assertRoute(auth.forbiddenRoute, "auth.forbiddenRoute");
  assertRoute(auth.apiBaseURL, "auth.apiBaseURL");
  assertRoute(auth.authPrefix, "auth.authPrefix");
  if (auth.proxySessionMode !== "optimistic" && auth.proxySessionMode !== "authoritative") {
    throw new TypeError(`najm-next/app: auth.proxySessionMode must be "optimistic" or "authoritative": ${formatValue(auth.proxySessionMode)}`);
  }
  assertCookieName(auth.rememberCookieName, "auth.rememberCookieName");
  if (auth.refreshThreshold !== undefined) {
    if (typeof auth.refreshThreshold !== "number" || !(auth.refreshThreshold > 0) || auth.refreshThreshold > 1) {
      throw new TypeError(`najm-next/app: auth.refreshThreshold must be a number in (0, 1]: ${formatValue(auth.refreshThreshold)}`);
    }
  }
  if (auth.tabSync !== undefined && typeof auth.tabSync !== "boolean") {
    throw new TypeError(`najm-next/app: auth.tabSync must be a boolean: ${formatValue(auth.tabSync)}`);
  }

  const preferences = def.preferences as Record<string, unknown> | undefined;
  if (typeof preferences !== "object" || preferences === null || Array.isArray(preferences)) {
    throw new TypeError("najm-next/app: preferences policy must be an object");
  }
  const cookieNames = preferences.cookieNames as Record<string, unknown> | undefined;
  if (typeof cookieNames !== "object" || cookieNames === null || Array.isArray(cookieNames)) {
    throw new TypeError("najm-next/app: preferences.cookieNames must be an object");
  }
  assertCookieName(cookieNames.language, "preferences.cookieNames.language");
  assertCookieName(cookieNames.theme, "preferences.cookieNames.theme");
  assertCookieName(cookieNames.timeZone, "preferences.cookieNames.timeZone");
  const names = [cookieNames.language, cookieNames.theme, cookieNames.timeZone];
  if (new Set(names).size !== names.length) {
    throw new TypeError("najm-next/app: preferences.cookieNames must use three distinct names");
  }
  if (typeof preferences.defaultTimeZone !== "string" || !TIME_ZONE_PATTERN.test(preferences.defaultTimeZone)) {
    throw new TypeError(`najm-next/app: preferences.defaultTimeZone must be an IANA zone or UTC: ${formatValue(preferences.defaultTimeZone)}`);
  }

  const csp = def.csp as Record<string, unknown> | undefined;
  if (typeof csp !== "object" || csp === null || Array.isArray(csp)) {
    throw new TypeError("najm-next/app: csp policy must be an object");
  }
  if (csp.reportPath !== NAJM_CSP_REPORT_PATH) {
    throw new TypeError(`najm-next/app: csp.reportPath must be ${JSON.stringify(NAJM_CSP_REPORT_PATH)}: ${formatValue(csp.reportPath)}`);
  }
  assertCspSourceList(csp.frameSrc, "csp.frameSrc", true);
  assertCspSourceList(csp.extraImgSrc, "csp.extraImgSrc", false);
  assertCspSourceList(csp.extraConnectSrc, "csp.extraConnectSrc", false);
  assertCspSourceList(csp.extraFontSrc, "csp.extraFontSrc", false);

  if (def.theme !== undefined && def.theme !== true) {
    throw new TypeError("najm-next/app: theme must be true when enabled");
  }
  if (def.branding !== undefined && def.branding !== true) {
    throw new TypeError("najm-next/app: branding must be true when enabled");
  }

  const location = def.location as Record<string, unknown> | true | undefined;
  if (location !== undefined && location !== true) {
    if (typeof location !== "object" || location === null || Array.isArray(location)) {
      throw new TypeError("najm-next/app: location must be true or a configuration object");
    }
    if (
      location.environmentPrefix !== undefined &&
      (typeof location.environmentPrefix !== "string" || !ENV_PREFIX_PATTERN.test(location.environmentPrefix))
    ) {
      throw new TypeError(`najm-next/app: location.environmentPrefix must contain uppercase letters, numbers, and underscores: ${formatValue(location.environmentPrefix)}`);
    }
    if (location.allowedProviders !== undefined) {
      if (!Array.isArray(location.allowedProviders) || location.allowedProviders.some(
        (provider) => provider !== "disabled" && provider !== "leaflet" && provider !== "google",
      )) {
        throw new TypeError("najm-next/app: location.allowedProviders contains an unsupported provider");
      }
    }
  }
}

/** Deterministic environment prefix used by `location: true`. */
export function getNajmLocationEnvironmentPrefix(appId: string): string {
  return `${appId.replaceAll("-", "_").toUpperCase()}_LOCATION`;
}

function assertCspSourceList(value: unknown, field: string, required: boolean): void {
  if (value === undefined) {
    if (required) throw new TypeError(`najm-next/app: ${field} is required`);
    return;
  }
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new TypeError(`najm-next/app: ${field} must be a${required ? " non-empty" : "n"} array of CSP sources`);
  }
  for (const entry of value) {
    assertNajmCspSource(entry, field);
    if (!required && entry === "'none'") {
      throw new TypeError(`najm-next/app: ${field} must not contain 'none' (it is only valid as a complete frameSrc)`);
    }
  }
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry);
    Object.freeze(value);
    return;
  }
  const record = value as Record<string, unknown>;
  if (Object.getPrototypeOf(record) !== Object.prototype) return;
  for (const entry of Object.values(record)) deepFreeze(entry);
  Object.freeze(record);
}

/**
 * Define one application's shared-safe policy. The definition is validated
 * eagerly and frozen so shared configuration cannot be mutated after import.
 */
export function defineNajmApp<const T extends NajmAppDefinition>(definition: T): T {
  assertNajmAppDefinition(definition);
  deepFreeze(definition);
  return definition;
}
