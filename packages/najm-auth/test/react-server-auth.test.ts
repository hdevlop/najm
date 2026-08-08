import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import * as React from 'react';

import type { ServerSession, SessionOutcome } from '../src/client/server/getSession';
import {
  AuthConfigError,
  AuthTransportError,
  NoSessionError,
} from '../src/client/server/getSession';
import { attachReactServerInternals } from '../src/client/server/internals';
import type { createReactServerAuth as CreateReactServerAuth } from '../src/client/server/react';

// React ships two builds. Only the one behind the `react-server` export
// condition memoizes `cache()`; the default build returns the function
// untouched. `bun test` resolves the default build, so the memoization group
// runs under `bun run test:rsc`, which adds the condition.
const REACT_SERVER_BUILD = typeof (React as { useState?: unknown }).useState !== 'function';
const requestCache = REACT_SERVER_BUILD
  ? (React as unknown as Record<string, { A: unknown }>)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  : undefined;

let createReactServerAuth: typeof CreateReactServerAuth;

beforeAll(async () => {
  // The adapter refuses to load beside a DOM global. Earlier files in this
  // package install happy-dom's window, which survives into this one.
  delete (globalThis as { window?: unknown }).window;
  ({ createReactServerAuth } = await import('../src/client/server/react'));
});

afterEach(() => endRequest());

/** Enter a React server request: everything inside shares one cache. */
function beginRequest(): void {
  if (!requestCache) return;
  const store = new Map<() => unknown, unknown>();
  requestCache.A = {
    getCacheForType(create: () => unknown) {
      if (!store.has(create)) store.set(create, create());
      return store.get(create);
    },
    cacheSignal: () => null,
  };
}

function endRequest(): void {
  if (requestCache) requestCache.A = null;
}

function session(overrides: Partial<ServerSession> & { id?: string } = {}): ServerSession {
  const { id = 'user-1', ...rest } = overrides;
  return {
    user: { id, email: `${id}@example.test`, role: 'admin' },
    roles: ['admin'],
    permissions: [],
    ...rest,
  } as ServerSession;
}

const authenticated = (value = session()): SessionOutcome => ({
  status: 'authenticated',
  session: value,
});
const unauthenticated = (message = 'No recoverable refresh session'): SessionOutcome => ({
  status: 'unauthenticated',
  error: new NoSessionError(message),
});
const failed = (error: AuthConfigError | AuthTransportError): SessionOutcome => ({
  status: 'failed',
  error,
});

/**
 * A `defineAuth()` stand-in carrying the same internals the real kit attaches.
 * Its public methods throw: the adapter must reach the shared resolution, never
 * the kit's own guards, or the second lookup this whole entry point exists to
 * remove would come straight back.
 */
function stubAuth(
  outcomes: SessionOutcome | SessionOutcome[] | (() => Promise<SessionOutcome>),
  routes: { loginRoute?: string; forbiddenRoute?: string } = {},
) {
  const queue = Array.isArray(outcomes) ? [...outcomes] : null;
  const calls = { count: 0 };
  const unreachable = () => {
    throw new Error('the adapter called the auth kit instead of the shared resolution');
  };

  const kit = attachReactServerInternals({
    getSession: unreachable,
    requireSession: unreachable,
    requireRole: unreachable,
  }, {
    loginRoute: routes.loginRoute ?? '/login',
    forbiddenRoute: routes.forbiddenRoute ?? '/forbidden',
    async resolveSessionOutcome() {
      calls.count += 1;
      if (typeof outcomes === 'function') return outcomes();
      if (queue) return queue.shift() ?? unauthenticated();
      return outcomes;
    },
  });

  return { serverAuth: createReactServerAuth(kit as never), calls };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(() => { throw new Error('expected a rejection'); }, (error) => error);
}

async function expectRedirect(promise: Promise<unknown>, target: string): Promise<void> {
  const digest = (await rejection(promise) as { digest?: string }).digest ?? '';
  expect(digest).toStartWith('NEXT_REDIRECT');
  expect(digest).toContain(`;${target};`);
}

// `next/navigation` builds an App Router context out of `React.createContext`,
// which the react-server build of React does not have — outside a real Next
// compilation the import fails. Redirect behavior is therefore asserted in the
// default `bun test` run, where the real `redirect()` loads and throws its real
// digest, and memoization is asserted in the `test:rsc` run. The package's
// `test` script runs both.
const redirectTest = test.skipIf(REACT_SERVER_BUILD);

describe('createReactServerAuth — request-scoped resolution', () => {
  test.skipIf(!REACT_SERVER_BUILD)('concurrent getSession() calls share one pending resolution', async () => {
    let release!: (outcome: SessionOutcome) => void;
    const pending = new Promise<SessionOutcome>((resolve) => { release = resolve; });
    const { serverAuth, calls } = stubAuth(() => pending);

    beginRequest();
    const inFlight = Promise.all([
      serverAuth.getSession(),
      serverAuth.getSession(),
      serverAuth.getSession(),
    ]);

    // Nothing has settled yet, so a second lookup would have to be a second
    // resolution rather than a shared one.
    expect(calls.count).toBe(1);

    release(authenticated());
    const [first, second, third] = await inFlight;
    expect(calls.count).toBe(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  test.skipIf(!REACT_SERVER_BUILD)('getSession() and requireSession() share one resolution', async () => {
    const { serverAuth, calls } = stubAuth(authenticated());

    beginRequest();
    const optional = await serverAuth.getSession();
    const required = await serverAuth.requireSession();

    expect(calls.count).toBe(1);
    expect(optional).toBe(required);
  });

  test.skipIf(!REACT_SERVER_BUILD)('getSession() and requireRole() share one resolution', async () => {
    const { serverAuth, calls } = stubAuth(authenticated());

    beginRequest();
    const optional = await serverAuth.getSession();
    const required = await serverAuth.requireRole(['admin']);

    expect(calls.count).toBe(1);
    expect(optional).toBe(required);
  });

  test.skipIf(!REACT_SERVER_BUILD)('a root layout, nested layout, and page see one snapshot', async () => {
    const { serverAuth, calls } = stubAuth(authenticated());

    beginRequest();
    const rootLayout = await serverAuth.getSession();
    const dashboardLayout = await serverAuth.requireSession();
    const page = await serverAuth.requireRole(['admin']);
    endRequest();

    expect(calls.count).toBe(1);
    expect(rootLayout).toBe(dashboardLayout);
    expect(dashboardLayout).toBe(page);
  });

  test.skipIf(!REACT_SERVER_BUILD)('separate requests never share a session', async () => {
    const { serverAuth, calls } = stubAuth([
      authenticated(session({ id: 'user-a' })),
      authenticated(session({ id: 'user-b' })),
    ]);

    beginRequest();
    const first = await serverAuth.getSession();
    endRequest();

    beginRequest();
    const second = await serverAuth.getSession();
    endRequest();

    expect(calls.count).toBe(2);
    expect(first?.user.id).toBe('user-a');
    expect(second?.user.id).toBe('user-b');
  });

  test.skipIf(!REACT_SERVER_BUILD)('a failed resolution is stable within a render but not across requests', async () => {
    const outage = new AuthTransportError('recovery endpoint unavailable', 503);
    const { serverAuth, calls } = stubAuth([failed(outage), authenticated()]);

    beginRequest();
    expect(await rejection(serverAuth.requireSession())).toBe(outage);
    expect(await rejection(serverAuth.requireSession())).toBe(outage);
    expect(await serverAuth.getSession()).toBeNull();
    expect(calls.count).toBe(1);
    endRequest();

    beginRequest();
    expect(await serverAuth.getSession()).not.toBeNull();
    expect(calls.count).toBe(2);
  });
});

describe('createReactServerAuth — strict guard semantics', () => {
  test('getSession() returns null instead of throwing for every failure', async () => {
    for (const outcome of [
      unauthenticated(),
      failed(new AuthConfigError('Session cookie secret is not configured')),
      failed(new AuthTransportError('unavailable', 503)),
    ]) {
      const { serverAuth } = stubAuth(outcome);
      beginRequest();
      expect(await serverAuth.getSession()).toBeNull();
      endRequest();
    }
  });

  redirectTest('a missing session redirects to the configured login route', async () => {
    const { serverAuth } = stubAuth(unauthenticated(), { loginRoute: '/sign-in' });
    beginRequest();
    await expectRedirect(serverAuth.requireSession(), '/sign-in');
  });

  redirectTest('a revoked refresh session redirects to login', async () => {
    const { serverAuth } = stubAuth(unauthenticated('Refresh session is invalid or revoked'));
    beginRequest();
    await expectRedirect(serverAuth.requireSession(), '/login');
  });

  redirectTest('a 401 or 403 from recovery is an unauthenticated answer, so it redirects', async () => {
    for (const status of [401, 403]) {
      const { serverAuth } = stubAuth(failed(new AuthTransportError('rejected', status)));
      beginRequest();
      await expectRedirect(serverAuth.requireSession(), '/login');
      endRequest();
    }
  });

  test('a configuration failure stays a visible error', async () => {
    const error = new AuthConfigError('Session cookie secret is not configured');
    const { serverAuth } = stubAuth(failed(error));
    beginRequest();
    expect(await rejection(serverAuth.requireSession())).toBe(error);
  });

  test('an unreachable recovery endpoint stays a visible error', async () => {
    const error = new AuthTransportError('recovery endpoint unavailable', 503);
    const { serverAuth } = stubAuth(failed(error));
    beginRequest();
    expect(await rejection(serverAuth.requireSession())).toBe(error);
  });

  redirectTest('requireRole() on an anonymous visitor redirects to login, not forbidden', async () => {
    const { serverAuth } = stubAuth(unauthenticated());
    beginRequest();
    await expectRedirect(serverAuth.requireRole(['admin']), '/login');
  });
});

describe('createReactServerAuth — role semantics', () => {
  test('a multi-role session passes when it holds any allowed role', async () => {
    const multi = session({ id: 'staff', roles: ['admin', 'operator'] });
    const { serverAuth } = stubAuth(authenticated(multi));
    beginRequest();
    expect(await serverAuth.requireRole(['operator', 'family'])).toBe(multi);
  });

  test('user.role is the fallback when the session carries no roles list', async () => {
    const legacy = { user: { id: 'f1', email: 'f1@example.test', role: 'family' } } as ServerSession;
    const { serverAuth } = stubAuth(authenticated(legacy));
    beginRequest();
    expect(await serverAuth.requireRole(['family'])).toBe(legacy);
  });

  redirectTest('a role mismatch redirects to the route defineAuth configured', async () => {
    const { serverAuth } = stubAuth(
      authenticated(session({ id: 'sponsor', roles: ['sponsor'] })),
      { forbiddenRoute: '/no-entry' },
    );
    beginRequest();
    await expectRedirect(serverAuth.requireRole(['admin']), '/no-entry');
  });

  redirectTest('a session with neither roles nor user.role holds nothing', async () => {
    const roleless = { user: { id: 'x', email: 'x@example.test' } } as unknown as ServerSession;
    const { serverAuth } = stubAuth(authenticated(roleless));
    beginRequest();
    await expectRedirect(serverAuth.requireRole(['admin']), '/forbidden');
  });
});

describe('createReactServerAuth — factory contract', () => {
  test('it rejects an object that did not come from defineAuth()', () => {
    expect(() => createReactServerAuth({
      getSession: async () => null,
      requireSession: async () => session(),
      requireRole: async () => session(),
    })).toThrow(/defineAuth\(\)/);
  });

  test('it rejects a value that is not an auth kit at all', () => {
    for (const value of [null, undefined, 'auth', 42]) {
      expect(() => createReactServerAuth(value as never)).toThrow(/defineAuth\(\)/);
    }
  });
});
