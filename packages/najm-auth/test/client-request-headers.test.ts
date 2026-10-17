import { afterEach, describe, expect, test } from 'bun:test';
import { NajmAuthClient } from '../src/client/NajmAuthClient';

// A reset requested from a sign-in page went out without the page's language,
// so the server answered and emailed in its default language.
describe('NajmAuthClient request headers', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function capture() {
    const seen: Array<Record<string, string>> = [];
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen.push({ ...(init?.headers as Record<string, string>) });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    return seen;
  }

  test('auth operations carry the headers of the registered source, read per request', async () => {
    const seen = capture();
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    let language = 'fr';
    client.setRequestHeaders(() => ({ 'X-Language': language }));
    await client.forgotPassword({ email: 'a@school.test' });
    language = 'ar';
    await client.resetPassword({ token: 't', newPassword: 'Password123' });
    expect(seen.map((headers) => headers['X-Language'])).toEqual(['fr', 'ar']);
  });

  test('a request\'s own headers win, and unbinding stops the source', async () => {
    const seen = capture();
    const client = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    const unbind = client.setRequestHeaders(() => ({ 'X-Language': 'fr' }));
    await client.api.get('/x', { headers: { 'X-Language': 'es' }, skipAuth: true });
    unbind();
    await client.forgotPassword({ email: 'a@school.test' });
    expect(seen[0]['X-Language']).toBe('es');
    expect(seen[1]['X-Language']).toBeUndefined();
  });
});
