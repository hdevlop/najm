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
  requestSessionRecovery,
} from '../sessionRecovery';

export interface ServerSession {
  user: AuthUser;
  roles?: string[];
  permissions?: string[];
}

export interface GetSessionConfig {
  /**
   * Base URL for auth endpoints.
   * Defaults to `${NEXT_PUBLIC_API_URL || http://localhost:${PORT||3000}}/api`.
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
  /**
   * Error handling mode:
   * - 'nullable' (default): returns null on any failure
   * - 'strict': throws typed errors for debugging
   */
  mode?: 'nullable' | 'strict';
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

function defaultBaseURL(): string {
  const explicit = typeof process !== 'undefined' ? process.env.NAJM_AUTH_BASE_URL : undefined;
  if (explicit) return explicit;
  const origin = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`)
    : 'http://localhost:3000';
  return `${origin.replace(/\/$/, '')}/api`;
}

/**
 * Resolve a session in a Next.js Server Component, Route Handler, or Server
 * Action. Recovery returns claims for the current render but cannot persist
 * response cookies during Server Component rendering; middleware performs that
 * persistence for protected navigation.
 */
export async function getSession(config: GetSessionConfig = {}): Promise<ServerSession | null> {
  const cookieName = config.cookieName ?? 'refreshToken';
  const sessionCookieName = config.sessionCookieName ?? 'najm.session';
  const baseURL = config.baseURL ?? defaultBaseURL();
  const prefix = config.authPrefix ?? '/auth';
  const strict = config.mode === 'strict';

  let sessionCookieValue: string | undefined;
  let refreshCookieValue: string | undefined;

  try {
    const mod = await import('next/headers');
    const cookieStore = await mod.cookies();
    sessionCookieValue = cookieStore.get(sessionCookieName)?.value;
    refreshCookieValue = cookieStore.get(cookieName)?.value;
  } catch {
    if (strict) throw new AuthConfigError('Failed to read cookies from Next.js headers()');
    return null;
  }

  const secret = resolveSessionSecret(config.sessionSecret);

  if (sessionCookieValue && secret) {
    const claims = await verifySessionCookie(sessionCookieValue, {
      secret,
      maxAgeSeconds: config.sessionMaxAge,
    });
    if (claims) {
      return {
        user: claims.user,
        roles: claims.roles,
        permissions: claims.permissions,
      };
    }
  }

  if (!secret) {
    if (strict) throw new AuthConfigError('Session cookie secret is not configured');
    return null;
  }
  if (!refreshCookieValue || config.recoveryURL === false) {
    if (strict) throw new NoSessionError('No recoverable refresh session');
    return null;
  }

  const endpoint = config.recoveryURL
    ? new URL(config.recoveryURL, baseURL).toString()
    : authEndpoint(baseURL, prefix, '/session/recover');
  const recovery = await requestSessionRecovery({
    endpoint,
    refreshCookieName: cookieName,
    refreshCookieValue,
    sessionCookieName,
    sessionSecret: secret,
    sessionMaxAge: config.sessionMaxAge,
  });

  if (recovery.status === 'recovered') {
    return {
      user: recovery.claims.user,
      roles: recovery.claims.roles,
      permissions: recovery.claims.permissions,
    };
  }
  if (strict) {
    if (recovery.status === 'invalid') {
      throw new NoSessionError('Refresh session is invalid or revoked');
    }
    throw new AuthTransportError(
      'Session recovery endpoint was unavailable or returned an invalid session',
      recovery.httpStatus,
    );
  }
  return null;
}
