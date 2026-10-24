import { afterEach, expect, test, setSystemTime } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { createNajmServiceWorker, type NajmServiceWorkerOptions } from '../src/pwa';

const origin = 'https://app.example';
const scope = origin + '/';
const stores = new Map<string, Map<string, Response>>();
const handlers = new Map<string, (event: any) => void>();
let skipped = 0;
let claimed = 0;
let clients: any[] = [];
let downloads = 0;
let download: () => Promise<void> = async () => {};
let database = new IDBFactory();
const cacheFor = (name: string) => {
  if (!stores.has(name)) stores.set(name, new Map());
  const data = stores.get(name)!;
  return {
    match: async (path: string | Request) => data.get(typeof path === 'string' ? path : new URL(path.url).pathname)?.clone(),
    put: async (path: string, response: Response) => { data.set(path, response.clone()); },
    addAll: async (paths: string[]) => { downloads++; await download(); paths.forEach(path => data.set(path, new Response('public ' + path))); },
  };
};
async function setup(extra: Partial<NajmServiceWorkerOptions> = {}) {
  stores.clear(); skipped = 0; claimed = 0; clients = []; downloads = 0; download = async () => {}; database = new IDBFactory();
  await load(extra);
}
// Another worker generation over the same origin storage, as after a new
// browser update check or a killed install.
async function load(extra: Partial<NajmServiceWorkerOptions> = {}) {
  handlers.clear();
  const source = await createNajmServiceWorker({ cacheId: 'test', cacheVersion: 'v2', offlineUrl: '/shell', precache: ['/v2.js'], updatePolicy: 'staged', navigationFallback: { paths: ['/app'] }, ...extra })().text();
  new Function('self', 'caches', 'fetch', 'indexedDB', source)({
    registration: { scope }, location: { origin },
    clients: { matchAll: async () => clients, claim: async () => { claimed++; } },
    addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler),
    skipWaiting: async () => { skipped++; },
  }, { open: async (name: string) => cacheFor(name), keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name) }, async () => new Response('network'), database);
}
// Read the budget database as another page or worker on the origin would.
function budgetRecords(): Promise<Record<string, { attempts: number[] }>> {
  return new Promise((resolve, reject) => {
    const open = database.open('najm-pwa-install-budget:test', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('attempts');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const store = open.result.transaction('attempts').objectStore('attempts');
      const records: Record<string, { attempts: number[] }> = {};
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        if (!cursor.result) { open.result.close(); resolve(records); return; }
        records[String(cursor.result.key)] = cursor.result.value;
        cursor.result.continue();
      };
      cursor.onerror = () => reject(cursor.error);
    };
  });
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

afterEach(() => { setSystemTime(); });
const budget = { attempts: 2, windowMs: 60_000 };
const failing = async () => { throw new TypeError('Failed to fetch'); };

test('bounds failed downloads per version and keeps the old generation working', async () => {
  await setup({ installBudget: budget });
  stores.set('najm-pwa:test:v1', new Map([['/v1.js', new Response('old build')]]));
  download = failing;
  for (let attempt = 0; attempt < 2; attempt++) await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  // Later browser update checks and new tabs fail before any asset request.
  for (let check = 0; check < 3; check++) {
    await load({ installBudget: budget });
    await expect(lifecycle('install')).rejects.toThrow('exhausted');
  }
  expect(downloads).toBe(2);
  expect(skipped).toBe(0);
  expect(await (await cacheFor('najm-pwa:test:v1').match('/v1.js'))!.text()).toBe('old build');
  expect([...stores.keys()].some(name => name.includes(':install:'))).toBe(false);
  // Message handling still answers while the version is blocked.
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(false);
  expect((await message('NAJM_PWA_ACTIVATE')).reason).toBe('assets-unavailable');
});

test('reserves an attempt before any asset request', async () => {
  await setup({ installBudget: budget });
  let reservedDuringDownload: unknown;
  download = async () => { reservedDuringDownload = (await budgetRecords()).v2; return new Promise(() => {}); };
  void lifecycle('install');
  await Bun.sleep(5);
  // The install is killed mid-download: its reservation still counts.
  expect((reservedDuringDownload as { attempts: number[] }).attempts).toHaveLength(1);
  await load({ installBudget: budget });
  download = failing;
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  await load({ installBudget: budget });
  await expect(lifecycle('install')).rejects.toThrow('exhausted');
  expect(downloads).toBe(2);
});

test('a new version, the window or a completed install restores attempts', async () => {
  const start = new Date('2026-10-24T08:00:00Z');
  setSystemTime(start);
  await setup({ installBudget: budget });
  download = failing;
  for (let attempt = 0; attempt < 2; attempt++) await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  await expect(lifecycle('install')).rejects.toThrow('exhausted');
  // A new version has its own budget.
  await load({ cacheVersion: 'v3', precache: ['/v3.js'], installBudget: budget });
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  expect(downloads).toBe(3);
  // An attempt expires after the window, one at a time.
  await load({ installBudget: budget });
  setSystemTime(new Date(start.getTime() + 59_999));
  await expect(lifecycle('install')).rejects.toThrow('exhausted');
  setSystemTime(new Date(start.getTime() + 60_001));
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  await expect(lifecycle('install')).rejects.toThrow('exhausted');
  expect(downloads).toBe(5);
  // A clock moved far back does not keep the version blocked.
  setSystemTime(new Date(start.getTime() - 10 * budget.windowMs));
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  // A completed install clears every recorded attempt for this cacheId.
  download = async () => {};
  await lifecycle('install');
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(true);
  expect(await budgetRecords()).toEqual({});
  expect(downloads).toBe(7);
});

test('keeps budget records out of the cache storage and stays opt-in', async () => {
  await setup({ installBudget: budget });
  download = failing;
  await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  expect((await budgetRecords()).v2.attempts).toHaveLength(1);
  expect([...stores.keys()]).toEqual(['najm-pwa:test:v2']);
  await setup();
  download = failing;
  for (let attempt = 0; attempt < 4; attempt++) await expect(lifecycle('install')).rejects.toThrow('Failed to fetch');
  expect(downloads).toBe(4);
  expect(await budgetRecords()).toEqual({});
});

test('refuses to download when the budget cannot be recorded', async () => {
  await setup({ installBudget: budget });
  database = { open: () => { throw new DOMException('Storage denied', 'SecurityError'); } } as never;
  await load({ installBudget: budget });
  await expect(lifecycle('install')).rejects.toThrow('Storage denied');
  expect(downloads).toBe(0);
  expect((await message('NAJM_PWA_STATUS')).ready).toBe(false);
});

test('validates the install budget', () => {
  const staged: NajmServiceWorkerOptions = { cacheVersion: 'v2', offlineUrl: '/shell', updatePolicy: 'staged' };
  expect(() => createNajmServiceWorker({ cacheVersion: 'v2', offlineUrl: '/shell', installBudget: budget })).toThrow("updatePolicy: 'staged'");
  for (const attempts of [0, 21, 1.5, NaN]) expect(() => createNajmServiceWorker({ ...staged, installBudget: { attempts } })).toThrow('installBudget.attempts');
  for (const windowMs of [59_999, 2_592_000_001, 60_000.5, Infinity]) {
    expect(() => createNajmServiceWorker({ ...staged, installBudget: { attempts: 3, windowMs } })).toThrow('installBudget.windowMs');
  }
  expect(() => createNajmServiceWorker({ ...staged, installBudget: null as never })).toThrow('installBudget.attempts');
});
