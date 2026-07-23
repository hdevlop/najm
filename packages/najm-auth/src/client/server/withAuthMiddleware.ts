// ============================================================================
// withAuthMiddleware — Next.js Edge Middleware helper
// ============================================================================

import {
  readCookieValue,
  resolveSessionSecret,
  verifySessionCookie,
} from '../sessionCookie';
import {
  authEndpoint,
  replaceCookieValue,
  resolveInternalRecoveryURL,
  requestSessionRecovery,
  type SessionRecoveryFailure,
  type SessionRecoveryResult,
} from '../sessionRecovery';

export interface AuthMiddlewareConfig {
  /** Routes that require authentication (glob patterns) */
  protectedRoutes?: string[];
  /** Always-public routes (glob patterns) */
  publicRoutes?: string[];
  /** Route to redirect unauthenticated users to */
  loginRoute?: string;
  /** Routes restricted to specific roles: { '/admin/*': ['admin'] } */
  roleRoutes?: Record<string, string[]>;
  /** Refresh token cookie name (default: 'refreshToken') */
  cookieName?: string;
  /** API base URL used by session recovery (default: '/api'). */
  apiBaseURL?: string;
  /** Auth endpoint prefix used by session recovery (default: '/auth'). */
  authPrefix?: string;
  /** Signed session cookie name (default: 'najm.session') */
  sessionCookieName?: string;
  /** @deprecated Session cookies are verified locally at the Edge. */
  verifyURL?: string;
  /** Secret for verifying the session cookie HMAC. Falls back to env vars. */
  sessionSecret?: string;
  /** Must match the auth plugin's session.maxAge. Default: 300 seconds. */
  sessionMaxAge?: number;
  /**
   * Force authoritative refresh-session validation on every protected request.
   * This reissues the signed session cookie without rotating refresh tokens.
   */
  verifyAlways?: boolean;
  /**
   * Session-recovery endpoint. Relative values resolve against the request
   * origin. Defaults to `${apiBaseURL}${authPrefix}/session/recover`.
   * Set to false to disable automatic recovery.
   */
  recoveryURL?: string | false;
  /**
   * Optional loopback-only endpoint for self-hosted apps whose public origin
   * cannot be reached from the app container. Takes precedence over
   * `recoveryURL` for the server-side recovery request.
   */
  internalRecoveryURL?: string;
  /** Secret-free diagnostic hook for failed authoritative recovery attempts. */
  onRecoveryFailure?: (failure: SessionRecoveryFailure) => void;
}

/**
 * Create a Next.js middleware function that protects routes based on auth state.
 *
 * @example
 * ```ts
 * // middleware.ts
   * import { withAuthMiddleware } from 'najm-auth/client/edge';
 *
 * export default withAuthMiddleware({
 *   protectedRoutes: ['/dashboard/:path*', '/admin/:path*'],
 *   publicRoutes: ['/', '/about', '/login', '/register'],
 *   loginRoute: '/login',
 *   roleRoutes: { '/admin/:path*': ['admin'] },
 * });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 */
export function withAuthMiddleware(config: AuthMiddlewareConfig) {
  const {
    protectedRoutes = [],
    publicRoutes = [],
    loginRoute = '/login',
    roleRoutes = {},
    cookieName = 'refreshToken',
    apiBaseURL = '/api',
    authPrefix = '/auth',
    sessionCookieName = 'najm.session',
    sessionSecret,
    sessionMaxAge,
    verifyAlways = false,
    recoveryURL,
    internalRecoveryURL,
    onRecoveryFailure,
  } = config;
  const resolvedInternalRecoveryURL = resolveInternalRecoveryURL(internalRecoveryURL);

  return async function middleware(request: Request) {
    // Dynamic import for edge compatibility
    const { NextResponse } = await import('next/server');

    const redirectToLogin = (
      returnPath: string,
      clearCookies: Array<'refresh' | 'session'>,
    ) => {
      const loginUrl = new URL(loginRoute, request.url);
      loginUrl.searchParams.set('from', returnPath);
      const res = NextResponse.redirect(loginUrl);
      if (clearCookies.includes('refresh')) {
        res.cookies.delete(cookieName);
      }
      if (clearCookies.includes('session')) {
        res.cookies.delete(sessionCookieName);
      }
      return res;
    };

    const url = new URL(request.url);
    const pathname = url.pathname;
    const returnPath = `${url.pathname}${url.search}`;

    // Skip public routes
    if (matchesAny(pathname, publicRoutes)) {
      return NextResponse.next();
    }

    // Check if route is protected
    const isProtected = protectedRoutes.length === 0 || matchesAny(pathname, protectedRoutes);
    if (!isProtected) return NextResponse.next();

    const cookie = request.headers.get('cookie') ?? '';
    const sessionCookie = readCookieValue(cookie, sessionCookieName);
    const secret = resolveSessionSecret(sessionSecret);
    if (!secret) {
      return redirectToLogin(returnPath, ['session']);
    }

    let session = sessionCookie
      ? await verifySessionCookie(sessionCookie, {
          secret,
          maxAgeSeconds: sessionMaxAge,
        })
      : null;
    let recovery: SessionRecoveryResult | null = null;

    // A refresh cookie is input to authoritative recovery, never proof of
    // authentication by itself.
    if (!session || verifyAlways) {
      const refreshCookie = readCookieValue(cookie, cookieName);
      if (!refreshCookie || (recoveryURL === false && !resolvedInternalRecoveryURL)) {
        return redirectToLogin(returnPath, ['refresh', 'session']);
      }

      const endpoint = resolvedInternalRecoveryURL
        ?? (recoveryURL
          ? new URL(recoveryURL, request.url).toString()
          : authEndpoint(apiBaseURL, authPrefix, '/session/recover', request.url));
      recovery = await requestSessionRecovery({
        endpoint,
        requestOrigin: url.origin,
        allowLoopbackEndpoint: resolvedInternalRecoveryURL !== undefined,
        refreshCookieName: cookieName,
        refreshCookieValue: refreshCookie,
        sessionCookieName,
        sessionSecret: secret,
        sessionMaxAge,
        onFailure: onRecoveryFailure,
      });

      if (recovery.status !== 'recovered') {
        return redirectToLogin(
          returnPath,
          recovery.status === 'invalid' ? ['refresh', 'session'] : ['session'],
        );
      }
      session = recovery.claims;
    }

    const requiredRoles = findMatchingRoles(pathname, roleRoutes);
    if (requiredRoles && !session.roles.some((role) => requiredRoles.includes(role))) {
      const forbidden = new NextResponse(null, { status: 403 });
      if (recovery?.status === 'recovered') {
        forbidden.headers.append('Set-Cookie', recovery.setCookie);
      }
      return forbidden;
    }

    if (recovery?.status === 'recovered') {
      // Make the recovered session visible to Server Components in this same
      // request, and persist it in the browser for subsequent navigation.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        'cookie',
        replaceCookieValue(cookie, sessionCookieName, recovery.sessionCookieValue),
      );
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.append('Set-Cookie', recovery.setCookie);
      return response;
    }

    return NextResponse.next();
  };
}

// =========================================================================
// Path Matching Helpers
// =========================================================================

function matchesAny(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => matchPattern(pathname, p));
}

function matchPattern(pathname: string, pattern: string): boolean {
  // Escape regex metacharacters in the literal parts of the pattern
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  const regex = escaped
    .replace(/\/:[^/]+\*/g, '(?:/.*)?') // /:path* → optional /rest
    .replace(/\/\\\*$/g, '(?:/.*)?')    // trailing /* → optional /rest
    .replace(/\\\*/g, '(?:/.*)?')       // standalone * → optional /rest
    .replace(/\//g, '\\/');              // Escape slashes

  return new RegExp(`^${regex}$`).test(pathname);
}

function findMatchingRoles(pathname: string, roleRoutes: Record<string, string[]>): string[] | null {
  for (const [pattern, roles] of Object.entries(roleRoutes)) {
    if (matchPattern(pathname, pattern)) return roles;
  }
  return null;
}
