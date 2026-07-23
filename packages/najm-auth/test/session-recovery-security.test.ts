import { afterEach, describe, expect, test } from 'bun:test';
import {
  requestSessionRecovery,
  resolveInternalRecoveryURL,
  type SessionRecoveryFailure,
} from '../src/client/sessionRecovery';

const SESSION_SECRET = 'recovery-security-secret-recovery-security-secret';
const REFRESH_TOKEN = 'refresh-token-secret-value';
const originalFetch = globalThis.fetch;
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('server-side session recovery endpoint security', () => {
  test('allows a relative same-origin recovery path and forwards only the refresh cookie', async () => {
    const calls = mockSuccessfulRecovery();

    await expect(recover('/api/auth/session/recover')).resolves.toMatchObject({
      status: 'recovered',
      claims: { user: { id: 'user-admin' }, roles: ['admin'] },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://kafil.example/api/auth/session/recover');
    expect(calls[0]?.init?.headers).toMatchObject({
      Cookie: `refreshToken=${REFRESH_TOKEN}`,
    });
  });

  test('allows an exact same-origin absolute HTTPS URL', async () => {
    const calls = mockSuccessfulRecovery();

    await expect(
      recover('https://kafil.example/api/auth/session/recover'),
    ).resolves.toMatchObject({ status: 'recovered' });
    expect(calls).toHaveLength(1);
  });

  test.each([
    'http://localhost:3000/api/auth/session/recover',
    'http://127.0.0.1:3000/api/auth/session/recover',
    'http://[::1]:3000/api/auth/session/recover',
  ])('allows an explicitly configured loopback recovery endpoint: %s', async (endpoint) => {
    const calls = mockSuccessfulRecovery();

    await expect(recover(endpoint, {
      allowLoopbackEndpoint: true,
    })).resolves.toMatchObject({ status: 'recovered' });
    expect(calls[0]?.url).toBe(endpoint);
  });

  test('explicit internal recovery config takes precedence over the environment', () => {
    const original = process.env.NAJM_AUTH_INTERNAL_URL;
    try {
      process.env.NAJM_AUTH_INTERNAL_URL = 'http://127.0.0.1:3001/from-env';
      expect(resolveInternalRecoveryURL('http://127.0.0.1:3002/explicit')).toBe(
        'http://127.0.0.1:3002/explicit',
      );
      expect(resolveInternalRecoveryURL()).toBe(
        'http://127.0.0.1:3001/from-env',
      );
    } finally {
      if (original === undefined) delete process.env.NAJM_AUTH_INTERNAL_URL;
      else process.env.NAJM_AUTH_INTERNAL_URL = original;
    }
  });

  test.each([
    'http://10.0.0.5:3000/api/auth/session/recover',
    'http://192.168.1.5:3000/api/auth/session/recover',
    'https://attacker.example/api/auth/session/recover',
  ])('rejects a non-loopback internal recovery endpoint: %s', async (endpoint) => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('must not fetch an untrusted internal endpoint');
    }) as typeof fetch;

    await expect(recover(endpoint, {
      allowLoopbackEndpoint: true,
    })).resolves.toEqual({ status: 'unavailable' });
    expect(fetchCalls).toBe(0);
  });

  test.each([
    ['different HTTPS hostname', 'https://attacker.example/recover'],
    ['different port', 'https://kafil.example:444/recover'],
    ['HTTPS-to-HTTP downgrade', 'http://kafil.example/recover'],
    ['URL username credentials', 'https://user@kafil.example/recover'],
    ['URL username/password credentials', 'https://user:password@kafil.example/recover'],
    ['hostname-prefix lookalike', 'https://kafil.example.attacker.test/recover'],
    ['username lookalike', 'https://kafil.example@attacker.test/recover'],
  ])('rejects %s before fetch', async (_label, endpoint) => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('rejected recovery endpoints must not fetch');
    }) as typeof fetch;

    await expect(recover(endpoint)).resolves.toEqual({ status: 'unavailable' });
    expect(fetchCalls).toBe(0);
  });

  test.each([
    ['invalid cookie name', { refreshCookieName: 'refresh token' }],
    ['invalid session cookie name', { sessionCookieName: 'najm.session\r\nInjected' }],
    ['empty cookie value', { refreshCookieValue: '' }],
    ['cookie value with whitespace', { refreshCookieValue: 'secret value' }],
    ['cookie value with comma', { refreshCookieValue: 'secret,value' }],
    ['cookie value with semicolon', { refreshCookieValue: 'secret;other=value' }],
    ['cookie value with CRLF', { refreshCookieValue: 'secret\r\nInjected: value' }],
  ])('rejects %s before fetch', async (_label, overrides) => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('invalid cookie input must not fetch');
    }) as typeof fetch;

    const result = await recover('/api/auth/session/recover', overrides);
    expect(result.status).not.toBe('recovered');
    expect(fetchCalls).toBe(0);
  });

  test.each([
    [
      'invalid-cookie-name',
      { refreshCookieName: 'refresh token' },
      { status: 'unavailable' },
    ],
    [
      'invalid-refresh-cookie',
      { refreshCookieValue: 'secret value' },
      { status: 'invalid' },
    ],
    [
      'invalid-endpoint',
      { endpoint: 'https://attacker.example/recover' },
      { status: 'unavailable' },
    ],
  ] as const)('reports the %s reason without input material', async (
    reason,
    overrides,
    expectedResult,
  ) => {
    const failures: SessionRecoveryFailure[] = [];
    const result = await recover('/api/auth/session/recover', {
      ...overrides,
      onFailure: (failure) => failures.push(failure),
    });

    expect(result).toEqual(expectedResult);
    expect(failures).toEqual([{ reason }]);
    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain(REFRESH_TOKEN);
    expect(serialized).not.toContain('attacker.example');
  });

  test('does not log a rejected endpoint or refresh token', async () => {
    const output: string[] = [];
    console.log = (...values: unknown[]) => output.push(values.join(' '));
    console.warn = (...values: unknown[]) => output.push(values.join(' '));
    console.error = (...values: unknown[]) => output.push(values.join(' '));
    globalThis.fetch = (() => {
      throw new Error('must not fetch');
    }) as typeof fetch;

    await recover('https://attacker.example/recover');

    expect(output.join('\n')).not.toContain(REFRESH_TOKEN);
    expect(output).toHaveLength(0);
  });

  test('reports a safe fetch exception without exposing cookies or endpoints', async () => {
    const failures: unknown[] = [];
    const cause = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed', { cause });
    }) as typeof fetch;

    await expect(recover('/api/auth/session/recover', {
      onFailure: (failure) => failures.push(failure),
    })).resolves.toEqual({ status: 'unavailable' });

    expect(failures).toEqual([{
      reason: 'fetch-error',
      error: {
        name: 'TypeError',
        message: 'fetch failed',
        cause: {
          name: 'Error',
          message: 'connection refused',
          code: 'ECONNREFUSED',
        },
      },
    }]);
    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain(REFRESH_TOKEN);
    expect(serialized).not.toContain('kafil.example');
  });

  test('sanitizes and bounds diagnostic error text without credential material', async () => {
    const failures: SessionRecoveryFailure[] = [];
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    globalThis.fetch = (async () => {
      throw Object.assign(
        new Error(
          `Authorization: Bearer ${jwt}\r\nCookie: refreshToken=${REFRESH_TOKEN} `
          + `${SESSION_SECRET} https://kafil.example/${'x'.repeat(400)}`,
        ),
        {
          code: `COOKIE=${REFRESH_TOKEN}`,
          cause: new Error(`session=${SESSION_SECRET}\u0000${jwt}`),
        },
      );
    }) as typeof fetch;

    await recover('/api/auth/session/recover', {
      onFailure: (failure) => failures.push(failure),
    });

    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain(REFRESH_TOKEN);
    expect(serialized).not.toContain(SESSION_SECRET);
    expect(serialized).not.toContain(jwt);
    expect(serialized).not.toContain('kafil.example');
    for (const text of [
      failures[0]?.error?.message,
      failures[0]?.error?.code,
      failures[0]?.error?.cause?.message,
    ]) {
      expect(text).not.toMatch(/[\u0000-\u001F\u007F]/);
    }
    expect(failures[0]?.error?.message.length).toBeLessThanOrEqual(300);
    expect(failures[0]?.error?.cause?.message.length).toBeLessThanOrEqual(300);
  });

  test.each([
    [
      'HTTP status',
      () => new Response(null, { status: 503 }),
      { reason: 'http-status', httpStatus: 503 },
      { status: 'unavailable', httpStatus: 503 },
    ],
    [
      'missing Set-Cookie',
      () => Response.json({ data: { recovered: true } }),
      { reason: 'missing-set-cookie', httpStatus: 200 },
      { status: 'unavailable', httpStatus: 200 },
    ],
    [
      'Set-Cookie parsing failure',
      () => new Response(null, {
        headers: { 'Set-Cookie': 'different.cookie=value; Path=/' },
      }),
      { reason: 'session-cookie-parse', httpStatus: 200 },
      { status: 'unavailable', httpStatus: 200 },
    ],
    [
      'signed-cookie format failure',
      () => new Response(null, {
        headers: { 'Set-Cookie': 'najm.session=not-signed; Path=/' },
      }),
      { reason: 'session-cookie-parse', httpStatus: 200 },
      { status: 'unavailable', httpStatus: 200 },
    ],
  ])('reports %s as a structured failure', async (
    _label,
    response,
    expectedFailure,
    expectedResult,
  ) => {
    const failures: unknown[] = [];
    globalThis.fetch = (async () => response()) as typeof fetch;

    await expect(recover('/api/auth/session/recover', {
      onFailure: (failure) => failures.push(failure),
    })).resolves.toEqual(expectedResult);
    expect(failures).toEqual([expectedFailure]);
  });

  test('distinguishes an HMAC mismatch from Set-Cookie parsing', async () => {
    const failures: unknown[] = [];
    globalThis.fetch = (async () => {
      const session = await signedSession();
      return new Response(null, {
        headers: {
          'Set-Cookie': `najm.session=${encodeURIComponent(session)}; Path=/`,
        },
      });
    }) as typeof fetch;

    await expect(recover('/api/auth/session/recover', {
      sessionSecret: 'different-secret-different-secret-different-secret',
      onFailure: (failure) => failures.push(failure),
    })).resolves.toEqual({ status: 'unavailable', httpStatus: 200 });
    expect(failures).toEqual([{
      reason: 'session-cookie-hmac',
      httpStatus: 200,
    }]);
  });

  test('reports a valid-HMAC payload failure without exposing the payload', async () => {
    const failures: SessionRecoveryFailure[] = [];
    const invalidClaims = {
      user: { id: 'sensitive-user-id', email: 'secret@example.test' },
      roles: 'admin',
      permissions: [],
      sessionVersion: 0,
      iat: Date.now(),
    };
    globalThis.fetch = (async () => {
      const session = await signedValue(JSON.stringify(invalidClaims));
      return new Response(null, {
        headers: {
          'Set-Cookie': `najm.session=${encodeURIComponent(session)}; Path=/`,
        },
      });
    }) as typeof fetch;

    await recover('/api/auth/session/recover', {
      onFailure: (failure) => failures.push(failure),
    });
    expect(failures).toEqual([{
      reason: 'session-cookie-payload',
      httpStatus: 200,
    }]);
    expect(JSON.stringify(failures)).not.toContain('sensitive-user-id');
    expect(JSON.stringify(failures)).not.toContain('secret@example.test');
  });

  test('ignores errors thrown by the diagnostic hook', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
    await expect(recover('/api/auth/session/recover', {
      onFailure: () => {
        throw new Error('diagnostic sink unavailable');
      },
    })).resolves.toEqual({ status: 'unavailable', httpStatus: 503 });
  });
});

function recover(
  endpoint: string,
  overrides: Partial<Parameters<typeof requestSessionRecovery>[0]> = {},
) {
  return requestSessionRecovery({
    endpoint,
    requestOrigin: 'https://kafil.example',
    refreshCookieName: 'refreshToken',
    refreshCookieValue: REFRESH_TOKEN,
    sessionCookieName: 'najm.session',
    sessionSecret: SESSION_SECRET,
    ...overrides,
  });
}

function mockSuccessfulRecovery() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    const session = await signedSession();
    return new Response(JSON.stringify({ data: { recovered: true } }), {
      status: 200,
      headers: {
        'Set-Cookie': `najm.session=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }) as typeof fetch;
  return calls;
}

async function signedSession(): Promise<string> {
  const payload = JSON.stringify({
    user: {
      id: 'user-admin',
      email: 'admin@example.com',
      role: 'admin',
    },
    roles: ['admin'],
    permissions: ['admin:read'],
    sessionVersion: 0,
    iat: Date.now(),
  });
  return signedValue(payload);
}

async function signedValue(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  );
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
