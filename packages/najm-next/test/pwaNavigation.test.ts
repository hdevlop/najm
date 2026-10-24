import { describe, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { createNajmServiceWorker, type NajmOfflineDocumentOptions, type NajmOfflineDocumentText,
  type NajmServiceWorkerOptions } from '../src/pwa';
import { rememberNajmOfflineLanguage } from '../src/pwaClient';

const origin = 'https://app.example';
const options: NajmServiceWorkerOptions = {
  offlineUrl: '/shell.html', precache: ['/shell.js'],
  navigationFallback: { paths: ['/attendance/students', '/students/*'], timeoutMs: 15 },
};

async function worker({ config = options, network = async () => new Response('online'), cached = true, database }:
  { config?: NajmServiceWorkerOptions; network?: (request: any, init?: RequestInit) => Promise<Response>; cached?: boolean;
    database?: IDBFactory } = {}) {
  const handlers = new Map<string, (event: any) => void>();
  const source = await createNajmServiceWorker(config)().text();
  const shell = new Response('public fixture shell', { headers: { 'Content-Type': 'text/html' } });
  new Function('self', 'caches', 'fetch', 'indexedDB', source)(
    { location: { origin }, addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler) },
    { open: async () => ({ match: async () => cached ? shell.clone() : undefined }) }, network, database,
  );
  return (path: string, overrides: Record<string, unknown> = {}) => {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')!({
      request: { url: origin + path, method: 'GET', mode: 'navigate', headers: new Headers(), signal: new AbortController().signal, ...overrides },
      respondWith: (work: Promise<Response>) => { response = work; },
    });
    return response;
  };
}

describe('opt-in navigation fallback', () => {
  test.each([502, 503, 504])('serves the cached shell for gateway %s', async status => {
    const navigate = await worker({ network: async () => new Response('gateway', { status }) });
    expect(await (await navigate('/students/aya?tab=attendance'))!.text()).toBe('public fixture shell');
  });

  test.each([200, 302, 307, 401, 403, 404, 500])('preserves actual status %s', async status => {
    const navigate = await worker({ network: async () => new Response('original', { status }) });
    const response = await navigate('/attendance/students');
    expect(response!.status).toBe(status);
    expect(await response!.text()).toBe('original');
  });

  test('does not intercept unlisted paths, siblings, writes, external requests or payload fetches', async () => {
    const navigate = await worker();
    for (const path of ['/login', '/students', '/students-extra/aya', '/download.pdf']) expect(navigate(path)).toBeUndefined();
    for (const overrides of [{ mode: 'cors' }, { method: 'POST' }, { url: 'https://external.example/students/aya' }]) {
      expect(navigate('/students/aya', overrides)).toBeUndefined();
    }
    expect(await (await navigate('/attendance/students?view=roster'))!.text()).toBe('online');
  });

  test('excludes API and RSC requests even with a broad allowlist', async () => {
    const navigate = await worker({ config: { ...options, navigationFallback: { paths: ['/*'] } } });
    for (const path of ['/api', '/api/students', '/_next', '/_next/data.json', '/students/aya?_rsc=payload']) {
      expect(navigate(path)).toBeUndefined();
    }
    for (const headers of [{ RSC: '1' }, { 'Next-Router-State-Tree': 'tree' }, { 'Next-Router-Prefetch': '1' }, { Accept: 'text/x-component' }]) {
      expect(navigate('/students/aya', { headers: new Headers(headers) })).toBeUndefined();
    }
  });

  test('preserves downloads, opaque redirects and followed redirects with gateway status', async () => {
    const download = new Response('download', { status: 503, headers: { 'Content-Disposition': 'attachment; filename=report.csv' } });
    const redirected = new Response('login unavailable', { status: 503 });
    Object.defineProperty(redirected, 'redirected', { value: true });
    const opaque = new Response(null);
    Object.defineProperty(opaque, 'type', { value: 'opaqueredirect' });
    const flight = new Response('flight payload', { status: 503, headers: { 'Content-Type': 'Text/X-Component; charset=utf-8' } });
    for (const original of [download, redirected, opaque, flight]) {
      const navigate = await worker({ network: async () => original });
      expect(await navigate('/students/aya')).toBe(original);
    }
  });

  test('handles a rejection without caching online content', async () => {
    const navigate = await worker({ network: async () => { throw new TypeError('Network unavailable'); } });
    expect(await (await navigate('/attendance/students'))!.text()).toBe('public fixture shell');
  });

  test('bounds a hung request, aborts it, and ignores a late response', async () => {
    let signal: AbortSignal | undefined;
    let finish!: (response: Response) => void;
    const navigate = await worker({ network: async (_, init) => {
      signal = init!.signal!;
      return new Promise(resolve => { finish = resolve; });
    } });
    const response = await navigate('/students/aya');
    expect(signal!.aborted).toBe(true);
    expect(await response!.text()).toBe('public fixture shell');
    finish(new Response('late private response'));
    await Promise.resolve();
    expect(response!.status).toBe(200);
  });

  test('keeps waiting after the deadline when the cached shell is unavailable', async () => {
    let aborted = false;
    const navigate = await worker({ cached: false, network: async (_, init) => {
      init!.signal!.addEventListener('abort', () => { aborted = true; });
      await Bun.sleep(30);
      return new Response('late network success');
    } });
    expect(await (await navigate('/students/aya'))!.text()).toBe('late network success');
    expect(aborted).toBe(false);
  });

  test('preserves caller cancellation instead of treating it as an outage', async () => {
    const caller = new AbortController();
    const navigate = await worker({ network: async (_, init) => new Promise((_, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    }) });
    const response = navigate('/students/aya', { signal: caller.signal });
    caller.abort();
    await expect(response).rejects.toThrow('Cancelled');
  });

  test('preserves gateway status without a cached shell and uses generic 503 on rejection', async () => {
    const gateway = await worker({ cached: false, network: async () => new Response('gateway', { status: 502 }) });
    expect((await gateway('/students/aya'))!.status).toBe(502);
    const rejected = await worker({ cached: false, network: async () => { throw new Error('Network unavailable'); } });
    const response = await rejected('/students/aya');
    expect(response!.status).toBe(503);
    expect(await response!.text()).toContain('You are offline');
  });

  test('leaves the existing default behavior unchanged', async () => {
    const navigate = await worker({ config: {}, network: async () => new Response('gateway', { status: 503 }) });
    expect((await navigate('/anywhere'))!.status).toBe(503);
    const rejected = await worker({ config: {}, network: async () => { throw new Error('Network unavailable'); } });
    expect((await rejected('/anywhere'))!.status).toBe(503);
  });

  test('leaves unlisted documents to the browser by default', async () => {
    const navigate = await worker({ config: { ...options, navigationFallback: { ...options.navigationFallback!, otherDocuments: 'browser' } } });
    for (const path of ['/', '/login', '/students']) expect(navigate(path)).toBeUndefined();
  });

  test('rejects invalid policy before generating a worker', () => {
    expect(() => createNajmServiceWorker({ navigationFallback: { paths: ['/students'] } })).toThrow('requires offlineUrl');
    for (const paths of [[], ['students'], ['//other/app'], ['/students?query'], ['/students#hash'], ['/students/../login'], ['/stu*dents'], ['/students\\other']]) {
      expect(() => createNajmServiceWorker({ offlineUrl: '/shell', navigationFallback: { paths } })).toThrow('navigationFallback.paths');
    }
    for (const timeoutMs of [0, -1, 1.5, NaN, Infinity, 60_001]) {
      expect(() => createNajmServiceWorker({ ...options, navigationFallback: { paths: ['/students'], timeoutMs } })).toThrow('timeoutMs');
    }
    for (const otherDocuments of ['shell', '', null]) {
      expect(() => createNajmServiceWorker({ ...options, navigationFallback: { paths: ['/students'], otherDocuments: otherDocuments as never } })).toThrow('otherDocuments');
    }
  });
});

describe('offline document for unlisted documents', () => {
  const config: NajmServiceWorkerOptions = { ...options, navigationFallback: { ...options.navigationFallback!, otherDocuments: 'offlineDocument' } };
  const offline = async () => { throw new TypeError('Network unavailable'); };

  test('answers a connection failure with the inline document, never the cached shell', async () => {
    const navigate = await worker({ config, network: offline });
    for (const path of ['/', '/welcome', '/login?next=%2Fstudents', '/reset-password', '/students', '/students-extra/aya', '/any/unlisted/page']) {
      const response = await navigate(path);
      expect(response!.status).toBe(503);
      expect(response!.headers.get('Cache-Control')).toBe('no-store');
      expect(await response!.text()).toContain('You are offline');
    }
    expect(await (await navigate('/students/aya'))!.text()).toBe('public fixture shell');
    // A missing or evicted shell does not change the unlisted answer.
    const evicted = await worker({ config, network: offline, cached: false });
    expect(await (await evicted('/welcome'))!.text()).toContain('You are offline');
  });

  test.each([200, 302, 307, 401, 403, 404, 500, 502, 503, 504])('keeps the actual %s response', async status => {
    const navigate = await worker({ config, network: async () => new Response('original', { status }) });
    const response = await navigate('/login');
    expect(response!.status).toBe(status);
    expect(await response!.text()).toBe('original');
  });

  test('keeps redirects, downloads, payloads and slow pages without the shell deadline', async () => {
    const download = new Response('download', { headers: { 'Content-Disposition': 'attachment; filename=report.csv' } });
    const opaque = new Response(null);
    Object.defineProperty(opaque, 'type', { value: 'opaqueredirect' });
    const flight = new Response('flight payload', { headers: { 'Content-Type': 'text/x-component' } });
    for (const original of [download, opaque, flight]) {
      const navigate = await worker({ config, network: async () => original });
      expect(await navigate('/reports/export')).toBe(original);
    }
    let aborted = false;
    const slow = await worker({ config, network: async (_, init) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; });
      await Bun.sleep(30);
      return new Response('late unlisted page');
    } });
    expect(await (await slow('/welcome'))!.text()).toBe('late unlisted page');
    expect(aborted).toBe(false);
  });

  const languages: NajmOfflineDocumentText[] = [
    { language: 'fr', title: 'MyScolAI est hors ligne', description: 'Reconnectez-vous, puis réessayez.', retryLabel: 'Réessayer' },
    { language: 'ar', direction: 'rtl', title: 'MyScolAI غير متصل', description: 'أعد الاتصال، ثم حاول مجددًا.', retryLabel: 'إعادة المحاولة' },
    { language: 'en', title: 'MyScolAI is offline', description: 'Reconnect, then <try> again & again.', retryLabel: 'Try again' },
  ];
  const stacked: NajmServiceWorkerOptions = { ...config, offlineDocument: { languages } };
  const order = (html: string) => [...html.matchAll(/<section lang="([^"]+)" dir="([^"]+)"><h([12])>/g)].map(match => match.slice(1).join(' '));

  test('stacks every language, leading with the one the app last recorded', async () => {
    const database = new IDBFactory();
    const navigate = await worker({ config: stacked, network: offline, database });
    const page = async () => (await navigate('/welcome'))!.text();
    let html = await page();
    expect(html).toContain('<html lang="fr" dir="auto">');
    expect(order(html)).toEqual(['fr auto 1', 'ar rtl 2', 'en auto 2']);
    expect(html).toContain('Reconnect, then &lt;try&gt; again &amp; again.');
    // Taller than a small screen, the stack keeps clear of its edges; one notice is unchanged.
    expect(html).toContain('main{padding:2rem 0}');
    expect(await (await (await worker({ config, network: offline }))('/welcome'))!.text()).not.toContain('main{padding');
    expect(await rememberNajmOfflineLanguage({ cacheId: 'app', language: 'ar', indexedDB: database })).toBe(true);
    html = await page();
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('<title>MyScolAI غير متصل</title>');
    expect(order(html)).toEqual(['ar rtl 1', 'fr auto 2', 'en auto 2']);
    // A region tag matches its language; a language without a text, or another app's record, keeps the order.
    await rememberNajmOfflineLanguage({ cacheId: 'app', language: 'en-GB', indexedDB: database });
    expect(order(await page())).toEqual(['en auto 1', 'fr auto 2', 'ar rtl 2']);
    await rememberNajmOfflineLanguage({ cacheId: 'app', language: 'es', indexedDB: database });
    expect(order(await page())).toEqual(['fr auto 1', 'ar rtl 2', 'en auto 2']);
    await rememberNajmOfflineLanguage({ cacheId: 'other-app', language: 'ar', indexedDB: database });
    expect(order(await page())).toEqual(['fr auto 1', 'ar rtl 2', 'en auto 2']);
    // Without IndexedDB the document still answers, in the configured order.
    const unavailable = await worker({ config: stacked, network: offline });
    expect(order(await (await unavailable('/welcome'))!.text())).toEqual(['fr auto 1', 'ar rtl 2', 'en auto 2']);
  });

  test('rejects ambiguous or invalid stacked languages', () => {
    const build = (offlineDocument: NajmOfflineDocumentOptions) => () => createNajmServiceWorker({ ...config, offlineDocument });
    expect(build({ languages, title: 'Offline' })).toThrow('offlineDocument.languages replaces offlineDocument.title');
    expect(build({ languages, direction: 'rtl' })).toThrow('replaces offlineDocument.direction');
    expect(build({ languages: [] })).toThrow('non-empty array');
    expect(build({ languages: [{ ...languages[0]!, language: 'fr_FR' }] })).toThrow('languages[0].language must be a valid language tag');
    expect(build({ languages: [languages[0]!, { ...languages[2]!, language: 'FR' }] })).toThrow('languages[1].language repeats FR');
    expect(build({ languages: [{ ...languages[0]!, title: ' ' }] })).toThrow('languages[0].title must be a non-empty string');
    expect(build({ languages: [{ ...languages[0]!, direction: 'up' as never }] })).toThrow("must be 'ltr', 'rtl' or 'auto'");
    expect(build({ direction: '"><script>' as never })).toThrow("offlineDocument.direction must be 'ltr', 'rtl' or 'auto'");
  });

  test('keeps API, framework, payload, write and external requests out', async () => {
    const navigate = await worker({ config, network: offline });
    for (const path of ['/api', '/api/auth/session', '/_next/static/app.js', '/welcome?_rsc=payload']) expect(navigate(path)).toBeUndefined();
    for (const headers of [{ RSC: '1' }, { 'Next-Router-State-Tree': 'tree' }, { 'Next-Router-Prefetch': '1' }, { Accept: 'text/x-component' }]) {
      expect(navigate('/welcome', { headers: new Headers(headers) })).toBeUndefined();
    }
    for (const overrides of [{ mode: 'cors' }, { mode: 'no-cors' }, { method: 'POST' }, { url: 'https://external.example/welcome' }]) {
      expect(navigate('/welcome', overrides)).toBeUndefined();
    }
  });

  test('preserves caller cancellation', async () => {
    const caller = new AbortController();
    const navigate = await worker({ config, network: async () => new Promise((_, reject) => {
      caller.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    }) });
    const response = navigate('/welcome', { signal: caller.signal });
    caller.abort();
    await expect(response).rejects.toThrow('Cancelled');
  });
});
