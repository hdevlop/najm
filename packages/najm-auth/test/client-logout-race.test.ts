import { describe, expect, test } from 'bun:test';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { AuthError } from '../src/client/types';

const accessToken = `header.${Buffer.from(JSON.stringify({
  userId: 'user-1',
  roles: ['user'],
  permissions: [],
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url')}.signature`;

describe('NajmAuthClient logout/refresh race', () => {
  test('anonymous hydration keeps credential-setup transport available', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ data: { setupRequired: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
      client.hydrate(null);

      await expect(client.api.get('/auth/credential-setup/setup')).resolves.toEqual({
        data: { setupRequired: true },
      });
      expect(calls).toEqual(['/api/auth/credential-setup/setup']);

      client.destroy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('aborts and drains an in-flight refresh before the final logout request', async () => {
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    const calls: string[] = [];
    let refreshSignal: AbortSignal | undefined;
    let resolveRefresh!: (value: unknown) => void;
    let authenticatedBlocks = 0;

    client.api = {
      blockAuthenticatedRequests: () => { authenticatedBlocks += 1; },
      allowAuthenticatedRequests: () => undefined,
      post: async (path: string, options?: { signal?: AbortSignal; skipAuth?: boolean }) => {
        if (path === '/auth/refresh') {
          calls.push('refresh:start');
          refreshSignal = options?.signal;
          return new Promise((resolve) => { resolveRefresh = resolve; });
        }

        calls.push('logout');
        expect(path).toBe('/auth/logout');
        expect(options?.skipAuth).toBe(true);
        return { data: null };
      },
    } as any;

    const refresh = client.refresh();
    await Promise.resolve();
    const logout = client.logout();

    expect(refreshSignal?.aborted).toBe(true);
    expect(authenticatedBlocks).toBe(1);
    expect(calls).toEqual(['refresh:start']);

    // Model a transport that still resolves after abort. The stale result must
    // not restore auth state, and logout must be sent only after it settles.
    resolveRefresh({ data: { accessToken } });
    await refresh;
    await logout;

    expect(calls).toEqual(['refresh:start', 'logout']);
    expect(client.getState()).toMatchObject({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    await expect(client.refresh()).rejects.toThrow('Refresh unavailable after logout');
    expect(calls).toEqual(['refresh:start', 'logout']);

    client.destroy();
    expect(authenticatedBlocks).toBe(2);
  });

  test('blocks authenticated transport after logout while public auth calls remain available', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
      await client.logout();
      client.hydrate(null);

      await expect(client.api.get('/protected')).rejects.toThrow(
        'Authenticated requests unavailable after logout',
      );
      await expect(client.api.post('/auth/login', { skipAuth: true })).resolves.toEqual({ data: null });
      expect(calls).toEqual(['/api/auth/logout', '/api/auth/login']);

      client.destroy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('does not log the session out when a refresh is refused with 401', async () => {
    // The server answers 401 to a tab that lost a refresh race while another
    // tab's rotation is live in the shared cookie jar. A logout from here
    // would carry that live cookie and revoke every tab's session. The server
    // clears its own cookies when a 401 is final, so nothing is left to clean.
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    const calls: string[] = [];
    let expired = 0;
    client.on('sessionExpired', () => { expired += 1; });
    client.api = {
      blockAuthenticatedRequests: () => undefined,
      allowAuthenticatedRequests: () => undefined,
      post: async (path: string) => {
        calls.push(path);
        throw new AuthError(401, 'Refresh token invalid');
      },
    } as any;

    await expect(client.refresh()).rejects.toThrow('Session expired');

    expect(calls).toEqual(['/auth/refresh']);
    expect(expired).toBe(1);
    expect(client.getState()).toMatchObject({ accessToken: null, isAuthenticated: false });
    client.destroy();
  });

  test('clears the server session immediately when refresh is rate limited', async () => {
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    const calls: string[] = [];
    client.api = {
      blockAuthenticatedRequests: () => undefined,
      allowAuthenticatedRequests: () => undefined,
      post: async (path: string) => {
        calls.push(path);
        if (path === '/auth/refresh') {
          throw new AuthError(429, 'Too many requests');
        }
        expect(path).toBe('/auth/logout');
        return { data: null };
      },
    } as any;

    await expect(client.refresh()).rejects.toThrow('Session expired (circuit open)');

    expect(calls).toEqual([
      '/auth/refresh',
      '/auth/logout',
    ]);
    expect(client.getState()).toMatchObject({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    client.destroy();
  });
});
