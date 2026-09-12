import { afterEach, describe, expect, test } from 'bun:test';
import { withAuthMiddleware } from '../src/client/server/withAuthMiddleware';
import type { SessionCookieClaims } from '../src/client/sessionCookie';

/**
 * FIX-04 — School speculative-prefetch safety boundary.
 *
 * School `apps/dashboard/src/proxy.ts:12-27` currently bypasses `auth.proxy`
 * when a `refreshToken` cookie is present on a speculative prefetch:
 * `if (hasRefreshToken && isSpeculativePrefetch) return NextResponse.next()`.
 * Refresh-cookie presence is never authorization.
 *
 * The `najm-auth` proxy contract must remain safe without that bypass: every
 * protected navigation — direct or speculative — either presents a valid
 * signed session snapshot or completes non-rotating `/session/recover`
 * validation. A forged, invalid, revoked, or expired refresh session must fail
 * closed even when every School speculative signal is present. A delayed
 * invalid recovery response fails closed, and under School's authoritative
 * mode (`proxySessionMode: 'authoritative'`) a late session snapshot alone
 * cannot restore ongoing authentication after logout cleared the refresh
 * session. An in-flight recovery that linearized before logout may still
 * complete for that one request; the guarantee is that the next request
 * cannot reuse its snapshot without a live refresh session.
 *
 * Each test below pins observable proxy behavior (status, redirect target,
 * cookie clearing, recovery endpoint/method, non-rotation) so any
 * implementation that simply returns `NextResponse.next()` for a speculative
 * request merely because `refreshToken` is present fails: it would produce 200
 * with zero recovery calls where 307 is required, or 200 with zero recovery
 * calls where authenticated recovery is required.
 */

const SESSION_SECRET = 'speculative-safety-secret-speculative-safety';
const SESSION_COOKIE = 'najm.session';
const REFRESH_COOKIE = 'refreshToken';
const VALID_REFRESH = 'valid-refresh-token';
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

/**
 * Every School speculative signal from `proxy.ts:12-22`. Header names match
 * the School source exactly (Fetch Headers are case-insensitive, so the
 * existing `Next-Router-Prefetch` spelling is covered by the first entry).
 */
const SPECULATIVE_VARIANTS: Array<{ name: string; headers: Record<string, string> }> = [
  { name: 'next-router-prefetch', headers: { 'next-router-prefetch': '1' } },
  { name: 'purpose:prefetch', headers: { purpose: 'prefetch' } },
  { name: 'sec-purpose contains prefetch', headers: { 'sec-purpose': 'prefetch; prerender' } },
  {
    name: 'next-router-state-tree metadata-only',
    headers: { 'next-router-state-tree': '["", {"children": ["__PAGE__", {}]}, null, "metadata-only"]' },
  },
];

function standardMiddleware(overrides: Parameters<typeof withAuthMiddleware>[0] = {}) {
  return withAuthMiddleware({
    protectedRoutes: ['/dashboard/:path*', '/operator/:path*'],
    publicRoutes: ['/login', '/about'],
    loginRoute: '/login',
    roleRoutes: {
      '/operator/:path*': ['admin', 'operator'],
    },
    sessionSecret: SESSION_SECRET,
    ...overrides,
  });
}

/**
 * School's actual proxy contract (`apps/dashboard/src/lib/auth.ts:17`):
 * every protected navigation revalidates the refresh session, even when the
 * signed snapshot is still valid. Optimistic mode intentionally trusts a
 * still-valid snapshot until its max age, so immediate-revocation claims
 * below are scoped to this authoritative helper, not to `standardMiddleware`.
 */
function schoolAuthoritativeMiddleware(
  overrides: Parameters<typeof withAuthMiddleware>[0] = {},
) {
  return standardMiddleware({ proxySessionMode: 'authoritative', ...overrides });
}

function protectedRequest(
  pathname: string,
  cookie: string | undefined,
  extraHeaders: Record<string, string> = {},
): Request {
  const headers: Record<string, string> = { ...extraHeaders };
  if (cookie !== undefined) headers.Cookie = cookie;
  return new Request(`https://kafil.example${pathname}`, { headers });
}

function refreshOnlyCookie(value: string): string {
  return `${REFRESH_COOKIE}=${value}`;
}

/** Recovery mock that only honors an explicit allow-list, like a real server. */
function mockStrictRecovery(allowed: Set<string>, role = 'admin') {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const cookie = (init?.headers as Record<string, string> | undefined)?.Cookie
      ?? (init?.headers instanceof Headers ? init.headers.get('Cookie') ?? '' : '');
    const presented = readCookie(cookie, REFRESH_COOKIE);
    if (!presented || !allowed.has(presented)) {
      return new Response(null, { status: 401 });
    }
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

function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

function setCookieHeaders(response: Response): string[] {
  const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie();
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function clearsCookie(response: Response, name: string): boolean {
  return setCookieHeaders(response).some(
    (header) =>
      header.startsWith(`${name}=`) &&
      (header.startsWith(`${name}=;`) ||
        /Max-Age=0/i.test(header) ||
        /Expires=Thu, 01 Jan 1970/i.test(header)),
  );
}

function setsCookie(response: Response, name: string): string | undefined {
  for (const header of setCookieHeaders(response)) {
    const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;]*)`));
    if (match && match[1] !== undefined && !/Max-Age=0/i.test(header) && !/Expires=Thu, 01 Jan 1970/i.test(header)) {
      return match[1];
    }
  }
  return undefined;
}

function recoveryCookieHeader(call: { init?: RequestInit }): string {
  const headers = call.init?.headers;
  if (headers instanceof Headers) return headers.get('Cookie') ?? '';
  if (headers && typeof headers === 'object') {
    return (headers as Record<string, string>).Cookie ?? '';
  }
  return '';
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
}

describe('FIX-04 direct protected navigation baseline', () => {
  test('recoverable refresh session uses non-rotating /session/recover', async () => {
    const calls = mockRecovery('admin');
    const response = await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH)),
    );

    expectAllowed(response);
    // A cookie-presence bypass would skip recovery entirely; the safe contract
    // requires exactly one authoritative round trip.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://kafil.example/api/auth/session/recover');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).not.toContain('/refresh');
    expect(recoveryCookieHeader(calls[0]!)).toBe(`${REFRESH_COOKIE}=${VALID_REFRESH}`);
    // Non-rotating: the proxy persists only the reissued session snapshot.
    expect(setsCookie(response, SESSION_COOKIE)).toBeTruthy();
    expect(setsCookie(response, REFRESH_COOKIE)).toBeUndefined();
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  test('direct navigation with an invalid refresh session fails closed and clears both cookies', async () => {
    mockRecovery('admin', 401);
    const response = await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie('revoked-refresh-token')),
    );

    expectLoginRedirect(response, '/operator');
    expect(clearsCookie(response, REFRESH_COOKIE)).toBe(true);
    expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
  });
});

describe('FIX-04 speculative signals never authorize from cookie presence', () => {
  test.each(SPECULATIVE_VARIANTS.map((variant) => [variant.name] as [string]))(
    'recoverable speculative request (%s) still completes non-rotating recovery',
    async (name) => {
      const variant = SPECULATIVE_VARIANTS.find((entry) => entry.name === name)!;
      const calls = mockRecovery('admin');
      const response = await standardMiddleware()(
        protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), variant.headers),
      );

      expectAllowed(response);
      // Pins the absence of a bypass: speculative headers must not suppress the
      // recovery round trip, and recovery must not rotate refresh tokens.
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe('https://kafil.example/api/auth/session/recover');
      expect(calls[0]!.init?.method).toBe('POST');
      expect(calls[0]!.url).not.toContain('/refresh');
      expect(recoveryCookieHeader(calls[0]!)).toBe(`${REFRESH_COOKIE}=${VALID_REFRESH}`);
      expect(setsCookie(response, SESSION_COOKIE)).toBeTruthy();
      expect(setsCookie(response, REFRESH_COOKIE)).toBeUndefined();
      expect(response.headers.get('x-middleware-request-cookie')).toContain(`${SESSION_COOKIE}=`);
    },
  );

  test.each(SPECULATIVE_VARIANTS.map((variant) => [variant.name] as [string]))(
    'forged refresh cookie on speculative request (%s) fails closed',
    async (name) => {
      const variant = SPECULATIVE_VARIANTS.find((entry) => entry.name === name)!;
      const allowed = new Set([VALID_REFRESH]);
      const calls = mockStrictRecovery(allowed);
      const response = await standardMiddleware()(
        protectedRequest('/operator', refreshOnlyCookie('forged-refresh-token'), variant.headers),
      );

      // A `NextResponse.next()`-on-cookie-presence bypass would return 200
      // here without any recovery call. The safe contract redirects and still
      // attempted exactly one authoritative validation.
      expectLoginRedirect(response, '/operator');
      expect(calls).toHaveLength(1);
      expect(clearsCookie(response, REFRESH_COOKIE)).toBe(true);
      expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
      expect(setsCookie(response, SESSION_COOKIE)).toBeUndefined();
    },
  );

  test.each(SPECULATIVE_VARIANTS.map((variant) => [variant.name] as [string]))(
    'expired refresh session on speculative request (%s) redirects and clears both cookies',
    async (name) => {
      const variant = SPECULATIVE_VARIANTS.find((entry) => entry.name === name)!;
      mockRecovery('admin', 401);
      const response = await standardMiddleware()(
        protectedRequest('/dashboard/orders?filter=open', refreshOnlyCookie('expired-refresh'), variant.headers),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'https://kafil.example/login?from=%2Fdashboard%2Forders%3Ffilter%3Dopen',
      );
      expect(clearsCookie(response, REFRESH_COOKIE)).toBe(true);
      expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
    },
  );

  test('tampered session plus invalid refresh on a speculative request fails closed', async () => {
    const session = await signSession(claims('admin'));
    const separator = session.lastIndexOf('.');
    const signature = session.slice(separator + 1);
    const replacement = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${session.slice(0, separator + 1)}${replacement}${signature.slice(1)}`;
    mockRecovery('admin', 401);

    const response = await standardMiddleware()(
      protectedRequest(
        '/operator',
        `${REFRESH_COOKIE}=revoked-refresh; ${SESSION_COOKIE}=${encodeURIComponent(tampered)}`,
        SPECULATIVE_VARIANTS[0]!.headers,
      ),
    );

    expectLoginRedirect(response, '/operator');
    expect(clearsCookie(response, REFRESH_COOKIE)).toBe(true);
    expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
  });

  test('speculative request without any refresh session redirects without calling recovery', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('recovery without a refresh cookie must not fetch');
    }) as typeof fetch;

    for (const variant of SPECULATIVE_VARIANTS) {
      const response = await standardMiddleware()(
        protectedRequest('/operator', undefined, variant.headers),
      );
      expectLoginRedirect(response, '/operator');
    }
    expect(fetchCalls).toBe(0);
  });
});

describe('FIX-04 delayed recovery and School authoritative ordering', () => {
  test('a delayed 401 recovery response fails closed instead of authenticating', async () => {
    let resolveRecovery!: (response: Response) => void;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Promise<Response>((resolve) => {
        resolveRecovery = resolve;
      });
    }) as typeof fetch;

    const pending = standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[0]!.headers),
    );
    // Let the proxy start its authoritative round trip before the delayed
    // invalid response arrives.
    await Bun.sleep(0);
    expect(calls).toHaveLength(1);

    // The delayed response reports the refresh session as invalid. The proxy
    // must fail closed for this navigation. This models a late invalid
    // response only; browser cookie ordering after logout is covered by the
    // authoritative late-success test below.
    resolveRecovery(new Response(null, { status: 401 }));
    const response = await pending;

    expectLoginRedirect(response, '/operator');
    expect(clearsCookie(response, REFRESH_COOKIE)).toBe(true);
    expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
    expect(setsCookie(response, SESSION_COOKIE)).toBeUndefined();
  });

  test('a late session snapshot alone cannot restore authentication after logout under authoritative mode', async () => {
    // Recovery starts with the refresh cookie present and ultimately returns
    // a correctly signed session. This represents server validation that
    // linearized before logout cleared the browser jar: completing this one
    // in-flight request is acceptable and honest.
    let resolveRecovery!: (response: Response) => void;
    const firstCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      firstCalls.push({ url: String(input), init });
      return new Promise<Response>((resolve) => {
        resolveRecovery = resolve;
      });
    }) as typeof fetch;

    const inFlight = schoolAuthoritativeMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[0]!.headers),
    );
    await Bun.sleep(0);
    expect(firstCalls).toHaveLength(1);

    // Logout clears the browser refresh/session cookies while recovery is in
    // flight; the server validation below still predates that clearing.
    const lateSession = await signSession(claims('admin'));
    resolveRecovery(
      new Response(JSON.stringify({ data: { recovered: true } }), {
        status: 200,
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(lateSession)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      }),
    );
    const lateResponse = await inFlight;
    expectAllowed(lateResponse);
    expect(firstCalls).toHaveLength(1);
    // Non-rotating: the late success installs only the session snapshot.
    expect(setsCookie(lateResponse, SESSION_COOKIE)).toBeTruthy();
    expect(setsCookie(lateResponse, REFRESH_COOKIE)).toBeUndefined();

    // The browser jar after logout plus the late response holds only the late
    // session snapshot: no refresh cookie. The next protected navigation —
    // speculative and direct — must fail closed under School authoritative
    // semantics, clear the snapshot, and perform no recovery fetch.
    const lateSnapshot = setsCookie(lateResponse, SESSION_COOKIE)!;
    for (const extraHeaders of [SPECULATIVE_VARIANTS[1]!.headers, {}]) {
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        throw new Error('authoritative snapshot without refresh must not fetch');
      }) as typeof fetch;

      const next = await schoolAuthoritativeMiddleware()(
        protectedRequest('/operator', `${SESSION_COOKIE}=${lateSnapshot}`, extraHeaders),
      );
      expectLoginRedirect(next, '/operator');
      expect(clearsCookie(next, SESSION_COOKIE)).toBe(true);
      expect(setsCookie(next, SESSION_COOKIE)).toBeUndefined();
      expect(setsCookie(next, REFRESH_COOKIE)).toBeUndefined();
      expect(fetchCalls).toBe(0);
    }
  });

  test('a delayed recovery payload with an untrusted signature is rejected by local HMAC verification', async () => {
    let resolveRecovery!: (response: Response) => void;
    globalThis.fetch = (async () => {
      return new Promise<Response>((resolve) => {
        resolveRecovery = resolve;
      });
    }) as typeof fetch;

    const pending = standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[2]!.headers),
    );
    await Bun.sleep(0);

    // The delayed payload is signed with an unknown secret. Local HMAC
    // verification must fail closed rather than installing the cookie. This
    // test models signature rejection only, not server-side revocation.
    const forged = await signSession(claims('admin'), 'unknown-secret-unknown-secret-12');
    resolveRecovery(
      new Response(null, {
        status: 200,
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(forged)}; Path=/; HttpOnly`,
        },
      }),
    );
    const response = await pending;

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?from=');
    expect(setsCookie(response, SESSION_COOKIE)).toBeUndefined();
  });

  test('concurrent speculative and direct navigations each validate and never call token refresh', async () => {
    const calls = mockRecovery('admin');
    const middleware = standardMiddleware();
    const navigations = [
      protectedRequest('/operator', refreshOnlyCookie('shared-refresh'), SPECULATIVE_VARIANTS[0]!.headers),
      protectedRequest('/operator/families', refreshOnlyCookie('shared-refresh'), SPECULATIVE_VARIANTS[2]!.headers),
      protectedRequest('/operator/settings', refreshOnlyCookie('shared-refresh')),
    ];
    const responses = await Promise.all(navigations.map((value) => middleware(value)));

    responses.forEach(expectAllowed);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.init?.method === 'POST')).toBe(true);
    expect(calls.every((call) => call.url.endsWith('/session/recover'))).toBe(true);
    expect(calls.every((call) => !call.url.includes('/refresh'))).toBe(true);
  });
});

describe('FIX-04 response and redirect semantics for speculative navigation', () => {
  test('transport failure on a speculative request preserves refresh state and stays visible', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
    const response = await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[1]!.headers),
    );

    expectLoginRedirect(response, '/operator');
    // Unavailable (transport/5xx) clears only the short session snapshot so a
    // transient outage does not destroy the refresh session. Invalid (401)
    // clears both; see the forged/expired tests above.
    expect(clearsCookie(response, SESSION_COOKIE)).toBe(true);
    expect(clearsCookie(response, REFRESH_COOKIE)).toBe(false);
  });

  test('role mismatch after speculative recovery returns 403 with the recovered session', async () => {
    const calls = mockRecovery('sponsor');
    const response = await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[0]!.headers),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
    expect(calls).toHaveLength(1);
    expect(setsCookie(response, SESSION_COOKIE)).toBeTruthy();
    expect(setsCookie(response, REFRESH_COOKIE)).toBeUndefined();
  });

  test('request header overrides survive speculative recovery for downstream CSP composition', async () => {
    mockRecovery('admin');
    const response = await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[0]!.headers),
      {
        requestHeaders: {
          'content-security-policy': "script-src 'self' 'nonce-request-value'",
          'x-nonce': 'request-value',
        },
      },
    );

    // School composes nonce/CSP headers around `auth.proxy`. A bypass that
    // returns early would drop this composition; recovery must preserve it.
    expectAllowed(response);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe('request-value');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(
      "script-src 'self' 'nonce-request-value'",
    );
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  test('public routes with speculative headers never trigger recovery', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('public speculative navigation must not recover');
    }) as typeof fetch;

    for (const variant of SPECULATIVE_VARIANTS) {
      const response = await standardMiddleware()(
        protectedRequest('/login', `${REFRESH_COOKIE}=any-value`, variant.headers),
      );
      expectAllowed(response);
    }
    expect(fetchCalls).toBe(0);
  });

  test('recovery request shape never performs a state-changing token refresh', async () => {
    const calls = mockRecovery('admin');
    await standardMiddleware()(
      protectedRequest('/operator', refreshOnlyCookie(VALID_REFRESH), SPECULATIVE_VARIANTS[3]!.headers),
    );

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://kafil.example/api/auth/session/recover');
    expect(call.url).not.toContain('/refresh');
    expect(call.init?.method).toBe('POST');
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Cookie).toBe(`${REFRESH_COOKIE}=${VALID_REFRESH}`);
    expect(headers['X-Najm-Session-Recovery']).toBe('1');
    expect(call.init?.cache).toBe('no-store');
    expect(call.init?.redirect).toBe('manual');
  });
});
