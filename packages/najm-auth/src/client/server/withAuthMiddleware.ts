// ============================================================================
// withAuthMiddleware — Next.js Edge Middleware helper
// ============================================================================

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
  /** Session cookie name to clear on redirect (default: 'najm.session') */
  sessionCookieName?: string;
  /** URL of the verify endpoint (default: derived from request) */
  verifyURL?: string;
  /**
   * When true, call the verify endpoint on EVERY protected route (not just
   * roleRoutes). Redirects to loginRoute if the session is invalid. Adds one
   * fetch per navigation — trade latency for stronger guarantees.
   */
  verifyAlways?: boolean;
}

/**
 * Create a Next.js middleware function that protects routes based on auth state.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { withAuthMiddleware } from 'najm-auth/client/server';
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
    verifyAlways = false,
  } = config;

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

    // Check for refresh token cookie
    const cookie = request.headers.get('cookie') ?? '';
    const hasToken = cookieRegex(cookieName).test(cookie);

    if (!hasToken) {
      return redirectToLogin(pathname, true);
    }

    // Verify session server-side if roles or verifyAlways demands it
    const requiredRoles = findMatchingRoles(pathname, roleRoutes);
    const needsVerify = verifyAlways || !!requiredRoles;
    if (needsVerify) {
      const verifyURL = config.verifyURL ?? `${url.origin}/api/auth/me`;

      try {
        const res = await fetch(verifyURL, {
          headers: { 'Cookie': cookie, 'Accept': 'application/json' },
        });

        if (!res.ok) {
          return redirectToLogin(pathname, true);
        }

        if (requiredRoles) {
          const body = await res.json();
          const userRole = body?.data?.role;

          if (!userRole || !requiredRoles.includes(userRole)) {
            return new NextResponse(null, { status: 403 });
          }
        }
      } catch {
        return redirectToLogin(pathname, true);
      }
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

function cookieRegex(name: string): RegExp {
  return new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=[^;]`);
}

function findMatchingRoles(pathname: string, roleRoutes: Record<string, string[]>): string[] | null {
  for (const [pattern, roles] of Object.entries(roleRoutes)) {
    if (matchPattern(pathname, pattern)) return roles;
  }
  return null;
}
