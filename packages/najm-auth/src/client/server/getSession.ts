// ============================================================================
// getSession — Next.js Server Component / Route Handler helper
// ============================================================================
//
// Resolution order:
// 1. Read signed `najm.session` cookie → verify HMAC → return instantly (0 fetch)
// 2. Fallback: check `refreshToken` cookie → fetch /auth/me → return
// 3. Return null if unauthenticated
// ============================================================================

import { createHmac, timingSafeEqual } from 'crypto';
import type { AuthUser, ServerResponse } from '../types';

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

function getSessionSecret(config: GetSessionConfig): string | undefined {
  return config.sessionSecret
    ?? (typeof process !== 'undefined' ? process.env.NAJM_SESSION_SECRET : undefined)
    ?? (typeof process !== 'undefined' ? process.env.JWT_ACCESS_SECRET : undefined);
}

function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

const SESSION_COOKIE_MAX_AGE_MS = 300_000; // 5 minutes

function parseSessionCookie(raw: string, secret: string): ServerSession | null {
  const lastDot = raw.lastIndexOf('.');
  if (lastDot === -1) return null;

  const payload = raw.substring(0, lastDot);
  const signature = raw.substring(lastDot + 1);

  if (!verifyHmac(payload, signature, secret)) return null;

  try {
    const decoded = decodeURIComponent(payload);
    const data = JSON.parse(decoded);
    // Check TTL
    if (Date.now() - data.iat > SESSION_COOKIE_MAX_AGE_MS) return null;

    const { user, roles, permissions } = data;
    return {
      user,
      roles: roles ?? (user.role ? [user.role] : undefined),
      permissions: permissions ?? undefined,
    };
  } catch {
    return null;
  }
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
    const secret = getSessionSecret(config);
    if (secret) {
      const session = parseSessionCookie(sessionCookieValue, secret);
      if (session) return session;
    }
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
