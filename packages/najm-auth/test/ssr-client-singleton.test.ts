import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { defineAuth } from '../src/client/server/defineAuth';
import { AuthProvider } from '../src/client/react/AuthProvider';
import { useUser } from '../src/client/react/useUser';

const session = (id: string, role: string) => ({
  user: { id, email: `${id}@example.test`, role },
  roles: [role],
  permissions: [],
});

const newClient = () =>
  new NajmAuthClient({ baseURL: '/api', authPrefix: '/auth', tabSync: false });

const jwt = (ttlSeconds: number) =>
  `header.${Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url')}.signature`;

function Whoami() {
  const user = useUser();
  return createElement('span', null, `${user?.id ?? 'anon'}:${user?.role ?? 'none'}`);
}

const renderRequest = (client: NajmAuthClient, id: string, role: string) =>
  renderToString(
    createElement(AuthProvider, {
      client,
      initialSession: session(id, role),
      autoRefresh: false,
      children: createElement(Whoami),
    }),
  );

type Global = { window?: unknown };

/**
 * Run without a global `window`. Sibling suites (google-oauth-react) install a
 * happy-dom window on globalThis at module scope and never remove it, so a
 * server-side assertion cannot rely on the ambient environment.
 */
function asServer<T>(run: () => T): T {
  const had = 'window' in globalThis;
  const saved = (globalThis as Global).window;
  delete (globalThis as Global).window;
  try {
    return run();
  } finally {
    if (had) (globalThis as Global).window = saved;
  }
}

function asBrowser<T>(run: () => T): T {
  const had = 'window' in globalThis;
  const saved = (globalThis as Global).window;
  (globalThis as Global).window ??= {};
  try {
    return run();
  } finally {
    if (had) (globalThis as Global).window = saved;
    else delete (globalThis as Global).window;
  }
}

describe('SSR auth client sharing', () => {
  test('hydrate latches on the first session and drops every later one', () => {
    const client = newClient();

    client.hydrate(session('fatima', 'family'));
    client.hydrate(session('ahmed', 'operator'));

    expect(client.getState().user?.id).toBe('fatima');
    expect(client.getState().roles).toEqual(['family']);
  });

  test('the latch never reopens, even for an authoritative null session', () => {
    const client = newClient();

    client.hydrate(session('fatima', 'family'));
    client.hydrate(null);
    client.hydrate(session('ahmed', 'operator'));

    expect(client.getState().user?.id).toBe('fatima');
    expect(client.isHydrated()).toBe(true);
  });

  test('defineAuth hands out one client for the whole process', () => {
    const auth = defineAuth({ apiBaseURL: '/api', tabSync: false });

    expect(auth.client).toBe(auth.client);
  });

  test('two requests through one kit render the second user as the first', () => {
    const auth = defineAuth({ apiBaseURL: '/api', tabSync: false });

    auth.client.hydrate(session('fatima', 'family'));
    const first = auth.client.getState();

    auth.client.hydrate(session('ahmed', 'operator'));
    const second = auth.client.getState();

    expect(second.user?.id).toBe('fatima');
    expect(second.roles).toEqual(['family']);
    expect(second).toBe(first);
  });

  test('a per-request client hydrates each session correctly', () => {
    const fatima = newClient();
    const ahmed = newClient();

    fatima.hydrate(session('fatima', 'family'));
    ahmed.hydrate(session('ahmed', 'operator'));

    expect(fatima.getState().user?.id).toBe('fatima');
    expect(ahmed.getState().user?.id).toBe('ahmed');
    expect(ahmed.getState().roles).toEqual(['operator']);
  });
});

describe('per-request fork', () => {
  test('a fork hydrates independently of the client it came from', () => {
    const shared = newClient();
    shared.hydrate(session('fatima', 'family'));

    const forked = shared.fork();
    forked.hydrate(session('ahmed', 'operator'));

    expect(shared.getState().user?.id).toBe('fatima');
    expect(forked.getState().user?.id).toBe('ahmed');
    expect(forked.getState().roles).toEqual(['operator']);
  });

  test('sibling forks never see each other and leave the origin untouched', () => {
    const shared = defineAuth({ apiBaseURL: '/api', tabSync: false }).client;
    const a = shared.fork();
    const b = shared.fork();

    a.hydrate(session('fatima', 'family'));
    b.hydrate(session('ahmed', 'operator'));

    expect(a.getState().user?.id).toBe('fatima');
    expect(b.getState().user?.id).toBe('ahmed');
    expect(shared.isHydrated()).toBe(false);
  });
});

describe('server rendering through AuthProvider', () => {
  test('consecutive requests on one shared client each render their own user', () => {
    const shared = defineAuth({ apiBaseURL: '/api', tabSync: false }).client;

    asServer(() => {
      expect(renderRequest(shared, 'fatima', 'family')).toContain('fatima:family');
      expect(renderRequest(shared, 'ahmed', 'operator')).toContain('ahmed:operator');
      expect(renderRequest(shared, 'sara', 'sponsor')).toContain('sara:sponsor');
    });
  });

  test('the shared client is never hydrated by a server render', () => {
    const shared = defineAuth({ apiBaseURL: '/api', tabSync: false }).client;

    asServer(() => renderRequest(shared, 'fatima', 'family'));

    expect(shared.isHydrated()).toBe(false);
    expect(shared.getState().user).toBeNull();
  });

  test('a browser render keeps using the shared client', () => {
    const shared = defineAuth({ apiBaseURL: '/api', tabSync: false }).client;

    asBrowser(() => {
      expect(renderRequest(shared, 'fatima', 'family')).toContain('fatima:family');
    });

    expect(shared.isHydrated()).toBe(true);
    expect(shared.getState().user?.id).toBe('fatima');
  });
});

describe('refresh scheduling', () => {
  test('hydrate plants no refresh timer when there is no window', () => {
    const scheduled: unknown[] = [];
    const real = globalThis.setTimeout;
    globalThis.setTimeout = ((...args: unknown[]) => {
      scheduled.push(args);
      return 0;
    }) as unknown as typeof globalThis.setTimeout;

    try {
      asServer(() =>
        newClient().hydrate({ ...session('fatima', 'family'), accessToken: jwt(3600) }),
      );
    } finally {
      globalThis.setTimeout = real;
    }

    expect(scheduled).toHaveLength(0);
  });

  test('a browser tab still schedules its proactive refresh', () => {
    const scheduled: unknown[] = [];
    const real = globalThis.setTimeout;
    globalThis.setTimeout = ((...args: unknown[]) => {
      scheduled.push(args);
      return 0;
    }) as unknown as typeof globalThis.setTimeout;

    try {
      asBrowser(() =>
        newClient().hydrate({ ...session('fatima', 'family'), accessToken: jwt(3600) }),
      );
    } finally {
      globalThis.setTimeout = real;
    }

    expect(scheduled).toHaveLength(1);
  });
});
