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

import type { ServerSession, GetSessionConfig, SessionOutcome } from './getSession';
import { createAuthClient, type NajmAuthClient } from '../NajmAuthClient';
import type { FetchClient } from '../FetchClient';
import type { RetryConfig } from '../types';
import type { SessionRecoveryFailure } from '../sessionRecovery';
import { attachReactServerInternals, heldRoles, redirectsToLogin } from './internals';
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
  /**
   * Where an *authenticated* user goes when their role is not allowed
   * (default: '/forbidden').
   *
   * Distinct from `loginRoute` on purpose. Sending them to the login form says
   * "prove who you are" to someone who already has; they log in again, land
   * back on the same page, and get bounced again. A forbidden page is the only
   * response that terminates.
   */
  forbiddenRoute?: string;
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
  /**
   * Require one of `roles` — redirects to `loginRoute` when unauthenticated and
   * to `forbiddenRoute` when authenticated as the wrong role.
   *
   * ```ts
   * const session = await auth.requireRole(['admin', 'operator']);
   * ```
   */
  requireRole: (roles: string[]) => Promise<ServerSession>;
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
    forbiddenRoute = '/forbidden',
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

  // ---------- resolveSessionOutcome ----------
  // One classified resolution. The strict guard below and the React-server
  // adapter both interpret this value, so neither can drift from the other.
  const resolveSessionOutcome = async (): Promise<SessionOutcome> => {
    const { resolveSessionOutcome: resolve } = await import('./getSession');
    return resolve(sessionConfig);
  };

  // ---------- requireSession ----------
  const requireSession = async (): Promise<ServerSession> => {
    const outcome = await resolveSessionOutcome();

    if (outcome.status === 'authenticated') return outcome.session;

    if (redirectsToLogin(outcome)) {
      const { redirect } = await import('next/navigation');
      redirect(loginRoute);
    }

    throw outcome.error;
  };

  // ---------- requireRole ----------
  const requireRole = async (roles: string[]): Promise<ServerSession> => {
    const session = await requireSession();

    if (!heldRoles(session).some((role) => roles.includes(role))) {
      const { redirect } = await import('next/navigation');
      redirect(forbiddenRoute);
    }

    return session;
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

      // Authenticated but not allowed is `forbiddenRoute`, not `loginRoute`:
      // re-authenticating cannot change the answer, so sending them to the form
      // only loops them back here.
      if (options?.role) {
        if (!heldRoles(session).includes(options.role)) {
          const { redirect } = await import('next/navigation');
          redirect(forbiddenRoute);
        }
      }

      if (options?.permission) {
        const { matchPermission } = await import('../permissions');
        const perms = session.permissions ?? session.user.permissions ?? [];
        if (!matchPermission(perms, options.permission)) {
          const { redirect } = await import('next/navigation');
          redirect(forbiddenRoute);
        }
      }

      return Page({ session, ...props });
    };
  };

  // ---------- Return kit ----------
  // The internals are a non-enumerable symbol property rather than a method:
  // `najm-auth/client/server/react` needs them, no application does.
  return attachReactServerInternals({
    get client() {
      return getClient();
    },
    get api() {
      return getClient().api;
    },
    getSession,
    requireSession,
    requireRole,
    middleware,
    config: { matcher },
    protect,
  }, { resolveSessionOutcome, loginRoute, forbiddenRoute });
}
