import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { BOOT_REFRESH_KEY, bootRefreshScript } from '../src/client/bootRefresh';

// A signed-in page waited for all of its JavaScript before asking for the
// access token every data request needs. The page now asks from its HTML, and
// the client's first refresh takes that answer instead of asking again.

const accessToken = `header.${Buffer.from(JSON.stringify({
  userId: 'user-1',
  roles: ['admin'],
  permissions: ['read:students'],
  exp: Math.floor(Date.now() / 1000) + 900,
})).toString('base64url')}.signature`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

type FakeWindow = Record<string, unknown> & { location: { href: string } };

describe('early refresh from the page', () => {
  const originalFetch = globalThis.fetch;
  const hadWindow = 'window' in globalThis;
  const originalWindow = (globalThis as any).window;
  let page: FakeWindow;
  let sent: Array<{ url: string; init?: RequestInit }>;
  let clients: NajmAuthClient[];

  beforeEach(() => {
    page = { location: { href: 'https://school.test/home' } };
    (globalThis as any).window = page;
    sent = [];
    clients = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(input), init });
      return json({ data: { accessToken } });
    }) as typeof fetch;
  });

  afterEach(() => {
    for (const client of clients) client.destroy();
    globalThis.fetch = originalFetch;
    if (hadWindow) (globalThis as any).window = originalWindow;
    else delete (globalThis as any).window;
  });

  const client = () => {
    const created = new NajmAuthClient({ baseURL: '/api', tabSync: false });
    clients.push(created);
    return created;
  };
  const earlyAnswer = (response: Promise<Response>, url = '/api/auth/refresh', startedAt = Date.now()) => {
    page[BOOT_REFRESH_KEY] = { url, startedAt, response };
  };

  test('the script sends the refresh the client would, once', async () => {
    const script = bootRefreshScript({ url: '/api/auth/refresh' });
    new Function('window', 'fetch', script)(page, globalThis.fetch);
    new Function('window', 'fetch', script)(page, globalThis.fetch);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/auth/refresh');
    expect(sent[0].init?.method).toBe('POST');
    expect(sent[0].init?.credentials).toBe('include');
    expect((page[BOOT_REFRESH_KEY] as { url: string }).url).toBe('/api/auth/refresh');
  });

  test('the script cannot close its own element', () => {
    const script = bootRefreshScript({ url: '/api/</script><script>alert(1)</script>' });
    expect(script).not.toContain('</script>');
    expect(() => bootRefreshScript({ url: '' })).toThrow(TypeError);
  });

  test('the first refresh takes the page\'s answer and sends nothing', async () => {
    earlyAnswer(Promise.resolve(json({ data: { accessToken } })));
    const auth = client();

    await auth.refresh();

    expect(sent).toHaveLength(0);
    expect(auth.getAccessToken()).toBe(accessToken);
    expect(auth.getState().permissions).toEqual(['read:students']);
    expect(page[BOOT_REFRESH_KEY]).toBeUndefined();
  });

  test('the answer is used once; the next refresh asks the server', async () => {
    earlyAnswer(Promise.resolve(json({ data: { accessToken } })));
    const auth = client();

    await auth.refresh();
    await auth.refresh();

    expect(sent.map((request) => request.url)).toEqual(['/api/auth/refresh']);
  });

  test('a refusal in the page\'s answer ends the session without asking again', async () => {
    earlyAnswer(Promise.resolve(json({ message: 'Refresh token invalid' }, 401)));
    const auth = client();
    const expired: unknown[] = [];
    auth.on('sessionExpired', (event) => { expired.push(event); });

    await expect(auth.refresh()).rejects.toThrow('Session expired');

    expect(sent).toHaveLength(0);
    expect(expired).toHaveLength(1);
    expect(auth.getAccessToken()).toBeNull();
  });

  test('an early request that got no answer falls back to an ordinary refresh', async () => {
    earlyAnswer(Promise.reject(new TypeError('Failed to fetch')));
    const auth = client();

    await auth.refresh();

    expect(sent.map((request) => request.url)).toEqual(['/api/auth/refresh']);
    expect(auth.getAccessToken()).toBe(accessToken);
  });

  test('a server failure in the early answer falls back to an ordinary refresh', async () => {
    earlyAnswer(Promise.resolve(json({ message: 'Unavailable' }, 503)));
    const auth = client();

    await auth.refresh();

    expect(sent).toHaveLength(1);
    expect(auth.getAccessToken()).toBe(accessToken);
  });

  test('an answer for another endpoint, or older than a minute, is dropped', async () => {
    const unused = Promise.resolve(json({ data: { accessToken: 'never-used' } }));
    earlyAnswer(unused, '/elsewhere/auth/refresh');
    const auth = client();
    await auth.refresh();
    expect(sent).toHaveLength(1);
    expect(page[BOOT_REFRESH_KEY]).toBeUndefined();

    earlyAnswer(unused, '/api/auth/refresh', Date.now() - 61_000);
    const later = client();
    await later.refresh();
    expect(sent).toHaveLength(2);
    expect(later.getAccessToken()).toBe(accessToken);
  });

  test('an absolute endpoint matches the same relative one', async () => {
    earlyAnswer(Promise.resolve(json({ data: { accessToken } })), 'https://school.test/api/auth/refresh');
    const auth = client();

    await auth.refresh();

    expect(sent).toHaveLength(0);
  });
});
