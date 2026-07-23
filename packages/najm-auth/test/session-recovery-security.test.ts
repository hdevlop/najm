import { afterEach, describe, expect, test } from 'bun:test';
import { requestSessionRecovery } from '../src/client/sessionRecovery';

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
