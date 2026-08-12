import { describe, expect, test } from 'bun:test';
import { NajmAuthClient } from '../src/client/NajmAuthClient';

const accessToken = `header.${Buffer.from(JSON.stringify({
  userId: 'user-1',
  roles: ['user'],
  permissions: [],
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url')}.signature`;

describe('NajmAuthClient logout/refresh race', () => {
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
});
