import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { TokenService } from '../src/tokens/TokenService';
import { withAuthCookiePersistence } from '../src/client/server/authCookiePersistence';

function tokenService(requirement?: Record<string, unknown>) {
  const cleared: string[] = [];
  const revoked: string[] = [];

  const service = new TokenService(
    {
      getUser: async () => ({ id: 'user-1', status: 'active' }),
      revokeFamily: async (family: string) => { revoked.push(family); },
    } as never,
    {
      clearRefreshToken: () => { cleared.push('refresh'); },
      clearSessionCookie: () => { cleared.push('session'); },
    } as never,
    {} as never,
    { find: async () => requirement } as never,
  );
  (service as any).t = (key: string) => key;
  (service as any).markFamilyRevoked = async () => undefined;

  return { service, cleared, revoked };
}

describe('refresh and session recovery reject a required user', () => {
  test('the shared chokepoint revokes the family and clears normal cookies', async () => {
    const { service, cleared, revoked } = tokenService({
      userId: 'user-1',
      purpose: 'password',
      temporaryCredentialKind: 'ma-cin',
      required: true,
      completedAt: null,
    });

    await expect(
      (service as any).requireActiveRefreshUser('user-1', 'family-1'),
    ).rejects.toMatchObject({ message: 'errors.credentialSetupRequired' });

    expect(revoked).toEqual(['family-1']);
    expect(cleared).toEqual(['refresh', 'session']);
  });

  test('a completed requirement leaves refresh untouched', async () => {
    const { service, cleared, revoked } = tokenService({
      userId: 'user-1',
      purpose: 'password',
      temporaryCredentialKind: 'ma-cin',
      required: false,
      completedAt: '2026-08-08T00:00:00.000Z',
    });

    await expect(
      (service as any).requireActiveRefreshUser('user-1', 'family-1'),
    ).resolves.toMatchObject({ id: 'user-1' });
    expect(revoked).toHaveLength(0);
    expect(cleared).toHaveLength(0);
  });
});

describe('the client stays unauthenticated during credential setup', () => {
  function clientWith(payload: unknown, shape: 'enveloped' | 'top-level' = 'enveloped') {
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    const calls: string[] = [];
    client.api = {
      allowAuthenticatedRequests: () => undefined,
      blockAuthenticatedRequests: () => undefined,
      post: async (path: string) => {
        calls.push(path);
        return shape === 'top-level' ? payload : { data: payload };
      },
      get: async (path: string) => {
        calls.push(path);
        return { data: { id: 'user-1', email: 'fatima@example.ma' } };
      },
    } as never;
    return { client, calls };
  }

  test('a setup response applies no tokens and fetches no user', async () => {
    const { client, calls } = clientWith({
      nextStep: 'credential_setup',
      setupRequired: true,
      purpose: 'password',
      expiresAt: 'later',
    });

    const result = await client.login({ identifier: 'fatima@example.ma', password: 'ab123456' });

    expect(result).toEqual({
      nextStep: 'credential_setup',
      setupRequired: true,
      purpose: 'password',
      expiresAt: 'later',
    });
    expect(client.isAuthenticated()).toBe(false);
    expect(client.getAccessToken()).toBeNull();
    expect(client.getUser()).toBeNull();
    expect(calls).toEqual(['/auth/login']);
    client.destroy();
  });

  test('a top-level setup response also applies no tokens', async () => {
    const { client, calls } = clientWith({
      nextStep: 'credential_setup',
      setupRequired: true,
      purpose: 'password',
      expiresAt: 'later',
    }, 'top-level');

    await expect(client.login({ identifier: 'fatima@example.ma', password: 'ab123456' }))
      .resolves.toMatchObject({ nextStep: 'credential_setup' });
    expect(client.isAuthenticated()).toBe(false);
    expect(calls).toEqual(['/auth/login']);
    client.destroy();
  });

  test('an authenticated response still hydrates normally', async () => {
    const { client } = clientWith({
      accessToken: 'access',
      user: { id: 'user-1', email: 'fatima@example.ma' },
    });

    const result = await client.login({ identifier: 'fatima@example.ma', password: 'fatima2026' });

    expect(result).toMatchObject({ nextStep: 'authenticated' });
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getAccessToken()).toBe('access');
    client.destroy();
  });
});

describe('cookie persistence recognizes Najm setup responses without configuration', () => {
  const setCookiesOf = (response: Response) =>
    (response.headers as Headers & { getSetCookie(): string[] }).getSetCookie();

  const AUTH_COOKIES = [
    'refreshToken=abc; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax',
    'najm.session=sig; Path=/; HttpOnly; Max-Age=300',
    'najm.credential-setup=opaque; Path=/; HttpOnly; SameSite=Strict',
  ];

  function loginRequest(rememberMe = true) {
    return new Request('https://app.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'fatima@example.ma', password: 'ab123456', rememberMe }),
    });
  }

  function respond(body: unknown, cookies = AUTH_COOKIES) {
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const cookie of cookies) headers.append('set-cookie', cookie);
    return new Response(JSON.stringify(body), { headers });
  }

  for (const [shape, body] of [
    ['top-level', { nextStep: 'credential_setup', setupRequired: true, purpose: 'password', expiresAt: 'later' }],
    ['enveloped', { data: { nextStep: 'credential_setup', setupRequired: true, purpose: 'password', expiresAt: 'later' } }],
  ] as const) {
    test(`strips session cookies from a ${shape} setup response`, async () => {
      const handler = withAuthCookiePersistence(async () => respond(body), {
        rememberCookieName: 'app.remember',
      });
      const cookies = setCookiesOf(await handler(loginRequest()));

      expect(cookies.find((c) => c.startsWith('refreshToken='))).toBeUndefined();
      expect(cookies.find((c) => c.startsWith('najm.session='))).toBeUndefined();
      // The setup cookie itself is the point of the response.
      expect(cookies.find((c) => c.startsWith('najm.credential-setup='))).toContain('opaque');
      expect(cookies.find((c) => c.startsWith('app.remember='))).toContain('Max-Age=0');
    });
  }

  test('cookie deletions in a setup response still go through', async () => {
    const handler = withAuthCookiePersistence(async () => respond(
      { nextStep: 'credential_setup', setupRequired: true, purpose: 'password', expiresAt: 'later' },
      ['refreshToken=; Path=/; HttpOnly; Max-Age=0'],
    ));
    const cookies = setCookiesOf(await handler(loginRequest()));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain('Max-Age=0');
  });

  test('an authenticated login is unaffected by the detection', async () => {
    const handler = withAuthCookiePersistence(async () => respond({
      nextStep: 'authenticated',
      accessToken: 'access',
    }));
    const cookies = setCookiesOf(await handler(loginRequest()));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain('Max-Age=604800');
    expect(cookies.find((c) => c.startsWith('najm.remember='))).toContain('najm.remember=1');
  });

  test('completing setup clears the remembered preference', async () => {
    const handler = withAuthCookiePersistence(async () =>
      new Response(JSON.stringify({ data: { changed: true } }), {
        headers: { 'content-type': 'application/json' },
      }));

    const response = await handler(new Request(
      'https://app.test/api/auth/credential-setup/change',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'najm.remember=1' },
        body: JSON.stringify({ newPassword: 'fatima2026' }),
      },
    ));

    expect(setCookiesOf(response).find((c) => c.startsWith('najm.remember=')))
      .toContain('Max-Age=0');
  });
});
