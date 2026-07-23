// ============================================================================
// getSession — Next.js Server Component / Route Handler helper
// ============================================================================
//
// Resolution order:
// 1. Read signed `najm.session` cookie → verify HMAC → return instantly (0 fetch)
// 2. Fallback: check `refreshToken` cookie → fetch /auth/me → return
// 3. Return null if unauthenticated
// ============================================================================

import type { AuthUser, ServerResponse } from '../types';
import { resolveSessionSecret, verifySessionCookie } from '../sessionCookie';

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
  /**
   * Auth route prefix appended to baseURL (default: '/auth').
   */
  authPrefix?: string;
  /**
   * Refresh token cookie name to check before making the network call.
   * If absent we skip and return null immediately.
   * Default: 'refreshToken'
   */
  cookieName?: string;
  /**
   * Session cookie name (default: 'najm.session').
   * When present and valid, skips the /auth/me fetch entirely.
   */
  sessionCookieName?: string;
  /**
   * Secret used to verify the session cookie HMAC signature.
   * Must match the `jwt.accessSecret` used by the auth plugin.
   * Falls back to NAJM_SESSION_SECRET or JWT_ACCESS_SECRET env vars.
   */
  sessionSecret?: string;
  /**
   * Maximum accepted session-cookie age in seconds.
   * Must match the auth plugin's `session.maxAge`. Default: 300.
   */
  sessionMaxAge?: number;
  /**
   * Error handling mode:
   * - 'nullable' (default): returns null on any failure
   * - 'strict': throws typed errors for debugging
   */
  mode?: 'nullable' | 'strict';
}

// ============================================================================
// Error types for strict mode
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

function defaultBaseURL(): string {
  const explicit = typeof process !== 'undefined' ? process.env.NAJM_AUTH_BASE_URL : undefined;
  if (explicit) return explicit;
  const origin = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`)
    : 'http://localhost:3000';
  return `${origin.replace(/\/$/, '')}/api`;
}

function buildSession(body: any): ServerSession | null {
  if (!body?.data) return null;
  const { roles, permissions, ...user } = body.data as AuthUser & { roles?: string[]; permissions?: string[] };
  return {
    user: user as AuthUser,
    roles: roles ?? (user.role ? [user.role] : undefined),
    permissions: permissions ?? (user.permissions as string[] | undefined),
  };
}

// ============================================================================
// Main export
// ============================================================================

/**
 * Resolve the current session inside a Next.js Server Component, Route Handler,
 * or Server Action.
 *
 * **Fast path**: If a signed `najm.session` cookie exists and is valid,
 * returns the session instantly with zero network calls.
 *
 * **Fallback**: Checks the refresh token cookie and calls `/auth/me`.
 *
 * @example
 * ```tsx
 * import { getSession } from 'najm-auth/client/server';
 *
 * export default async function RootLayout({ children }) {
 *   const session = await getSession();
 *   return (
 *     <html><body>
 *       <AuthProvider client={authClient} initialSession={session}>
 *         {children}
 *       </AuthProvider>
 *     </body></html>
 *   );
 * }
 * ```
 */
export async function getSession(config: GetSessionConfig = {}): Promise<ServerSession | null> {
  const cookieName = config.cookieName ?? 'refreshToken';
  const sessionCookieName = config.sessionCookieName ?? 'najm.session';
  const baseURL = config.baseURL ?? defaultBaseURL();
  const prefix = config.authPrefix ?? '/auth';
  const strict = config.mode === 'strict';

  let cookieHeader = '';
  let sessionCookieValue: string | undefined;
  let hasRefreshCookie = false;

  try {
    const mod = await import('next/headers');
    const cookieStore = await mod.cookies();

    // Try session cookie first
    const sessionCookie = cookieStore.get(sessionCookieName);
    if (sessionCookie) sessionCookieValue = sessionCookie.value;

    // Check refresh cookie
    if (typeof cookieStore.get === 'function') {
      hasRefreshCookie = !!cookieStore.get(cookieName);
    }

    cookieHeader = cookieStore
      .getAll()
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');
  } catch (err) {
    if (strict) throw new AuthConfigError('Failed to read cookies from Next.js headers()');
    return null;
  }

  // ---- Fast path: signed session cookie ----
  if (sessionCookieValue) {
    const secret = resolveSessionSecret(config.sessionSecret);
    if (!secret) {
      if (strict) throw new AuthConfigError('Session cookie secret is not configured');
      return null;
    }

    const claims = await verifySessionCookie(sessionCookieValue, {
      secret,
      maxAgeSeconds: config.sessionMaxAge,
    });
    if (!claims) {
      if (strict) throw new NoSessionError('Invalid or expired session cookie');
      return null;
    }

    return {
      user: claims.user,
      roles: claims.roles,
      permissions: claims.permissions,
    };
  }

  // ---- Fallback: /auth/me fetch ----
  if (!hasRefreshCookie) {
    if (strict) throw new NoSessionError('No refresh token cookie');
    return null;
  }

  if (!cookieHeader) {
    if (strict) throw new NoSessionError('Empty cookie header');
    return null;
  }

  try {
    const res = await fetch(`${baseURL}${prefix}/me`, {
      headers: { Cookie: cookieHeader, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (strict) throw new AuthTransportError(`/auth/me returned ${res.status}`, res.status);
      return null;
    }
    const body = await res.json();
    const session = buildSession(body);
    if (!session && strict) throw new NoSessionError('No user data in /auth/me response');
    return session;
  } catch (err) {
    if (err instanceof NoSessionError || err instanceof AuthTransportError) throw err;
    if (strict) throw new AuthTransportError(`Failed to fetch /auth/me: ${(err as Error).message}`);
    return null;
  }
}
