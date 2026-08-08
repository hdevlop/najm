// ============================================================================
// Internal bridge: defineAuth() → najm-auth/client/server/react
// ============================================================================
//
// The React-server adapter needs the resolution work and the redirect routes a
// `defineAuth()` call already owns, without those becoming public API or being
// asked of the application a second time.
//
// tsup bundles every entry point separately, so `dist/client/server/index.js`
// and `dist/client/server/react.js` each carry their own copy of this module.
// A plain `Symbol()` would therefore be two different keys. `Symbol.for` looks
// the key up in the cross-realm registry, which is the one identity both
// bundles agree on.
// ============================================================================

import type { FailedSessionOutcome, ServerSession, SessionOutcome } from './getSession';

export const REACT_SERVER_INTERNALS = Symbol.for('najm-auth.reactServerInternals');

/**
 * Whether a non-authenticated outcome sends the visitor to the login route.
 *
 * A 401/403 from recovery is an unauthenticated answer wearing a transport
 * error; every other transport or configuration failure is an operational
 * fault and must stay a visible error rather than become a login loop.
 *
 * The check reads `code` instead of using `instanceof`. The outcome is built in
 * the `client/server` bundle and read in the `client/server/react` one, and
 * each bundle has its own copy of the error classes — `instanceof` would be
 * false across that boundary.
 */
export function redirectsToLogin(outcome: FailedSessionOutcome): boolean {
  if (outcome.status === 'unauthenticated') return true;
  const { code, status } = outcome.error as { code?: string; status?: number };
  return code === 'AUTH_TRANSPORT_ERROR' && (status === 401 || status === 403);
}

export interface ReactServerInternals {
  /** One full resolution, classified but not yet interpreted. */
  resolveSessionOutcome: () => Promise<SessionOutcome>;
  /** Redirect targets owned by `defineAuth()`, never re-accepted as app options. */
  loginRoute: string;
  forbiddenRoute: string;
}

/**
 * The roles a session holds. `roles` is the authoritative list when present;
 * `user.role` is the single-role shape older sessions carry.
 */
export function heldRoles(session: ServerSession): string[] {
  return session.roles ?? (session.user.role ? [session.user.role] : []);
}

export function attachReactServerInternals<T extends object>(
  kit: T,
  internals: ReactServerInternals,
): T {
  Object.defineProperty(kit, REACT_SERVER_INTERNALS, {
    value: internals,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return kit;
}

export function readReactServerInternals(auth: unknown): ReactServerInternals | undefined {
  if (auth === null || (typeof auth !== 'object' && typeof auth !== 'function')) return undefined;
  return (auth as Record<symbol, ReactServerInternals | undefined>)[REACT_SERVER_INTERNALS];
}
