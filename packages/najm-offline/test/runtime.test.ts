import { afterAll, afterEach, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { canonicalJson, sha256, type ReplicaRecord } from 'najm-database/sync/contracts';
import { OFFLINE_PROTOCOL, OFFLINE_SCHEMA } from '../src/index';
import { OFFLINE_DURATION_MS, OFFLINE_SHARED_YEAR, offlineWriteAffectsReads, projectionId,
  type OfflineGrant } from './support/app';
import type { ShellBootstrap } from './support/app';
import { installBrowserGlobals, until } from './support/browserGlobals';

const browser = installBrowserGlobals();
const app = await import('./support/app');
const { createOfflineClient } = await import('../src/client/runtime');
const auth = app.createAppAuth();
const offline = createOfflineClient<ShellBootstrap>({ namespace: app.NAMESPACE, auth, route: app.offlineRoute,
  writeAffectsReads: offlineWriteAffectsReads, queryRoots: ['students', 'classes', 'publicSettings', 'academic-years', 'student-enrollments'],
  languageHeader: app.LANGUAGE_HEADER, yearHeader: app.YEAR_HEADER });
// The names an app's own runtime module gives these.
const runtime = { connectOfflineRuntime: offline.connect, lockOffline: offline.lockOffline, invalidateOfflineReads: offline.invalidateReads,
  onlineMutationComplete: offline.mutationComplete, renewOffline: offline.renewOffline, lockRefusedSession: offline.lockRefusedSession };
const { selectedReplica } = offline.selection;
const POINTER = 'app.offline-account.v1';

// The real client, with a signed-in user and the offline grant endpoint stubbed.
const client = auth.client as unknown as Record<string, unknown>;
const api = auth.api as unknown as Record<string, unknown>;
let user: { id: string; role: string } | null = { id: 'admin-1', role: 'admin' };
let grants = 0;
/** When a test sets it, the server grants the shared scope and serves its one page. */
let server: { up: boolean; snapshots: number; page?: ReplicaRecord[] } | null = null;
const unavailable = () => Object.assign(new Error('Service unavailable'), { status: 503 });
client.getState = () => ({ user, isAuthenticated: !!user, isLoading: false });
client.can = () => true;
client.refresh = async () => {};
api.post = async (path: string, options?: { body: Record<string, string> }) => {
  if (path === '/offline/grant') grants++;
  if (!server?.up) throw unavailable();
  const body = options!.body;
  if (path === '/offline/grant') {
    const issuedAt = Date.now() + grants;
    return { installationId: body.installationId, installationEpoch: body.installationEpoch, protocol: OFFLINE_PROTOCOL, schema: OFFLINE_SCHEMA,
      accountId: 'admin-1', authorizationGeneration: 'generation', issuedAt, validUntil: issuedAt + OFFLINE_DURATION_MS,
      scopes: [{ id: 'shared', academicYear: OFFLINE_SHARED_YEAR, capabilities: ['read:students'] }],
      account: { id: 'admin-1', name: 'Admin', email: null, image: null, role: 'admin' },
      permissions: ['read:offline', 'read:students'], activeYear: '2026-2027' } satisfies OfflineGrant;
  }
  const generation = String(++server.snapshots);
  server.page = [{ entity: 'projection', id: projectionId('en', '/settings/public'), revision: generation, deleted: false,
    value: { path: '/settings/public', language: 'en', downloadedAt: Date.now(), body: { data: {} } } }];
  return { generation, cursor: generation, expiresAt: Date.now() + 60_000, recordCount: 1, pageChecksums: [await sha256(canonicalJson(server.page))],
    context: { installationId: body.installationId, installationEpoch: body.installationEpoch, accountId: 'admin-1',
      authorizationGeneration: body.authorizationGeneration, replicaSchemaVersion: 1, scope: { kind: 'shared' } } };
};
api.get = async () => { if (!server?.up) throw unavailable(); return server.page; };
afterAll(() => {
  for (const name of ['getState', 'can', 'refresh']) delete client[name];
  delete api.post; delete api.get;
  browser.uninstall();
});

const bootstrap = (): ShellBootstrap => ({ version: 1, accountId: user!.id, role: user!.role, routes: [], expiresAt: Date.now() + 60_000,
  academicYear: '2026-2027', ui: { app: { appName: 'MyScolAI' }, preferences: { language: 'en', theme: 'light', timeZone: 'Africa/Casablanca' },
    appearance: { designConfig: {} }, branding: {} } } as ShellBootstrap);
const pointer = () => JSON.parse(browser.localStorage.getItem(POINTER) ?? 'null');
let disconnect: (() => void) | undefined;
afterEach(() => { disconnect?.(); disconnect = undefined; user = { id: 'admin-1', role: 'admin' }; });

async function connected(source: () => ShellBootstrap | null = () => null) {
  const queries = new QueryClient();
  queries.setQueryData(['fees'], ['server fee']);
  queries.setQueryData(['students', 'scope', 'year', '2026-2027'], ['server student']);
  disconnect = runtime.connectOfflineRuntime(queries, source);
  await until(() => pointer()?.accountId === user!.id);
  await new Promise(resolve => setTimeout(resolve, 50));
  return queries;
}

test("the first account a page resolves keeps the data the page already fetched", async () => {
  const queries = await connected();
  expect(queries.getQueryData<string[]>(['fees'])).toEqual(['server fee']);
  expect(queries.getQueryState(['students', 'scope', 'year', '2026-2027'])?.status).toBe('success');
});

test("another tab's edit leaves this tab's data; another tab's account clears it", async () => {
  const queries = await connected();
  const before = browser.localStorage.getItem(POINTER);
  const fenced = JSON.stringify({ ...pointer(), fence: crypto.randomUUID() });
  browser.localStorage.setItem(POINTER, fenced);
  browser.storageEvent(POINTER, before, fenced);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(queries.getQueryData<string[]>(['fees'])).toEqual(['server fee']);
  const switched = JSON.stringify({ ...pointer(), accountId: 'parent-9', fence: crypto.randomUUID() });
  browser.localStorage.setItem(POINTER, switched);
  browser.storageEvent(POINTER, fenced, switched);
  await until(() => queries.getQueryData(['fees']) === undefined);
});

test('losing offline access leaves the server results an online page displays', async () => {
  const queries = await connected();
  await runtime.lockOffline();
  expect(queries.getQueryData<string[]>(['fees'])).toEqual(['server fee']);
  expect(queries.getQueryState(['students', 'scope', 'year', '2026-2027'])?.status).toBe('success');
});

test('only writes that change downloaded data fence retained copies', async () => {
  await connected();
  const before = browser.localStorage.getItem(POINTER);
  for (const path of ['/attendance/students', '/grades/1', '/payments', '/chat/messages', '/search', '/staff-roles/2']) {
    await runtime.invalidateOfflineReads(path);
  }
  expect(browser.localStorage.getItem(POINTER)).toBe(before);
  await runtime.invalidateOfflineReads('/students/abc');
  expect(pointer().fence).not.toBe(JSON.parse(before!).fence);
  expect(pointer().accountId).toBe('admin-1');
  for (const path of ['/students', '/students/1/parents', '/parents?x=1', '/student-enrollments/3', '/classes', '/sections/2',
    '/settings', '/academic-years/1', '/staff/4', '/admin/access/users/5']) expect(offlineWriteAffectsReads(path)).toBe(true);
  for (const path of ['/auth/login', '/attendance', '/fees/1', '/studentsx', '/staff-roles', '/notifications']) expect(offlineWriteAffectsReads(path)).toBe(false);
});

test('a burst of edits schedules one replacement; other writes schedule none', async () => {
  await connected(bootstrap);
  await until(() => grants > 0);
  grants = 0;
  for (let save = 0; save < 5; save++) runtime.onlineMutationComplete('/students/' + save);
  for (let save = 0; save < 3; save++) runtime.onlineMutationComplete('/attendance/' + save);
  await new Promise(resolve => setTimeout(resolve, 3500));
  expect(grants).toBe(1);
}, 10_000);

test('a renewal after a failed one downloads, without an online event', async () => {
  server = { up: true, snapshots: 0 };
  try {
    await connected(bootstrap);
    await until(() => server!.snapshots === 1);
    const settle = () => new Promise(resolve => setTimeout(resolve, 100));
    await settle();
    // A copy downloaded recently in this language is kept.
    await runtime.renewOffline(); await settle();
    expect(server.snapshots).toBe(1);
    server.up = false;
    await runtime.renewOffline(); await settle();
    server.up = true;
    await runtime.renewOffline();
    await until(() => server!.snapshots === 2);
  } finally { server = null; }
});

test('a session the server refuses locks retained copies; one it could not reach does not', async () => {
  server = { up: true, snapshots: 0 };
  try {
    await connected(bootstrap);
    const status = async () => (await (await selectedReplica())!.storage.access.refresh()).status;
    await until(async () => await status() === 'available');
    // The client emits it when it gives up refreshing; the test stands in for that.
    const expire = (event: object) => (auth.client as unknown as { emit(name: string, data: object): void }).emit('sessionExpired', event);
    expire({ reason: 'unavailable' });
    expire({ reason: 'rate-limited', status: 429 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(await status()).toBe('available');
    expire({ reason: 'refused', status: 401 });
    await until(async () => await status() === 'locked');
  } finally { server = null; }
});

test('the sign-in redirect can wait for a refused session to be locked, once for every listener', async () => {
  server = { up: true, snapshots: 0 };
  try {
    await connected(bootstrap);
    const status = async () => (await (await selectedReplica())!.storage.access.refresh()).status;
    await until(async () => await status() === 'available');
    await runtime.lockRefusedSession({ reason: 'unavailable' });
    expect(await status()).toBe('available');
    const first = runtime.lockRefusedSession({ reason: 'refused', status: 403 });
    expect(runtime.lockRefusedSession({ reason: 'refused', status: 403 })).toBe(first);
    await first;
    // Settled means committed: nothing is left to finish after the page leaves.
    expect(await status()).toBe('locked');
  } finally { server = null; }
});
