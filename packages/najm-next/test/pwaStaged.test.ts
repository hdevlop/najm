import { expect, test } from 'bun:test';
import { createNajmServiceWorker } from '../src/pwa';

const origin = 'https://app.example';
const scope = origin + '/';
const stores = new Map<string, Map<string, Response>>();
const handlers = new Map<string, (event: any) => void>();
let skipped = 0;
let claimed = 0;
let clients: any[] = [];
const cacheFor = (name: string) => {
  if (!stores.has(name)) stores.set(name, new Map());
  const data = stores.get(name)!;
  return {
    match: async (path: string | Request) => data.get(typeof path === 'string' ? path : new URL(path.url).pathname)?.clone(),
    put: async (path: string, response: Response) => { data.set(path, response.clone()); },
    addAll: async (paths: string[]) => { paths.forEach(path => data.set(path, new Response('public ' + path))); },
  };
};
async function setup() {
  stores.clear(); handlers.clear(); skipped = 0; claimed = 0; clients = [];
  const source = await createNajmServiceWorker({ cacheId: 'test', cacheVersion: 'v2', offlineUrl: '/shell', precache: ['/v2.js'], updatePolicy: 'staged', navigationFallback: { paths: ['/app'] } })().text();
  new Function('self', 'caches', 'fetch', source)({
    registration: { scope }, location: { origin },
    clients: { matchAll: async () => clients, claim: async () => { claimed++; } },
    addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler),
    skipWaiting: async () => { skipped++; },
  }, { open: async (name: string) => cacheFor(name), keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name) }, async () => new Response('network'));
}
function lifecycle(type: string) {
  let work: Promise<unknown> | undefined;
  handlers.get(type)!({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  return work;
}
async function message(type: string, extra = {}) {
  let result: any;
  let work: Promise<unknown> | undefined;
  handlers.get('message')!({ data: { type, protocol: 1, cacheId: 'test', cacheVersion: 'v2', ...extra }, source: { url: origin + '/app' }, ports: [{ postMessage: (value: any) => { result = value; } }], waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  await work;
  return result;
}

test('stages complete assets, never forces initial waiting or deletes old caches', async () => {
  await setup();
  stores.set('other-app', new Map());
  stores.set('najm-pwa:test:v1', new Map());
  await lifecycle('install');
  expect(skipped).toBe(0);
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(true);
  await lifecycle('activate');
  expect(claimed).toBe(1);
  expect(stores.has('other-app')).toBe(true);
  expect(stores.has('najm-pwa:test:v1')).toBe(true);
});

test('will not activate incomplete or evicted assets', async () => {
  await setup();
  expect((await message('NAJM_PWA_ACTIVATE')).activated).toBe(false);
  await lifecycle('install');
  stores.get('najm-pwa:test:v2')!.delete('/v2.js');
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(false);
  expect((await message('NAJM_PWA_ACTIVATE')).reason).toBe('assets-unavailable');
  expect(skipped).toBe(0);
});

test('requires each in-scope client consent and preserves dirty clients', async () => {
  await setup(); await lifecycle('install');
  const client = (ready: boolean) => ({ url: origin + '/app', postMessage: (_: any, ports: MessagePort[]) => { ports[0].postMessage({ protocol: 1, ready }); ports[0].close(); } });
  clients = [client(true), client(false)];
  expect((await message('NAJM_PWA_ACTIVATE')).activated).toBe(false);
  clients = [client(true), client(true)];
  expect((await message('NAJM_PWA_ACTIVATE')).activated).toBe(true);
  expect(skipped).toBe(1);
});

test('rejects cache-version reuse for changed manifests', async () => {
  await setup();
  await cacheFor('najm-pwa:test:v2').put(scope + '.najm-pwa-manifest/test', Response.json({ version: 'v2', paths: ['/different'] }));
  await expect(lifecycle('install')).rejects.toThrow('cacheVersion');
  expect(skipped).toBe(0);
});

test('rejects mutable asset URLs shared by different builds', async () => {
  await setup();
  const old = cacheFor('najm-pwa:test:v1');
  await old.put(scope + '.najm-pwa-manifest/test', Response.json({ version: 'v1', paths: ['/v2.js'] }));
  await old.put('/v2.js', new Response('different bytes'));
  await expect(lifecycle('install')).rejects.toThrow('immutable URLs');
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(false);
});

test('a changed same-version response never overwrites an active cache', async () => {
  await setup();
  await lifecycle('install');
  await cacheFor('najm-pwa:test:v2').put('/shell', new Response('old active entry'));
  await expect(lifecycle('install')).rejects.toThrow('immutable URLs');
  expect(await (await cacheFor('najm-pwa:test:v2').match('/shell'))!.text()).toBe('old active entry');
  expect([...stores.keys()].some(name => name.includes(':install:'))).toBe(false);
});

test('requires explicit build version and shell for staged mode', () => {
  expect(() => createNajmServiceWorker({ updatePolicy: 'staged' })).toThrow('explicit cacheVersion');
  expect(() => createNajmServiceWorker({ updatePolicy: 'staged', offlineUrl: '/shell' })).toThrow('explicit cacheVersion');
});
