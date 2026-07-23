import { describe, expect, test } from 'bun:test';
import { withAuthMiddleware } from '../src/client/server/withAuthMiddleware';
import {
  resolveSessionSecret,
  verifySessionCookie,
  type SessionCookieClaims,
} from '../src/client/sessionCookie';

const SESSION_SECRET = 'session-secret-session-secret-session-secret';
const SESSION_COOKIE = 'najm.session';

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

  test('tampered signature is rejected', async () => {
    const session = await signSession(claims('admin'));
    const separator = session.lastIndexOf('.');
    const signature = session.slice(separator + 1);
    const replacement = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${session.slice(0, separator + 1)}${replacement}${signature.slice(1)}`;

    const response = await standardMiddleware()(request('/operator', cookieHeader(tampered)));
    expectLoginRedirect(response, '/operator');
  });

  test('expired session is rejected', async () => {
    const session = await signSession(claims('admin', Date.now() - 301_000));
    const response = await standardMiddleware()(request('/operator', cookieHeader(session)));
    expectLoginRedirect(response, '/operator');
  });

  test('valid refresh cookie without a valid session cannot bypass protection', async () => {
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

  test('verifyAlways validates locally without relying on cookie-only /auth/me', async () => {
    const session = await signSession(claims('sponsor'));
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('/auth/me must not be called');
    }) as unknown as typeof fetch;

    try {
      const response = await standardMiddleware({ verifyAlways: true })(
        request('/dashboard', cookieHeader(session)),
      );
      expectAllowed(response);
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('public routes remain unaffected by missing or invalid cookies', async () => {
    expectAllowed(await standardMiddleware()(request('/login', 'najm.session=tampered')));
    expectAllowed(await standardMiddleware()(request('/about')));
  });

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
    const edgeSource = await Bun.file(
      new URL('../src/client/edge.ts', import.meta.url),
    ).text();
    const edgeFiles = `${verifierSource}\n${middlewareSource}\n${edgeSource}`;

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
    const middleware = standardMiddleware({ verifyAlways: true });
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
