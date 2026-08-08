// ============================================================================
// najm-auth/client/server/react — one session per React server request
// ============================================================================
//
// A Next.js page is not one function. The root layout, a nested layout, and the
// page itself each render separately, and each one that asks for the session
// pays for its own cookie verification and possibly its own recovery round
// trip. React's `cache()` collapses those into one, but only when every caller
// goes through the *same* memoized function — which means the application must
// own one module that creates it.
//
// This adapter is that module's implementation. The app keeps a three-line
// facade; every rule about strictness, redirects, and role fallback stays here.
//
// @example
// ```ts
// // src/lib/session.ts
// import 'server-only';
//
// import { createReactServerAuth } from 'najm-auth/client/server/react';
//
// import { auth } from './auth';
//
// export const serverAuth = createReactServerAuth(auth);
// ```
//
// React Server Components only. Route handlers, server actions, proxy/Edge
// code, and scripts keep using `auth.getSession()` and friends — outside a
// render there is no request cache for `cache()` to write to, so the adapter
// would silently resolve the session again on every call.
//
// The snapshot is deliberately stable for the length of one render. Code that
// mutates authentication (login, logout, role change) must redirect or refresh
// into a new render to observe the result.
// ============================================================================

import * as React from 'react';

import type { ServerSession } from './getSession';
import { heldRoles, readReactServerInternals, redirectsToLogin } from './internals';

if (typeof window !== 'undefined') {
  throw new Error(
    'najm-auth/client/server/react is a React Server Component module and cannot be '
    + 'imported from a Client Component. Import najm-auth/client/react instead.',
  );
}

/**
 * The `defineAuth()` result.
 *
 * Declared structurally rather than as `AuthKit` on purpose: each entry point
 * bundles its own declarations, and `AuthKit` reaches classes whose private
 * members would make the two copies nominally incompatible.
 */
export interface ReactServerAuthSource {
  getSession(): Promise<ServerSession | null>;
  requireSession(): Promise<ServerSession>;
  requireRole(roles: string[]): Promise<ServerSession>;
}

export interface ReactServerAuth {
  /** The session for this request, or `null` when there is none. */
  getSession(): Promise<ServerSession | null>;
  /**
   * The session for this request, redirecting to `loginRoute` when the visitor
   * is unauthenticated.
   *
   * A recovery endpoint that is unreachable or a missing session secret is an
   * operational fault, not an anonymous visitor: those stay visible errors
   * rather than becoming a login redirect that hides the outage.
   */
  requireSession(): Promise<ServerSession>;
  /**
   * The session for this request, redirecting to `forbiddenRoute` when it holds
   * none of `roles`. Not the login route — the visitor is already
   * authenticated, so signing in again cannot change the answer.
   */
  requireRole(roles: string[]): Promise<ServerSession>;
}

/**
 * Create the app's single request-scoped session accessor.
 *
 * Call this exactly once, at module scope, in a module the whole app imports.
 * Calling it inside a layout, page, or component creates a fresh memoized
 * resolver per call and shares nothing.
 *
 * Redirect routes and error classification come from the `defineAuth()` config
 * that produced `auth`; they are not re-accepted here.
 */
export function createReactServerAuth(auth: ReactServerAuthSource): ReactServerAuth {
  const internals = readReactServerInternals(auth);
  if (!internals) {
    throw new Error(
      'createReactServerAuth() expects the object returned by defineAuth() from '
      + 'najm-auth/client/server. Check that both imports resolve to the same '
      + 'installed najm-auth version.',
    );
  }

  const cache = (React as { cache?: <T extends (...args: never[]) => unknown>(fn: T) => T }).cache;
  if (typeof cache !== 'function') {
    throw new Error(
      'najm-auth/client/server/react requires a React version that exports cache() '
      + '(React 18.3 or newer). Upgrade react, or use auth.getSession() directly.',
    );
  }

  // Created once per imported module — never per render, per component, or per
  // call — so every caller in a request reaches the same memoization entry.
  const resolve = cache(internals.resolveSessionOutcome);

  const getSession = async (): Promise<ServerSession | null> => {
    const outcome = await resolve();
    return outcome.status === 'authenticated' ? outcome.session : null;
  };

  const requireSession = async (): Promise<ServerSession> => {
    const outcome = await resolve();
    if (outcome.status === 'authenticated') return outcome.session;

    if (redirectsToLogin(outcome)) {
      const { redirect } = await import('next/navigation');
      redirect(internals.loginRoute);
    }

    throw outcome.error;
  };

  const requireRole = async (roles: string[]): Promise<ServerSession> => {
    const session = await requireSession();

    if (!heldRoles(session).some((role) => roles.includes(role))) {
      const { redirect } = await import('next/navigation');
      redirect(internals.forbiddenRoute);
    }

    return session;
  };

  return { getSession, requireSession, requireRole };
}
