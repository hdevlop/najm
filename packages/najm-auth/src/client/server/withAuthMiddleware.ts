// ============================================================================
// withAuthMiddleware — Next.js Edge Middleware helper
// ============================================================================

import {
  readCookieValue,
  resolveSessionSecret,
  verifySessionCookie,
} from '../sessionCookie';

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
  /** Signed session cookie name (default: 'najm.session') */
  sessionCookieName?: string;
  /** @deprecated Session cookies are verified locally at the Edge. */
  verifyURL?: string;
  /** Secret for verifying the session cookie HMAC. Falls back to env vars. */
  sessionSecret?: string;
  /** Must match the auth plugin's session.maxAge. Default: 300 seconds. */
  sessionMaxAge?: number;
  /**
   * Retained for compatibility. Every protected route now verifies the signed
   * session cookie locally, so enabling this never calls `/auth/me`.
   */
  verifyAlways?: boolean;
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
    sessionCookieName = 'najm.session',
    sessionSecret,
    sessionMaxAge,
    verifyAlways = false,
  } = config;
  void verifyAlways;

  return async function middleware(request: Request) {
    // Dynamic import for edge compatibility
    const { NextResponse } = await import('next/server');

    const redirectToLogin = (pathname: string, clearCookies: boolean) => {
      const loginUrl = new URL(loginRoute, request.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      if (clearCookies) {
        res.cookies.delete(cookieName);
        res.cookies.delete(sessionCookieName);
      }
      return res;
    };

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Skip public routes
    if (matchesAny(pathname, publicRoutes)) {
      return NextResponse.next();
    }

    // Check if route is protected
    const isProtected = protectedRoutes.length === 0 || matchesAny(pathname, protectedRoutes);
    if (!isProtected) return NextResponse.next();

    // Refresh-cookie presence is never treated as authentication.
    const cookie = request.headers.get('cookie') ?? '';
    const sessionCookie = readCookieValue(cookie, sessionCookieName);
    const secret = resolveSessionSecret(sessionSecret);
    if (!sessionCookie || !secret) {
      return redirectToLogin(pathname, true);
    }

    const session = await verifySessionCookie(sessionCookie, {
      secret,
      maxAgeSeconds: sessionMaxAge,
    });
    if (!session) {
      return redirectToLogin(pathname, true);
    }

    // Role decisions are made only from the verified session claims.
    const requiredRoles = findMatchingRoles(pathname, roleRoutes);
    if (requiredRoles && !session.roles.some((role) => requiredRoles.includes(role))) {
      return new NextResponse(null, { status: 403 });
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
