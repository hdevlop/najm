import { describe, expect, test } from 'bun:test';

import {
  makeSessionCookie,
  withAuthCookiePersistence,
} from '../src/client/server/authCookiePersistence';
import { getSafeRedirectPath } from '../src/client/server/safeRedirect';

const REMEMBER = 'najm.remember';

function respond(
  setCookies: string[],
  body: unknown = { ok: true },
  status = 200,
) {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { headers, status });
}

const LOGIN_COOKIES = [
  'refreshToken=abc; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax',
  'najm.session=sig; Path=/; HttpOnly; Expires=Sat, 15 Aug 2026 12:00:00 GMT',
];

function loginRequest(rememberMe: boolean, url = 'https://app.test/api/auth/login') {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.test', password: 'x', rememberMe }),
  });
}

const setCookiesOf = (response: Response) =>
  (response.headers as Headers & { getSetCookie(): string[] }).getSetCookie();

describe('withAuthCookiePersistence — login', () => {
  test('strips the lifetime from auth cookies when not remembered', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(loginRequest(false)));

    const refresh = cookies.find((c) => c.startsWith('refreshToken='))!;
    const session = cookies.find((c) => c.startsWith('najm.session='))!;

    expect(refresh).not.toMatch(/max-age/i);
    expect(session).not.toMatch(/expires/i);
    // The cookie itself is untouched apart from its lifetime.
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('refreshToken=abc');

    expect(cookies.find((c) => c.startsWith(`${REMEMBER}=`))).toContain(
      `${REMEMBER}=0`,
    );
  });

  test('keeps the lifetime and stores the choice when remembered', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(loginRequest(true)));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain(
      'Max-Age=604800',
    );

    const remember = cookies.find((c) => c.startsWith(`${REMEMBER}=`))!;
    expect(remember).toContain(`${REMEMBER}=1`);
    expect(remember).toContain('Max-Age=');
    expect(remember).toContain('Secure'); // request was https
    expect(remember).toContain('HttpOnly');
  });

  test('the not-remembered preference is itself a session cookie', async () => {
    // Remembering "do not remember me" past the browser closing would outlive
    // the thing it describes.
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(loginRequest(false)));

    expect(cookies.find((c) => c.startsWith(`${REMEMBER}=`))).not.toMatch(
      /max-age/i,
    );
  });

  test('omits Secure over plain http', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(
      await handler(loginRequest(true, 'http://localhost:3000/api/auth/login')),
    );

    expect(cookies.find((c) => c.startsWith(`${REMEMBER}=`))).not.toContain(
      'Secure',
    );
  });

  test('leaves a failed login alone', async () => {
    const handler = withAuthCookiePersistence(async () =>
      respond([], { error: 'bad credentials' }, 401),
    );
    const response = await handler(loginRequest(true));

    expect(response.status).toBe(401);
    expect(setCookiesOf(response)).toHaveLength(0);
  });

  test('the wrapped handler still receives a readable body', async () => {
    let seen: unknown = null;
    const handler = withAuthCookiePersistence(async (request) => {
      seen = await request.json();
      return respond(LOGIN_COOKIES);
    });

    await handler(loginRequest(true));

    expect(seen).toMatchObject({ email: 'a@b.test', rememberMe: true });
  });
});

describe('withAuthCookiePersistence — refresh', () => {
  const refreshRequest = (cookie: string) =>
    new Request('https://app.test/api/auth/refresh', {
      method: 'POST',
      headers: { cookie },
    });

  test('reapplies a stored session-mode choice', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(refreshRequest(`${REMEMBER}=0`)));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).not.toMatch(
      /max-age/i,
    );
  });

  test('reapplies a stored persistent choice', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(refreshRequest(`${REMEMBER}=1`)));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain(
      'Max-Age=604800',
    );
  });

  test('passes through untouched when no choice is stored', async () => {
    const handler = withAuthCookiePersistence(async () => respond(LOGIN_COOKIES));
    const cookies = setCookiesOf(await handler(refreshRequest('other=1')));

    expect(cookies).toEqual(LOGIN_COOKIES);
  });
});

describe('withAuthCookiePersistence — logout and setup', () => {
  test('logout clears the stored choice', async () => {
    const handler = withAuthCookiePersistence(async () =>
      respond(['refreshToken=; Path=/; Max-Age=0']),
    );
    const cookies = setCookiesOf(
      await handler(
        new Request('https://app.test/api/auth/logout', { method: 'POST' }),
      ),
    );

    const remember = cookies.find((c) => c.startsWith(`${REMEMBER}=`))!;
    expect(remember).toContain('Max-Age=0');
    // The handler's own deletion still goes through.
    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain(
      'Max-Age=0',
    );
  });

  test('a setup response leaves no usable session behind', async () => {
    const handler = withAuthCookiePersistence(
      async () => respond(LOGIN_COOKIES, { nextStep: 'password_setup' }),
      {
        isSetupResponse: (payload) =>
          (payload as { nextStep?: string } | null)?.nextStep ===
          'password_setup',
      },
    );
    const cookies = setCookiesOf(await handler(loginRequest(true)));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toBeUndefined();
    expect(cookies.find((c) => c.startsWith('najm.session='))).toBeUndefined();
    expect(cookies.find((c) => c.startsWith(`${REMEMBER}=`))).toContain(
      'Max-Age=0',
    );
  });

  test('a setup response still emits cookie deletions', async () => {
    const handler = withAuthCookiePersistence(
      async () =>
        respond(
          ['refreshToken=; Path=/; Max-Age=0'],
          { nextStep: 'password_setup' },
        ),
      { isSetupResponse: () => true },
    );
    const cookies = setCookiesOf(await handler(loginRequest(true)));

    expect(cookies.find((c) => c.startsWith('refreshToken='))).toContain(
      'Max-Age=0',
    );
  });
});

describe('makeSessionCookie', () => {
  test('only rewrites the named auth cookies', () => {
    const unrelated = 'analytics=1; Path=/; Max-Age=999';
    expect(makeSessionCookie(unrelated)).toBe(unrelated);

    expect(makeSessionCookie('refreshToken=a; Max-Age=999; HttpOnly')).toBe(
      'refreshToken=a; HttpOnly',
    );
  });

  test('honours a custom cookie name list', () => {
    expect(makeSessionCookie('custom=a; Max-Age=999', ['custom'])).toBe(
      'custom=a',
    );
  });
});

describe('getSafeRedirectPath', () => {
  test('accepts an ordinary same-origin path', () => {
    expect(getSafeRedirectPath('/orders/42')).toBe('/orders/42');
    expect(getSafeRedirectPath('/orders?page=2')).toBe('/orders?page=2');
  });

  test('rejects off-site destinations', () => {
    expect(getSafeRedirectPath('https://evil.test')).toBe('/dashboard');
    // Protocol-relative: a naive startsWith('/') check reads this as local.
    expect(getSafeRedirectPath('//evil.test/x')).toBe('/dashboard');
    expect(getSafeRedirectPath('/\\evil.test')).toBe('/dashboard');
    expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
  });

  test('rejects blocked prefixes and assets', () => {
    expect(getSafeRedirectPath('/api/auth/login')).toBe('/dashboard');
    expect(getSafeRedirectPath('/login')).toBe('/dashboard');
    expect(getSafeRedirectPath('/_next/static/x.js')).toBe('/dashboard');
    expect(getSafeRedirectPath('/logo.png')).toBe('/dashboard');
    expect(getSafeRedirectPath('/data.json?v=1')).toBe('/dashboard');
  });

  test('rejects empty and absent values', () => {
    expect(getSafeRedirectPath(undefined)).toBe('/dashboard');
    expect(getSafeRedirectPath(null)).toBe('/dashboard');
    expect(getSafeRedirectPath('')).toBe('/dashboard');
  });

  test('takes the first entry of a repeated parameter', () => {
    expect(getSafeRedirectPath(['/orders', '/evil'])).toBe('/orders');
  });

  test('accepts a bare string as the fallback', () => {
    expect(getSafeRedirectPath('https://evil.test', '/home')).toBe('/home');
    expect(getSafeRedirectPath(undefined, { fallback: '/home' })).toBe('/home');
  });

  test('honours custom blocked prefixes', () => {
    expect(
      getSafeRedirectPath('/admin/x', { blockedPrefixes: ['/admin'] }),
    ).toBe('/dashboard');
  });
});
