// ============================================================================
// defineAuth — Unified Next.js Auth Surface
// ============================================================================
//
// One config → one import → everything you need:
//   client, api, getSession(), middleware, config, protect
//
// @example
// ```ts
// // src/lib/auth.ts
// import { defineAuth } from 'najm-auth/client/server';
//
// export const auth = defineAuth({
//   apiBaseURL: '/api',
//   loginRoute: '/login',
//   publicRoutes: ['/', '/login', '/register'],
//   protectedRoutes: ['/dashboard/:path*', '/admin/:path*'],
//   roleRoutes: { '/admin/:path*': ['admin'] },
//   tabSync: true,
//   refreshThreshold: 0.8,
// });
// ```
//
// ```ts
// // src/middleware.ts
// export { middleware, config } from '@/lib/auth';
// ```
//
// ```tsx
// // src/app/providers.tsx
// 'use client';
// import { AuthProvider } from 'najm-auth/client/react';
// import { auth } from '@/lib/auth';
//
// export function AppProviders({ children }) {
//   return <AuthProvider client={auth.client}>{children}</AuthProvider>;
// }
// ```
// ============================================================================

import type { ServerSession, GetSessionConfig } from './getSession';
import { createAuthClient, type NajmAuthClient } from '../NajmAuthClient';
import type { FetchClient } from '../FetchClient';
import type { RetryConfig } from '../types';

// ============================================================================
// Config
// ============================================================================

export interface DefineAuthConfig {
  // ---------- Shared (client + server) ----------
  /** API base URL (default: '/api') */
  apiBaseURL?: string;
  /** Auth prefix appended to apiBaseURL (default: '/auth') */
  authPrefix?: string;
  /** Refresh token cookie name (default: 'refreshToken') */
  cookieName?: string;

  // ---------- Browser client ----------
  /** Proactive refresh at this fraction of token lifetime (default: 0.8) */
  refreshThreshold?: number;
  /** Enable multi-tab sync via BroadcastChannel (default: true) */
  tabSync?: boolean;
  /** BroadcastChannel name (default: 'najm-auth') */
  channelName?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Network retry configuration */
  retry?: RetryConfig;

  // ---------- Server / middleware ----------
  /** Route to redirect unauthenticated users (default: '/login') */
  loginRoute?: string;
  /** Route to redirect after login (default: '/dashboard') */
  afterLoginRoute?: string;
  /** Routes that are always public (glob patterns) */
  publicRoutes?: string[];
  /** Routes that require authentication (glob patterns) */
  protectedRoutes?: string[];
  /** Routes restricted to specific roles: { '/admin/:path*': ['admin'] } */
  roleRoutes?: Record<string, string[]>;
  /** Session cookie name (default: 'najm.session') */
  sessionCookieName?: string;
  /** Secret for verifying session cookie HMAC. Falls back to env vars. */
  sessionSecret?: string;
  /** Next.js middleware matcher (default: exclude _next, favicon, api) */
  matcher?: string[];
  /**
   * When true, call the verify endpoint on every protected route (not just
   * roleRoutes). Redirects to loginRoute if the session is invalid. One extra
   * fetch per navigation in exchange for guaranteed fresh auth state.
   */
  verifyAlways?: boolean;
}

// ============================================================================
// Return type
// ============================================================================

export interface AuthKit {
  /**
   * Browser auth client — lazily instantiated on first access.
   *
   * Safe to touch from server/edge runtimes (constructor is runtime-guarded),
   * but intended for client-side use via `<AuthProvider client={auth.client}>`.
   */
  readonly client: NajmAuthClient;
  /** Shortcut for `client.api` — the underlying FetchClient with auth attached. */
  readonly api: FetchClient;
  /** Resolve session — reads signed cookie first (instant), falls back to /auth/me */
  getSession: (opts?: Pick<GetSessionConfig, 'mode'>) => Promise<ServerSession | null>;
  /** Require session — throws if unauthenticated */
  requireSession: () => Promise<ServerSession>;
  /** Generated Next.js middleware function */
  middleware: (request: Request) => Promise<Response>;
  /** Next.js middleware config with matcher */
  config: { matcher: string[] };
  /**
   * Protect a server component — redirects to loginRoute if unauthenticated.
   * Passes session to the wrapped component.
   */
  protect: <P extends Record<string, unknown> = Record<string, unknown>>(
    Page: (args: { session: ServerSession; children?: unknown } & P) => Promise<unknown> | unknown,
    options?: { role?: string; permission?: string },
  ) => (props: P) => Promise<unknown>;
}

// ============================================================================
// Path matching (shared between middleware and protect)
// ============================================================================

function matchesAny(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => matchPattern(pathname, p));
}

function matchPattern(pathname: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = escaped
    .replace(/\/:[^/]+\*/g, '(?:/.*)?')
    .replace(/\/\\\*$/g, '(?:/.*)?')
    .replace(/\\\*/g, '(?:/.*)?')
    .replace(/\//g, '\\/');
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

// ============================================================================
// defineAuth
// ============================================================================

export function defineAuth(authConfig: DefineAuthConfig = {}): AuthKit {
  const {
    apiBaseURL = '/api',
    authPrefix = '/auth',
    loginRoute = '/login',
    publicRoutes = [],
    protectedRoutes = [],
    roleRoutes = {},
    cookieName = 'refreshToken',
    sessionCookieName = 'najm.session',
    sessionSecret,
    matcher = ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
    verifyAlways = false,
    refreshThreshold,
    tabSync,
    channelName,
    timeout,
    retry,
  } = authConfig;

  // Shared session config
  const sessionConfig: GetSessionConfig = {
    baseURL: undefined, // resolved at call time from env/defaults
    authPrefix,
    cookieName,
    sessionCookieName,
    sessionSecret,
  };

  // ---------- Lazy browser client ----------
  // Instantiated on first access so middleware.ts (edge) and server components
  // that never touch `auth.client` / `auth.api` don't pay construction cost
  // (BroadcastChannel probing, FetchClient setup). NajmAuthClient itself has
  // no eager browser-only imports, so statically importing it is safe in
  // edge and Node runtimes.
  let _client: NajmAuthClient | null = null;
  const getClient = (): NajmAuthClient => {
    if (_client) return _client;
    _client = createAuthClient({
      baseURL: apiBaseURL,
      authPrefix,
      refreshThreshold,
      tabSync,
      channelName,
      timeout,
      retry,
    });
    return _client;
  };

  // ---------- getSession ----------
  const getSession = async (opts?: Pick<GetSessionConfig, 'mode'>): Promise<ServerSession | null> => {
    const { getSession: resolveSession } = await import('./getSession');
    return resolveSession({ ...sessionConfig, ...opts });
  };

  // ---------- requireSession ----------
  const requireSession = async (): Promise<ServerSession> => {
    const sessionModule = await import('./getSession');
    const {
      getSession: resolveSession,
      NoSessionError,
      AuthTransportError,
    } = sessionModule;

    try {
      const session = await resolveSession({ ...sessionConfig, mode: 'strict' });
      return session;
    } catch (err) {
      if (err instanceof NoSessionError) {
        const { redirect } = await import('next/navigation');
        redirect(loginRoute);
      }

      if (err instanceof AuthTransportError && (err.status === 401 || err.status === 403)) {
        const { redirect } = await import('next/navigation');
        redirect(loginRoute);
      }

      throw err;
    }
  };

  // ---------- middleware ----------
  const middleware = async (request: Request): Promise<Response> => {
    const { NextResponse } = await import('next/server');
    const url = new URL(request.url);
    const pathname = url.pathname;

    const redirectToLogin = (clearCookies: boolean) => {
      const loginUrl = new URL(loginRoute, request.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      if (clearCookies) {
        res.cookies.delete(cookieName);
        res.cookies.delete(sessionCookieName);
      }
      return res;
    };

    // Skip public routes
    if (matchesAny(pathname, publicRoutes)) {
      return NextResponse.next();
    }

    // Check if route needs protection
    const isProtected = protectedRoutes.length === 0 || matchesAny(pathname, protectedRoutes);
    if (!isProtected) return NextResponse.next();

    // Check for refresh token cookie
    const cookie = request.headers.get('cookie') ?? '';
    const hasToken = cookieRegex(cookieName).test(cookie);

    if (!hasToken) {
      return redirectToLogin(true);
    }

    // Verify session server-side when roles are required or verifyAlways is set
    const requiredRoles = findMatchingRoles(pathname, roleRoutes);
    const needsVerify = verifyAlways || !!requiredRoles;
    if (needsVerify) {
      const verifyURL = `${url.origin}${apiBaseURL}${authPrefix}/me`;

      try {
        const res = await fetch(verifyURL, {
          headers: { Cookie: cookie, Accept: 'application/json' },
        });

        if (!res.ok) {
          return redirectToLogin(true);
        }

        if (requiredRoles) {
          const body = await res.json();
          const userRole = body?.data?.role;

          if (!userRole || !requiredRoles.includes(userRole)) {
            return new NextResponse(null, { status: 403 });
          }
        }
      } catch {
        return redirectToLogin(true);
      }
    }

    return NextResponse.next();
  };

  // ---------- protect ----------
  const protect = <P extends Record<string, unknown> = Record<string, unknown>>(
    Page: (args: { session: ServerSession; children?: unknown } & P) => Promise<unknown> | unknown,
    options?: { role?: string; permission?: string },
  ) => {
    return async function ProtectedPage(props: P) {
      const session = await getSession();

      if (!session) {
        const { redirect } = await import('next/navigation');
        redirect(loginRoute);
      }

      if (options?.role) {
        const userRoles = session.roles ?? (session.user.role ? [session.user.role] : []);
        if (!userRoles.includes(options.role)) {
          const { redirect } = await import('next/navigation');
          redirect(loginRoute);
        }
      }

      if (options?.permission) {
        const { matchPermission } = await import('../permissions');
        const perms = session.permissions ?? session.user.permissions ?? [];
        if (!matchPermission(perms, options.permission)) {
          const { redirect } = await import('next/navigation');
          redirect(loginRoute);
        }
      }

      return Page({ session, ...props });
    };
  };

  // ---------- Return kit ----------
  return {
    get client() {
      return getClient();
    },
    get api() {
      return getClient().api;
    },
    getSession,
    requireSession,
    middleware,
    config: { matcher },
    protect,
  };
}
