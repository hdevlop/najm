/**
 * `najm-next/security` — request-time CSP and auth-proxy composition.
 *
 * This module wraps the existing Najm Auth proxy contract
 * (`proxy(request, { requestHeaders }) => Response`, see
 * `najm-auth/client/server/withAuthMiddleware.ts`) with a per-request nonce
 * policy. It depends on Najm Auth only through a structural interface: there
 * is no runtime import of `najm-auth`, `najm-kit`, `najm-theme`, React, or any
 * server-component/bootstrap helper, so proxy imports never initialize theme,
 * database, or RSC state.
 *
 * Ownership (reconciled with the previous edge-owned assumption in this
 * package's README): the request nonce policy is app-owned and emitted here,
 * exactly once per document response. TLS/HSTS remain edge-owned. The edge
 * must not emit a second enforcing `Content-Security-Policy` — two enforcing
 * policies intersect (a resource must satisfy both), so an edge policy would
 * silently block app/provider resources. If the edge needs visibility, it may
 * emit `Content-Security-Policy-Report-Only` and only in coordination with the
 * app policy.
 */

import {
  assertNajmAppDefinition,
  assertNajmCspSource,
  type NajmAppDefinition,
  type NajmEnvRecord,
} from "./app";
import { defineNajmAppLocationRuntime } from "./location/server";

export type { NajmEnvRecord } from "./app";

/** Explicit nonce-mode marker. Nonce rendering is dynamic-only (see below). */
export const NAJM_CSP_POLICY_MODE = "nonce" as const;
export type NajmCspMode = typeof NAJM_CSP_POLICY_MODE;

export const NAJM_CSP_HEADER = "Content-Security-Policy";
export const NAJM_NONCE_HEADER = "x-nonce";

/**
 * CSP contributions from a location runtime resolution. Structurally matches
 * the `csp` shape returned by `defineNajmLocationRuntime(...).resolve(...)`
 * in `najm-next/location/server` without importing it.
 */
export interface NajmLocationCspContribution {
  readonly imgSrc: readonly string[];
  readonly connectSrc: readonly string[];
  readonly scriptSrc?: readonly string[];
  readonly fontSrc?: readonly string[];
  readonly frameSrc?: readonly string[];
}

export interface NajmCspOverrides {
  readonly extraScriptSrc?: readonly string[];
  readonly extraImgSrc?: readonly string[];
  readonly extraConnectSrc?: readonly string[];
  readonly extraFontSrc?: readonly string[];
  readonly extraFrameSrc?: readonly string[];
}

export interface NajmCspOptions {
  /**
   * Must be `"nonce"`. The literal keeps nonce mode explicit at every call
   * site: nonce-based rendering is dynamic per request (`await connection()`
   * / `force-dynamic`), disables static optimization, and must never be
   * silently applied to a future static application or export.
   */
  readonly mode: NajmCspMode;
  readonly isDevelopment: boolean;
  readonly app: NajmAppDefinition;
  readonly locationCsp: NajmLocationCspContribution;
  readonly overrides?: NajmCspOverrides;
}

/**
 * Structural form of the Najm Auth proxy (`AuthKit["proxy"]`). The real
 * implementation verifies the session, performs recovery, and returns a
 * `NextResponse`; this composition only relies on the call shape and on the
 * returned `Response` being preserved untouched (see `composeNajmProxy`).
 */
export interface NajmAuthProxy {
  readonly proxy: (
    request: Request,
    init?: { readonly requestHeaders?: HeadersInit },
  ) => Promise<Response>;
}

export interface NajmProxyOptions {
  readonly auth: NajmAuthProxy;
  readonly app: NajmAppDefinition;
  /**
   * Maps the request environment to location CSP contributions, e.g.
   * `(env) => location.resolve(env, { isDevelopment }).csp`. Called per
   * request so CSP and layout resolve from the same runtime input.
   */
  /** @deprecated App-declared location is resolved automatically. */
  readonly resolveLocationCsp?: (env: NajmEnvRecord) => NajmLocationCspContribution;
  /**
   * Request environment override (tests, fixtures). Defaults to the process
   * environment read lazily per request; never captured at import time.
   */
  readonly env?: NajmEnvRecord;
  readonly isDevelopment?: boolean;
  readonly overrides?: NajmCspOverrides;
}

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,256}$/;

/**
 * Generate a fresh per-request nonce. Uses the Web Crypto API so it works in
 * Node, edge, and browser runtimes without `Buffer`.
 */
export function createNajmNonce(): string {
  const nonce = btoa(globalThis.crypto.randomUUID());
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("najm-next/security: generated CSP nonce failed validation");
  }
  return nonce;
}

/** Reject any nonce that could alter a directive (header-injection guard). */
export function assertNajmNonce(value: unknown): asserts value is string {
  if (typeof value !== "string" || !NONCE_PATTERN.test(value)) {
    throw new TypeError("najm-next/security: CSP nonce contains unsupported characters");
  }
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function assertOverrideSources(values: readonly string[] | undefined, field: string): readonly string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new TypeError(`najm-next/security: overrides.${field} must be an array of CSP sources`);
  }
  for (const value of values) {
    assertNajmCspSource(value, `overrides.${field}`);
    // The development evaluator is owned exclusively by the built-in dev
    // path below. Overrides can never introduce eval — in either mode — so
    // no call site can weaken production (or development) script policy.
    if (value === "'unsafe-eval'") {
      throw new TypeError(`najm-next/security: overrides.${field} must not contain 'unsafe-eval'`);
    }
  }
  return values;
}

function assertContributionSources(values: unknown, field: string): readonly string[] {
  if (!Array.isArray(values)) {
    throw new TypeError(`najm-next/security: locationCsp.${field} must be an array of CSP sources`);
  }
  for (const value of values) assertNajmCspSource(value, `locationCsp.${field}`);
  return values;
}

/**
 * Compose the single enforcing request policy. The shape preserves both
 * consumer baselines: Kafil-style (self/data/blob images plus app tile
 * origins, `frame-src 'none'`) and School-style (Google connect/font/frame/
 * image origins) policies are expressed through the app definition and
 * location contributions, not through forked code.
 *
 * `style-src 'self' 'unsafe-inline'` is retained deliberately: both consumers
 * depend on it today and a compatible tightening is separate, proven work —
 * not something to smuggle into this extraction. Production never gains
 * `'unsafe-eval'` or wildcard sources from this function.
 */
export function createNajmCsp(nonce: string, options: NajmCspOptions): string {
  assertNajmNonce(nonce);
  if (typeof options !== "object" || options === null) {
    throw new TypeError("najm-next/security: CSP options must be an object");
  }
  if (options.mode !== NAJM_CSP_POLICY_MODE) {
    throw new TypeError(`najm-next/security: CSP mode must be ${JSON.stringify(NAJM_CSP_POLICY_MODE)}`);
  }
  if (typeof options.isDevelopment !== "boolean") {
    throw new TypeError("najm-next/security: isDevelopment must be a boolean");
  }
  assertNajmAppDefinition(options.app);
  if (typeof options.locationCsp !== "object" || options.locationCsp === null) {
    throw new TypeError("najm-next/security: locationCsp must be an object");
  }
  const locationImgSrc = assertContributionSources(options.locationCsp.imgSrc, "imgSrc");
  const locationConnectSrc = assertContributionSources(options.locationCsp.connectSrc, "connectSrc");
  const locationScriptSrc = assertContributionSources(options.locationCsp.scriptSrc ?? [], "scriptSrc");
  const locationFontSrc = assertContributionSources(options.locationCsp.fontSrc ?? [], "fontSrc");
  const locationFrameSrc = assertContributionSources(options.locationCsp.frameSrc ?? [], "frameSrc");
  if (locationScriptSrc.includes("'unsafe-eval'") || locationScriptSrc.includes("'unsafe-inline'")) {
    throw new TypeError("najm-next/security: location script-src must not contain eval/inline tokens");
  }

  const overrides = options.overrides ?? {};
  if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
    throw new TypeError("najm-next/security: overrides must be an object");
  }
  const overrideScript = assertOverrideSources(overrides.extraScriptSrc, "extraScriptSrc");
  const overrideImg = assertOverrideSources(overrides.extraImgSrc, "extraImgSrc");
  const overrideConnect = assertOverrideSources(overrides.extraConnectSrc, "extraConnectSrc");
  const overrideFont = assertOverrideSources(overrides.extraFontSrc, "extraFontSrc");
  const overrideFrame = assertOverrideSources(overrides.extraFrameSrc, "extraFrameSrc");

  const scriptSrc = dedupe([
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React uses eval in development for server-error reconstruction (see the
    // installed Next CSP guide). Neither React nor Next.js uses eval in
    // production, so this token must never appear in a production policy.
    ...(options.isDevelopment ? ["'unsafe-eval'"] : []),
    ...locationScriptSrc,
    ...overrideScript,
  ]);
  if (!options.isDevelopment && scriptSrc.some((source) => source === "'unsafe-eval'" || source === "'unsafe-inline'")) {
    throw new TypeError("najm-next/security: production script-src must not contain eval/inline tokens");
  }
  if (scriptSrc.some((source) => source === "*" || source === "'none'")) {
    throw new TypeError("najm-next/security: script-src must not contain '*' or 'none' alongside a nonce");
  }

  const imgSrc = dedupe([
    "'self'",
    "data:",
    "blob:",
    ...(options.app.csp.extraImgSrc ?? []),
    ...locationImgSrc,
    ...overrideImg,
  ]);
  const connectSrc = dedupe(["'self'", ...(options.app.csp.extraConnectSrc ?? []), ...locationConnectSrc, ...overrideConnect]);
  const fontSrc = dedupe(["'self'", "data:", ...(options.app.csp.extraFontSrc ?? []), ...locationFontSrc, ...overrideFont]);
  const frameSrc = dedupe([...options.app.csp.frameSrc, ...locationFrameSrc, ...overrideFrame]);
  if (frameSrc.includes("'none'") && frameSrc.length > 1) {
    throw new TypeError("najm-next/security: frame-src 'none' must stand alone");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    `font-src ${fontSrc.join(" ")}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src ${frameSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    `report-uri ${options.app.csp.reportPath}`,
  ].join("; ");
}

function readDefaultEnv(): NajmEnvRecord {
  const host = globalThis as { process?: { env?: NajmEnvRecord } };
  return host.process?.env ?? {};
}

/**
 * Compose one Next proxy handler around the existing auth proxy. The returned
 * handler generates a fresh nonce per request, forwards the policy and nonce
 * into rendering through request headers, applies the same policy as the
 * single enforcing response header, and returns the auth proxy's response
 * untouched otherwise.
 *
 * Preservation is by construction: the response object is mutated in place
 * with `headers.set(NAJM_CSP_HEADER, ...)` — status, redirects, body,
 * existing response headers, and every `Set-Cookie` value survive, because
 * nothing is reconstructed. Overwriting (not appending) the CSP header also
 * guarantees no accidental second enforcing policy from upstream layers.
 * Auth errors propagate; this wrapper adds no fallback and no catch.
 *
 * The proxy `matcher` stays a static literal in the consuming app (Next
 * requires static analyzability); this module never defines one.
 */
export function composeNajmProxy(options: NajmProxyOptions): (request: Request) => Promise<Response> {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("najm-next/security: proxy options must be an object");
  }
  const { auth, app, resolveLocationCsp } = options;
  if (typeof auth !== "object" || auth === null || typeof auth.proxy !== "function") {
    throw new TypeError("najm-next/security: auth must expose a proxy(request, init?) function");
  }
  assertNajmAppDefinition(app);
  if (resolveLocationCsp !== undefined && typeof resolveLocationCsp !== "function") {
    throw new TypeError("najm-next/security: resolveLocationCsp must be a function when provided");
  }
  if (options.env !== undefined && (typeof options.env !== "object" || options.env === null || Array.isArray(options.env))) {
    throw new TypeError("najm-next/security: env must be an object");
  }
  if (options.isDevelopment !== undefined && typeof options.isDevelopment !== "boolean") {
    throw new TypeError("najm-next/security: isDevelopment must be a boolean");
  }

  const appLocation = defineNajmAppLocationRuntime(app);
  return async function najmProxy(request: Request): Promise<Response> {
    const env = options.env ?? readDefaultEnv();
    const isDevelopment = options.isDevelopment ?? env.NODE_ENV === "development";
    const nonce = createNajmNonce();
    const policy = createNajmCsp(nonce, {
      mode: NAJM_CSP_POLICY_MODE,
      isDevelopment,
      app,
      locationCsp:
        resolveLocationCsp?.(env) ??
        appLocation?.resolve(env, { isDevelopment }).csp ??
        { imgSrc: [], connectSrc: [] },
      overrides: options.overrides,
    });
    const response = await auth.proxy(request, {
      requestHeaders: {
        "content-security-policy": policy,
        [NAJM_NONCE_HEADER]: nonce,
      },
    });
    response.headers.set(NAJM_CSP_HEADER, policy);
    return response;
  };
}
