// ============================================================================
// getSession — Next.js Server Component / Route Handler helper
// ============================================================================
//
// Resolution order:
// 1. Read and HMAC-verify the signed `najm.session` cookie.
// 2. Validate the refresh session through the non-rotating recovery endpoint.
// 3. Return null if unauthenticated.
// ============================================================================

import type { AuthUser } from '../types';
import { resolveSessionSecret, verifySessionCookie } from '../sessionCookie';
import {
  authEndpoint,
  resolveInternalRecoveryURL,
  requestSessionRecovery,
  type SessionRecoveryFailure,
} from '../sessionRecovery';

export interface ServerSession {
  user: AuthUser;
  roles?: string[];
  permissions?: string[];
}

export interface GetSessionConfig {
  /**
   * Base URL for auth endpoints.
   * Defaults to `NEXT_PUBLIC_API_URL` or the same-origin `/api` path.
   */
  baseURL?: string;
  /** Auth route prefix appended to baseURL (default: '/auth'). */
  authPrefix?: string;
  /** Refresh token cookie name (default: 'refreshToken'). */
  cookieName?: string;
  /** Signed session cookie name (default: 'najm.session'). */
  sessionCookieName?: string;
  /**
   * Secret used to verify the session cookie HMAC signature.
   * Falls back to NAJM_SESSION_SECRET or JWT_ACCESS_SECRET env vars.
   */
  sessionSecret?: string;
  /**
   * Maximum accepted session-cookie age in seconds.
   * Must match the auth plugin's `session.maxAge`. Default: 300.
   */
  sessionMaxAge?: number;
  /**
   * Session-recovery endpoint. Defaults to
   * `${baseURL}${authPrefix}/session/recover`. Set to false to disable fallback.
   */
  recoveryURL?: string | false;
  /** Loopback-only recovery endpoint for self-hosted reverse-proxy setups. */
  internalRecoveryURL?: string;
  /**
   * Error handling mode:
   * - 'nullable' (default): returns null on any failure
   * - 'strict': throws typed errors for debugging
   */
  mode?: 'nullable' | 'strict';
  /** Secret-free diagnostic hook for failed recovery attempts. */
  onRecoveryFailure?: (failure: SessionRecoveryFailure) => void;
}

export class NoSessionError extends Error {
  readonly code = 'NO_SESSION';
  constructor(message = 'No active session') {
    super(message);
    this.name = 'NoSessionError';
  }
}

export class AuthConfigError extends Error {
  readonly code = 'AUTH_CONFIG_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}

export class AuthTransportError extends Error {
  readonly code = 'AUTH_TRANSPORT_ERROR';
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AuthTransportError';
  }
}

/**
 * The structured result of one resolution attempt.
 *
 * Optional callers (`getSession`) and strict callers (`requireSession`,
 * `requireRole`, the React-server adapter) all read this single value, so they
 * cannot diverge on what counts as "unauthenticated" and a caller that wants
 * both views never pays for a second recovery round trip.
 */
export type SessionOutcome =
  | { status: 'authenticated'; session: ServerSession }
  | { status: 'unauthenticated'; error: NoSessionError }
  | { status: 'failed'; error: AuthConfigError | AuthTransportError };

export type FailedSessionOutcome = Exclude<SessionOutcome, { status: 'authenticated' }>;

function defaultBaseURL(): string {
  const explicit = typeof process !== 'undefined' ? process.env.NAJM_AUTH_BASE_URL : undefined;
  if (explicit) return explicit;
  const publicUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined;
  return publicUrl || '/api';
}

function firstForwardedValue(value: string | null): string | undefined {
  const first = value?.split(',')[0]?.trim();
  return first || undefined;
}

function requestOriginFromHeaders(
  headers: { get(name: string): string | null },
): string | undefined {
  const host = firstForwardedValue(headers.get('x-forwarded-host'))
    ?? firstForwardedValue(headers.get('host'));
  if (!host) return undefined;

  const protocol = firstForwardedValue(headers.get('x-forwarded-proto')) ?? 'https';
  if (protocol !== 'https' && protocol !== 'http') return undefined;

  try {
    const url = new URL(`${protocol}://${host}`);
    if (url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

const authenticated = (session: ServerSession): SessionOutcome => ({
  status: 'authenticated',
  session,
});
const unauthenticated = (message: string): SessionOutcome => ({
  status: 'unauthenticated',
  error: new NoSessionError(message),
});
const failed = (error: AuthConfigError | AuthTransportError): SessionOutcome => ({
  status: 'failed',
  error,
});

/**
 * Perform one full resolution and classify the result without deciding what the
 * caller should do about it. This is the single place cookie verification and
 * recovery happen; `getSession` and the strict guards are interpretations of
 * the value it returns.
 */
export async function resolveSessionOutcome(
  config: GetSessionConfig = {},
): Promise<SessionOutcome> {
  const cookieName = config.cookieName ?? 'refreshToken';
  const sessionCookieName = config.sessionCookieName ?? 'najm.session';
  const baseURL = config.baseURL ?? defaultBaseURL();
  const prefix = config.authPrefix ?? '/auth';
  const internalRecoveryURL = resolveInternalRecoveryURL(config.internalRecoveryURL);

  let sessionCookieValue: string | undefined;
  let refreshCookieValue: string | undefined;
  let requestOrigin: string | undefined;

  try {
    const mod = await import('next/headers');
    const cookieStore = await mod.cookies();
    sessionCookieValue = cookieStore.get(sessionCookieName)?.value;
    refreshCookieValue = cookieStore.get(cookieName)?.value;
    if (typeof mod.headers === 'function') {
      requestOrigin = requestOriginFromHeaders(await mod.headers());
    }
  } catch {
    return failed(new AuthConfigError('Failed to read cookies from Next.js headers()'));
  }

  const secret = resolveSessionSecret(config.sessionSecret);

  if (sessionCookieValue && secret) {
    const claims = await verifySessionCookie(sessionCookieValue, {
      secret,
      maxAgeSeconds: config.sessionMaxAge,
    });
    if (claims) {
      return authenticated({
        user: claims.user,
        roles: claims.roles,
        permissions: claims.permissions,
      });
    }
  }

  if (!secret) {
    return failed(new AuthConfigError('Session cookie secret is not configured'));
  }
  if (
    !refreshCookieValue
    || (config.recoveryURL === false && !internalRecoveryURL)
  ) {
    return unauthenticated('No recoverable refresh session');
  }
  if (!requestOrigin) {
    return failed(new AuthConfigError('Incoming request origin is unavailable'));
  }

  const endpoint = internalRecoveryURL
    ?? (config.recoveryURL
      ? new URL(config.recoveryURL, requestOrigin).toString()
      : authEndpoint(baseURL, prefix, '/session/recover', requestOrigin));
  const recovery = await requestSessionRecovery({
    endpoint,
    requestOrigin,
    allowLoopbackEndpoint: internalRecoveryURL !== undefined,
    refreshCookieName: cookieName,
    refreshCookieValue,
    sessionCookieName,
    sessionSecret: secret,
    sessionMaxAge: config.sessionMaxAge,
    onFailure: config.onRecoveryFailure,
  });

  if (recovery.status === 'recovered') {
    return authenticated({
      user: recovery.claims.user,
      roles: recovery.claims.roles,
      permissions: recovery.claims.permissions,
    });
  }
  if (recovery.status === 'invalid') {
    return unauthenticated('Refresh session is invalid or revoked');
  }
  return failed(new AuthTransportError(
    'Session recovery endpoint was unavailable or returned an invalid session',
    recovery.httpStatus,
  ));
}

/**
 * Resolve a session in a Next.js Server Component, Route Handler, or Server
 * Action. Recovery returns claims for the current render but cannot persist
 * response cookies during Server Component rendering; middleware performs that
 * persistence for protected navigation.
 */
export async function getSession(config: GetSessionConfig = {}): Promise<ServerSession | null> {
  const outcome = await resolveSessionOutcome(config);
  if (outcome.status === 'authenticated') return outcome.session;
  if (config.mode === 'strict') throw outcome.error;
  return null;
}
