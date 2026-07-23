import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';

const SESSION_SECRET = 'server-session-secret-server-session-secret';
const cookieValues = new Map<string, string>();

mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => [...cookieValues].map(([name, value]) => ({ name, value })),
  }),
}));

let getSession: typeof import('../src/client/server/getSession').getSession;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  ({ getSession } = await import('../src/client/server/getSession'));
});

afterEach(() => {
  cookieValues.clear();
  globalThis.fetch = originalFetch;
});

describe('server getSession signed-cookie validation', () => {
  test('uses the same verified signed session claims as middleware', async () => {
    cookieValues.set('najm.session', await signedSession('family'));
    globalThis.fetch = (() => {
      throw new Error('valid signed sessions must not fetch /auth/me');
    }) as unknown as typeof fetch;

    await expect(getSession({ sessionSecret: SESSION_SECRET })).resolves.toMatchObject({
      user: { id: 'user-family', role: 'family' },
      roles: ['family'],
      permissions: ['family:read'],
    });
  });

  test('does not let a refresh cookie bypass a tampered session cookie', async () => {
    const valid = await signedSession('admin');
    const separator = valid.lastIndexOf('.');
    const signature = valid.slice(separator + 1);
    const replacement = signature[0] === 'A' ? 'B' : 'A';
    cookieValues.set(
      'najm.session',
      `${valid.slice(0, separator + 1)}${replacement}${signature.slice(1)}`,
    );
    cookieValues.set('refreshToken', 'otherwise-valid-refresh');

    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return Response.json({ data: { id: 'bypass', role: 'admin' } });
    }) as unknown as typeof fetch;

    await expect(getSession({ sessionSecret: SESSION_SECRET })).resolves.toBeNull();
    expect(fetchCalls).toBe(0);
  });
});

async function signedSession(role: string): Promise<string> {
  const payload = JSON.stringify({
    user: {
      id: `user-${role}`,
      email: `${role}@example.com`,
      role,
    },
    roles: [role],
    permissions: [`${role}:read`],
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
