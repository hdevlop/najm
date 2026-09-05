import { afterEach, describe, expect, test } from 'bun:test';
import { withAuthMiddleware } from '../src/client/server/withAuthMiddleware';
import {
  resolveSessionSecret,
  verifySessionCookie,
  type SessionCookieClaims,
} from '../src/client/sessionCookie';

const SESSION_SECRET = 'session-secret-session-secret-session-secret';
const SESSION_COOKIE = 'najm.session';
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function claims(role: string, iat = Date.now()): SessionCookieClaims {
  return {
    user: {
      id: `user-${role}`,
      email: `${role}@example.com`,
      name: role,
      role,
    },
    roles: [role],
    permissions: [],
    sessionVersion: 0,
    tokenFamily: `family-${role}`,
    iat,
  };
}

async function signSession(value: SessionCookieClaims, secret = SESSION_SECRET): Promise<string> {
  const payload = JSON.stringify(value);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}

function base64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';

  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += alphabet[(chunk >> 18) & 63];
    result += alphabet[(chunk >> 12) & 63];
    if (second !== undefined) result += alphabet[(chunk >> 6) & 63];
    if (third !== undefined) result += alphabet[chunk & 63];
  }

  return result;
}

function cookieHeader(session?: string, refresh = 'valid-refresh-token'): string {
  const cookies = [`refreshToken=${refresh}`];
  if (session) cookies.push(`${SESSION_COOKIE}=${encodeURIComponent(session)}`);
  return cookies.join('; ');
}

function request(pathname: string, cookie?: string): Request {
  return new Request(`https://kafil.example${pathname}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function mockRecovery(role = 'admin', status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (status !== 200) return new Response(null, { status });
    const session = await signSession(claims(role));
    return new Response(JSON.stringify({ data: { recovered: true } }), {
      status: 200,
      headers: {
        'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }) as typeof fetch;
  return calls;
}

function standardMiddleware(overrides: Parameters<typeof withAuthMiddleware>[0] = {}) {
  return withAuthMiddleware({
    protectedRoutes: [
      '/dashboard/:path*',
      '/operator/:path*',
      '/family/:path*',
      '/sponsor/:path*',
    ],
    publicRoutes: ['/login', '/about'],
    loginRoute: '/login',
    roleRoutes: {
      '/operator/:path*': ['admin', 'operator'],
      '/family/:path*': ['family'],
      '/sponsor/:path*': ['sponsor'],
    },
    sessionSecret: SESSION_SECRET,
    ...overrides,
  });
}

function expectAllowed(response: Response): void {
  expect(response.status).toBe(200);
  expect(response.headers.get('x-middleware-next')).toBe('1');
}

function expectLoginRedirect(response: Response, from: string): void {
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe(
    `https://kafil.example/login?from=${encodeURIComponent(from)}`,
  );
  const cleared = response.headers.get('set-cookie') ?? '';
  expect(cleared).toContain('refreshToken=');
  expect(cleared).toContain(`${SESSION_COOKIE}=`);
}

describe('protected browser navigation', () => {
  test('valid signed session cookie permits a protected route', async () => {
    const session = await signSession(claims('sponsor'));
    const response = await standardMiddleware()(request('/dashboard', cookieHeader(session)));
    expectAllowed(response);
  });

  test('admin session permits routes configured for admin/operator', async () => {
    const session = await signSession(claims('admin'));
    const middleware = standardMiddleware();

    for (const pathname of ['/operator', '/operator/families', '/operator/settings']) {
      expectAllowed(await middleware(request(pathname, cookieHeader(session))));
    }
  });

  test.each([
    ['operator', '/operator/families'],
    ['family', '/family'],
    ['sponsor', '/sponsor'],
  ])('%s session follows its configured role route', async (role, pathname) => {
    const session = await signSession(claims(role));
    expectAllowed(await standardMiddleware()(request(pathname, cookieHeader(session))));
  });

  test('missing session is rejected and cookies are cleared', async () => {
    const response = await standardMiddleware()(request('/dashboard'));
    expectLoginRedirect(response, '/dashboard');
  });

  test('tampered signature is never trusted and recovers only from refresh state', async () => {
    const session = await signSession(claims('admin'));
    const separator = session.lastIndexOf('.');
    const signature = session.slice(separator + 1);
    const replacement = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${session.slice(0, separator + 1)}${replacement}${signature.slice(1)}`;

    const calls = mockRecovery('admin');
    const response = await standardMiddleware()(request('/operator', cookieHeader(tampered)));
    expectAllowed(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.init?.headers).toMatchObject({
      Cookie: 'refreshToken=valid-refresh-token',
    });
  });

  test('expired session recovers from a valid refresh session', async () => {
    const session = await signSession(claims('admin', Date.now() - 301_000));
    const calls = mockRecovery('admin');
    const response = await standardMiddleware()(request('/operator', cookieHeader(session)));
    expectAllowed(response);
    expect(calls).toHaveLength(1);
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  test('valid refresh cookie without a valid session cannot bypass protection', async () => {
    mockRecovery('admin', 401);
    const response = await standardMiddleware()(
      request('/dashboard', 'refreshToken=still-valid'),
    );
    expectLoginRedirect(response, '/dashboard');
  });

  test('role mismatch returns the established forbidden response', async () => {
    const session = await signSession(claims('sponsor'));
    const response = await standardMiddleware()(request('/operator', cookieHeader(session)));

    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('verifyAlways performs authoritative recovery without rotating tokens', async () => {
    const session = await signSession(claims('sponsor'));
    const calls = mockRecovery('sponsor');
    const response = await standardMiddleware({ verifyAlways: true })(
      request('/dashboard', cookieHeader(session)),
    );
    expectAllowed(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://kafil.example/api/auth/session/recover');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).not.toContain('/refresh');
  });

  test('proxySessionMode authoritative performs recovery for a valid snapshot', async () => {
    const session = await signSession(claims('sponsor'));
    const calls = mockRecovery('sponsor');
    const response = await standardMiddleware({ proxySessionMode: 'authoritative' })(
      request('/dashboard', cookieHeader(session)),
    );

    expectAllowed(response);
    expect(calls).toHaveLength(1);
  });

  test('proxySessionMode optimistic trusts a valid signed snapshot', async () => {
    const session = await signSession(claims('sponsor'));
    const calls = mockRecovery('sponsor');
    const response = await standardMiddleware({ proxySessionMode: 'optimistic' })(
      request('/dashboard', cookieHeader(session)),
    );

    expectAllowed(response);
    expect(calls).toHaveLength(0);
  });

  test('public routes remain unaffected by missing or invalid cookies', async () => {
    expectAllowed(await standardMiddleware()(request('/login', 'najm.session=tampered')));
    expectAllowed(await standardMiddleware()(request('/about')));
  });

  test('request header overrides reach public and authenticated renders', async () => {
    const middleware = standardMiddleware();
    const session = await signSession(claims('admin'));

    for (const input of [
      request('/about'),
      request('/operator', cookieHeader(session)),
    ]) {
      const response = await middleware(input, {
        requestHeaders: {
          'content-security-policy': "script-src 'self' 'nonce-request-value'",
          'x-nonce': 'request-value',
        },
      });

      expectAllowed(response);
      expect(response.headers.get('x-middleware-request-x-nonce')).toBe('request-value');
      expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(
        "script-src 'self' 'nonce-request-value'",
      );
      expect(response.headers.get('x-middleware-request-cookie')).toBe(
        input.headers.get('cookie'),
      );
    }
  });

  test('request header overrides survive authoritative session recovery', async () => {
    mockRecovery('admin');
    const response = await standardMiddleware()(request(
      '/operator',
      'refreshToken=valid-refresh-token',
    ), {
      requestHeaders: { 'x-nonce': 'recovery-nonce' },
    });

    expectAllowed(response);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe('recovery-nonce');
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  test.each(['authorization', 'cookie'])(
    'request header overrides cannot replace the authorized %s identity',
    async (header) => {
      const session = await signSession(claims('admin'));
      await expect(standardMiddleware()(request(
        '/operator',
        cookieHeader(session),
      ), {
        requestHeaders: { [header]: 'attacker-controlled-identity' },
      })).rejects.toThrow(`cannot override ${header}`);
    },
  );

  test('shared verifier accepts encoded cookies and rejects malformed claims', async () => {
    const session = await signSession(claims('operator'));
    expect(
      await verifySessionCookie(encodeURIComponent(session), { secret: SESSION_SECRET }),
    ).toMatchObject({ roles: ['operator'] });

    const malformed = await signSession({
      ...claims('operator'),
      roles: undefined,
    } as unknown as SessionCookieClaims);
    expect(await verifySessionCookie(malformed, { secret: SESSION_SECRET })).toBeNull();
  });

  test('future-issued and invalid typed claims are rejected', async () => {
    const future = await signSession(claims('operator', Date.now() + 31_000));
    expect(await verifySessionCookie(future, { secret: SESSION_SECRET })).toBeNull();

    for (const patch of [
      { sessionVersion: '0' },
      { roles: ['operator', 1] },
      { permissions: 'operator:read' },
    ]) {
      const malformed = await signSession({
        ...claims('operator'),
        ...patch,
      } as unknown as SessionCookieClaims);
      expect(await verifySessionCookie(malformed, { secret: SESSION_SECRET })).toBeNull();
    }
  });

  test('session expiry boundary and custom max age are exact', async () => {
    const now = 1_800_000_000_000;
    const session = await signSession(claims('operator', now - 10_000));
    expect(await verifySessionCookie(session, {
      secret: SESSION_SECRET,
      maxAgeSeconds: 11,
      now,
    })).not.toBeNull();
    expect(await verifySessionCookie(session, {
      secret: SESSION_SECRET,
      maxAgeSeconds: 10,
      now,
    })).toBeNull();
  });

  test('custom sessionMaxAge controls recovery independently of access lifetime', async () => {
    const session = await signSession(claims('admin', Date.now() - 2_000));
    const calls = mockRecovery('admin');
    const response = await standardMiddleware({ sessionMaxAge: 1 })(
      request('/operator', cookieHeader(session)),
    );
    expectAllowed(response);
    expect(calls).toHaveLength(1);
  });

  test('role and status changes are bounded by the signed-session staleness window', async () => {
    const nearlyExpiredAdmin = await signSession(claims('admin', Date.now() - 299_000));
    const calls = mockRecovery('operator');
    expectAllowed(await standardMiddleware()(
      request('/operator', cookieHeader(nearlyExpiredAdmin)),
    ));
    expect(calls).toHaveLength(0);

    const expiredAdmin = await signSession(claims('admin', Date.now() - 301_000));
    expectAllowed(await standardMiddleware()(
      request('/operator', cookieHeader(expiredAdmin)),
    ));
    expect(calls).toHaveLength(1);

    mockRecovery('operator', 401);
    const disabled = await standardMiddleware()(
      request('/operator', cookieHeader(expiredAdmin, 'disabled-family')),
    );
    expect(disabled.status).toBe(307);
  });

  test('missing session secret fails closed without destroying refresh state', async () => {
    const originalSessionSecret = process.env.NAJM_SESSION_SECRET;
    const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
    delete process.env.NAJM_SESSION_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    try {
      const response = await standardMiddleware({ sessionSecret: '' })(
        request('/dashboard', 'refreshToken=still-valid'),
      );
      expect(response.status).toBe(307);
      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain(`${SESSION_COOKIE}=`);
      expect(setCookie).not.toContain('refreshToken=');
    } finally {
      if (originalSessionSecret === undefined) delete process.env.NAJM_SESSION_SECRET;
      else process.env.NAJM_SESSION_SECRET = originalSessionSecret;
      if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
    }
  });

  test('recovery failure preserves an internal return path with query only', async () => {
    mockRecovery('admin', 401);
    const response = await standardMiddleware()(
      request('/dashboard/orders?filter=open', 'refreshToken=revoked'),
    );
    expect(response.headers.get('location')).toBe(
      'https://kafil.example/login?from=%2Fdashboard%2Forders%3Ffilter%3Dopen',
    );
  });

  test('speculative prefetch and concurrent navigation never call token refresh', async () => {
    const calls = mockRecovery('admin');
    const middleware = standardMiddleware();
    const prefetch = new Request('https://kafil.example/operator', {
      headers: {
        Cookie: 'refreshToken=shared-refresh',
        'Next-Router-Prefetch': '1',
      },
    });
    const navigations = [
      prefetch,
      request('/operator/families', 'refreshToken=shared-refresh'),
      request('/operator/settings', 'refreshToken=shared-refresh'),
    ];
    const responses = await Promise.all(navigations.map((value) => middleware(value)));
    responses.forEach(expectAllowed);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.init?.method === 'POST')).toBe(true);
    expect(calls.every((call) => call.url.endsWith('/session/recover'))).toBe(true);
  });

  test('session secret resolution preserves NAJM_SESSION_SECRET and JWT fallback', () => {
    const originalSessionSecret = process.env.NAJM_SESSION_SECRET;
    const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
    try {
      process.env.NAJM_SESSION_SECRET = 'dedicated-session-secret';
      process.env.JWT_ACCESS_SECRET = 'access-secret';
      expect(resolveSessionSecret()).toBe('dedicated-session-secret');

      delete process.env.NAJM_SESSION_SECRET;
      expect(resolveSessionSecret()).toBe('access-secret');
      expect(resolveSessionSecret('explicit-secret')).toBe('explicit-secret');
    } finally {
      if (originalSessionSecret === undefined) delete process.env.NAJM_SESSION_SECRET;
      else process.env.NAJM_SESSION_SECRET = originalSessionSecret;
      if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
    }
  });

  test('Edge session verification has no Node crypto or Buffer dependency', async () => {
    const verifierSource = await Bun.file(
      new URL('../src/client/sessionCookie.ts', import.meta.url),
    ).text();
    const middlewareSource = await Bun.file(
      new URL('../src/client/server/withAuthMiddleware.ts', import.meta.url),
    ).text();
    const recoverySource = await Bun.file(
      new URL('../src/client/sessionRecovery.ts', import.meta.url),
    ).text();
    const edgeSource = await Bun.file(
      new URL('../src/client/edge.ts', import.meta.url),
    ).text();
    const edgeFiles = `${verifierSource}\n${recoverySource}\n${middlewareSource}\n${edgeSource}`;

    expect(edgeFiles).not.toMatch(/(?:node:crypto|from\s+['"]crypto['"]|\bBuffer\b)/);
    expect(edgeFiles).toContain('globalThis.crypto.subtle');
  });
});

describe('Kafil navigation regression', () => {
  test('login and refresh cookies permit dashboard and operator navigation', async () => {
    const loginSession = await signSession(claims('admin', Date.now() - 1_000));
    const loginResponse = authResponse('login-refresh', loginSession);
    const cookieJar = new Map<string, string>();
    preserveAuthCookies(loginResponse, cookieJar);

    const refreshedSession = await signSession(claims('admin'));
    const refreshResponse = authResponse('rotated-refresh', refreshedSession);
    preserveAuthCookies(refreshResponse, cookieJar);

    expect(cookieJar.get('refreshToken')).toBe('rotated-refresh');
    expect(cookieJar.get(SESSION_COOKIE)).toBe(encodeURIComponent(refreshedSession));

    const browserCookies = [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');
    const middleware = standardMiddleware();
    for (const pathname of [
      '/dashboard',
      '/operator',
      '/operator/families',
      '/operator/settings',
    ]) {
      expectAllowed(await middleware(request(pathname, browserCookies)));
    }
  });
});

function authResponse(refreshToken: string, session: string): Response {
  const headers = new Headers();
  headers.append('Set-Cookie', `refreshToken=${refreshToken}; Path=/; HttpOnly; Secure`);
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure`,
  );
  return new Response(JSON.stringify({ data: { accessToken: 'bearer-access-token' } }), {
    status: 200,
    headers,
  });
}

function preserveAuthCookies(response: Response, jar: Map<string, string>): void {
  const setCookie = response.headers.get('set-cookie') ?? '';
  for (const name of ['refreshToken', SESSION_COOKIE]) {
    const match = setCookie.match(new RegExp(`(?:^|,\\s*)${escapeRegex(name)}=([^;]+)`));
    if (match) jar.set(name, match[1]!);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
