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
import type { SessionRecoveryFailure } from '../sessionRecovery';
import { withAuthMiddleware } from './withAuthMiddleware';

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
  /** Must match the auth plugin's session.maxAge. Default: 300 seconds. */
  sessionMaxAge?: number;
  /**
   * Session-recovery endpoint. Defaults to
   * `${apiBaseURL}${authPrefix}/session/recover`; false disables recovery.
   */
  recoveryURL?: string | false;
  /** Loopback-only recovery endpoint for self-hosted reverse-proxy setups. */
  internalRecoveryURL?: string;
  /** Next.js middleware matcher (default: exclude _next, favicon, api) */
  matcher?: string[];
  /**
   * Force authoritative refresh-session validation on every protected request.
   * Recovery reissues the signed cookie without rotating refresh tokens.
   */
  verifyAlways?: boolean;
  /** Secret-free diagnostic hook for failed server or proxy recovery. */
  onRecoveryFailure?: (failure: SessionRecoveryFailure) => void;
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
  /** Resolve session — signed-cookie first, then non-rotating recovery. */
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
    sessionMaxAge,
    recoveryURL,
    internalRecoveryURL,
    matcher = ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
    verifyAlways = false,
    onRecoveryFailure,
    refreshThreshold,
    tabSync,
    channelName,
    timeout,
    retry,
  } = authConfig;

  // Shared session config
  const sessionConfig: GetSessionConfig = {
    baseURL: apiBaseURL,
    authPrefix,
    cookieName,
    sessionCookieName,
    sessionSecret,
    sessionMaxAge,
    recoveryURL,
    internalRecoveryURL,
    onRecoveryFailure,
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
  const middleware = withAuthMiddleware({
    protectedRoutes,
    publicRoutes,
    loginRoute,
    roleRoutes,
    cookieName,
    apiBaseURL,
    authPrefix,
    sessionCookieName,
    sessionSecret,
    sessionMaxAge,
    recoveryURL,
    internalRecoveryURL,
    verifyAlways,
    onRecoveryFailure,
  });

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
