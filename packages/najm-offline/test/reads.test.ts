import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { canonicalJson, sha256, type SyncContext, type ReplicaRecord } from 'najm-database/sync/contracts';
import { OFFLINE_DURATION_MS, offlineRoute, projectionId, type OfflineGrant } from './support/app';
import { openAppReplica, retireUnboundScopes, type AppReplica } from './support/app';
import { createLocalDispatcher, type ReadContext } from './support/app';
import type { ShellBootstrap } from './support/app';

const databases: AppReplica[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.replica.close(); });
const installationId = 'installation';
const scope = (year = '2026-2027', accountId = 'account'): SyncContext => ({ installationId, installationEpoch: 'epoch',
  accountId, authorizationGeneration: 'generation', replicaSchemaVersion: 1, scope: { kind: 'year', yearLabel: year } });

async function setup(selectionFence?: () => string | null) {
  let time = 100_000;
  const factory = new IDBFactory();
  const storage = await openAppReplica({ installationId, accountId: 'account' }, factory, () => time, selectionFence);
  databases.push(storage);
  const enroll = async () => storage.access.enroll(await storage.access.capture(), {
    accountId: 'account', installationId, installationEpoch: 'epoch', authorizationGeneration: 'generation',
    issuedAt: time, validUntil: time + OFFLINE_DURATION_MS, scopes: ['2025-2026', '2026-2027'].map(year => ({
      id: 'year:' + year, academicYear: year, capabilities: ['read:students'] })),
    mode: 'automatic-read', online: { authenticated: true, accountId: 'account', permissions: ['read:offline', 'read:students'] },
  });
  await enroll();
  const context: ReadContext = { accountId: 'account', year: '2026-2027', language: 'fr', pointer: 'account-fence', epoch: 1 };
  let active = context;
  let locks = 0;
  let recoveries = 0;
  let served = 0;
  const dispatcher = createLocalDispatcher({ capture: () => active,
    isCurrent: captured => captured.accountId === active.accountId && captured.pointer === active.pointer && captured.epoch === active.epoch,
    isOnlineCurrent: captured => captured.accountId === active.accountId && captured.accountEpoch === active.accountEpoch,
    served: () => { served++; },
    storage: async () => storage, lock: async () => { locks++; await storage.access.lock(await storage.access.capture(), 'authorization-revoked'); },
    recover: () => { recoveries++; },
  }, () => time);
  return { storage, context, dispatcher, factory, enroll, time: () => time, advance: (ms: number) => { time += ms; },
    change: (value: ReadContext) => { active = value; }, locks: () => locks, recoveries: () => recoveries, served: () => served };
}
async function snapshot(storage: AppReplica, context: SyncContext, body: unknown, generation: string) {
  const ticket = await storage.replica.beginSnapshot(context);
  const records: ReplicaRecord[] = [{ entity: 'projection', id: projectionId('fr', '/students'), revision: generation, deleted: false,
    value: { path: '/students', language: 'fr', downloadedAt: 100_000, body } }];
  const manifest = { generation, context, cursor: generation, expiresAt: 99_000_000,
    recordCount: records.length, pageChecksums: [await sha256(canonicalJson(records))] };
  await storage.replica.stageSnapshotPage(ticket, manifest, 0, records);
  await storage.replica.activateSnapshot(ticket, manifest);
  return { records, manifest };
}

describe('Private reads through the package replica', () => {
  test('preserves the HTTP wrapper and exact language/year coverage, including a real empty list', async () => {
    const f = await setup();
    const body = { status: 'success', message: 'Élèves récupérés', data: [{ id: 'one', name: 'ريم' }] };
    await snapshot(f.storage, scope(), body, '1');
    expect(await f.dispatcher.local('/students', f.context)).toEqual({ data: body });
    await expect(f.dispatcher.local('/students', { ...f.context, language: 'ar' })).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    await expect(f.dispatcher.local('/students', { ...f.context, year: '2025-2026' })).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    await expect(f.dispatcher.local('/students/missing', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    await snapshot(f.storage, scope('2025-2026'), { ...body, data: [] }, '2');
    expect((await f.dispatcher.local('/students', { ...f.context, year: '2025-2026' })).data).toEqual({ ...body, data: [] });
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual(body);
  });

  test('interrupted/bad replacements retain the previous complete generation; deletion needs activation', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: [{ id: 'old' }] }, '1');
    const ticket = await f.storage.replica.beginSnapshot(scope());
    const records: ReplicaRecord[] = [{ entity: 'projection', id: projectionId('fr', '/students'), revision: '2', deleted: false,
      value: { path: '/students', language: 'fr', downloadedAt: 100_000, body: { data: [] } } }];
    const manifest = { generation: '2', context: scope(), cursor: '2', expiresAt: 99_000_000, recordCount: 1,
      pageChecksums: [await sha256(canonicalJson(records))] };
    await expect(f.storage.replica.activateSnapshot(ticket, manifest)).rejects.toHaveProperty('code', 'COVERAGE_INCOMPLETE');
    await expect(f.storage.replica.stageSnapshotPage(ticket, manifest, 0, [])).rejects.toHaveProperty('code', 'SNAPSHOT_CHECKSUM');
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: [{ id: 'old' }] });
    await f.storage.replica.stageSnapshotPage(ticket, manifest, 0, records);
    await f.storage.replica.activateSnapshot(ticket, manifest);
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: [] });
  });

  test('eight-hour access renews from successful server authorization, survives reopen, then expires without deleting records', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: [{ id: 'one' }] }, '1');
    f.advance(7 * 60 * 60 * 1000);
    await f.enroll();
    f.advance(2 * 60 * 60 * 1000);
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: [{ id: 'one' }] });
    const reopened = await openAppReplica({ installationId, accountId: 'account' }, f.factory, f.time);
    databases.push(reopened);
    expect((await reopened.access.refresh()).status).toBe('available');
    f.advance(6 * 60 * 60 * 1000);
    await expect(f.dispatcher.local('/students', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    expect(await reopened.replica.database.getAll('records')).toHaveLength(1);
  });

  test('a quota failure during replacement activation rolls back the entire scope', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: [{ id: 'retained' }] }, '1');
    const ticket = await f.storage.replica.beginSnapshot(scope());
    const records: ReplicaRecord[] = [{ entity: 'projection', id: projectionId('fr', '/students'), revision: '2', deleted: false,
      value: { path: '/students', language: 'fr', downloadedAt: 100_000, body: { data: [] } } }];
    const manifest = { generation: '2', context: scope(), cursor: '2', expiresAt: 99_000_000, recordCount: 1,
      pageChecksums: [await sha256(canonicalJson(records))] };
    await f.storage.replica.stageSnapshotPage(ticket, manifest, 0, records);
    const database = f.storage.replica.database;
    const transaction = database.transaction.bind(database);
    const failure = spyOn(database, 'transaction').mockImplementation((stores, work, options) => transaction(stores, async tx => {
      const result = await work(tx);
      if (options?.tags?.includes('sync:ready')) throw new DOMException('Device storage is full', 'QuotaExceededError');
      return result;
    }, options));
    try {
      await expect(f.storage.replica.activateSnapshot(ticket, manifest)).rejects.toHaveProperty('kind', 'quota');
    } finally { failure.mockRestore(); }
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: [{ id: 'retained' }] });
    await f.storage.replica.activateSnapshot(ticket, manifest);
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: [] });
  });

  test('clock rollback and denied capabilities fail closed inside storage transactions', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: [] }, '1');
    await expect(f.dispatcher.local('/classes', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    f.advance(-2000);
    await expect(f.dispatcher.local('/students', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    expect((await f.storage.access.refresh()).reason).toBe('clock-rollback');
  });

  test('a changed selection fence denies old coverage through quota failure and reopen until retirement and replacement', async () => {
    let fence = 'before-save';
    const f = await setup(() => fence);
    await snapshot(f.storage, scope(), { data: ['before-save'] }, '1');
    fence = 'after-save';
    const reopened = await openAppReplica({ installationId, accountId: 'account' }, f.factory, f.time, () => fence);
    databases.push(reopened);
    await expect(f.dispatcher.local('/students', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    const failed = spyOn(reopened.replica, 'lock').mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
    try { await expect(retireUnboundScopes(reopened, fence)).rejects.toHaveProperty('name', 'QuotaExceededError'); }
    finally { failed.mockRestore(); }
    await expect(reopened.replica.capture(scope())).rejects.toHaveProperty('code', 'OFFLINE_ACCESS_REVOKED');
    expect((await reopened.store.read())?.selectionFence).toBe('before-save');
    expect(await retireUnboundScopes(reopened, fence)).toBe(true);
    f.advance(1000);
    await f.enroll();
    expect((await reopened.store.read())?.selectionFence).toBe('after-save');
    await expect(f.dispatcher.local('/students', f.context)).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    await snapshot(f.storage, scope(), { data: ['after-save'] }, '2');
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: ['after-save'] });
  });

  test('CAS prevents a late grant from unlocking logout across two owners', async () => {
    const f = await setup();
    const late = await f.storage.access.capture();
    const peer = await openAppReplica({ installationId, accountId: 'account' }, f.factory, f.time);
    databases.push(peer);
    await peer.access.lock(await peer.access.capture(), 'logout');
    f.advance(1000);
    const policy = (await f.storage.store.read())!.entitlement!;
    expect((await f.storage.access.enroll(late, { ...policy, issuedAt: f.time(), validUntil: f.time() + OFFLINE_DURATION_MS,
      mode: 'automatic-read', online: { authenticated: true, accountId: 'account', permissions: ['read:offline', 'read:students'] } })).applied).toBe(false);
    expect((await f.storage.access.refresh()).reason).toBe('logout');
  });

  test('a late server grant cannot bind itself to a newer selection fence', async () => {
    let selected = 'request-start';
    const f = await setup(() => selected === 'request-start' ? selected : null);
    const token = await f.storage.access.capture();
    const previous = (await f.storage.store.read())!;
    selected = 'after-account-boundary';
    f.advance(1000);
    await expect(f.storage.access.enroll(token, { ...previous.entitlement!, issuedAt: f.time(), validUntil: f.time() + OFFLINE_DURATION_MS,
      mode: 'automatic-read', online: { authenticated: true, accountId: 'account', permissions: ['read:offline', 'read:students'] } })).rejects.toThrow();
    expect((await f.storage.store.read())?.selectionFence).toBe('request-start');
    expect((await f.storage.store.read())?.entitlement?.issuedAt).toBe(previous.entitlement!.issuedAt);
  });

  test('renewal commits access and display together, retaining both prior values when the transaction aborts', async () => {
    const f = await setup(() => 'selected');
    const makeGrant = (): OfflineGrant => ({ accountId: 'account', installationId, installationEpoch: 'epoch', authorizationGeneration: 'generation',
      protocol: 1, schema: 1, issuedAt: f.time(), validUntil: f.time() + OFFLINE_DURATION_MS,
      scopes: [{ id: 'year:2026-2027', academicYear: '2026-2027', capabilities: ['read:students'] }],
      account: { id: 'account', name: 'Meryem', email: null, image: null, role: 'parent' },
      permissions: ['read:students', 'read:offline'], activeYear: '2026-2027' });
    const bootstrap: ShellBootstrap = { version: 1, accountId: 'account', expiresAt: f.time() + OFFLINE_DURATION_MS,
      routes: [{ href: '/students', label: 'Students' }], ui: { preferences: { language: 'en', theme: 'light', timeZone: 'Africa/Casablanca' }, branding: { slots: {}, revision: 1 }, appearance: { designConfig: { version: 1, theme: { mode: 'light', accent: 'neutral' } } } } };
    f.advance(1000);
    const first = makeGrant();
    expect((await f.storage.enrollPresentation(await f.storage.access.capture(), first, bootstrap)).applied).toBe(true);
    expect((await f.storage.replica.database.get('metadata', 'presentation') as { grant: OfflineGrant }).grant.issuedAt).toBe(first.issuedAt);
    f.advance(1000);
    const token = await f.storage.access.capture();
    const next = makeGrant();
    const database = f.storage.replica.database;
    const transaction = database.transaction.bind(database);
    const failure = spyOn(database, 'transaction').mockImplementation((stores, work, options) => transaction(stores, async tx => {
      const result = await work(tx);
      if (options?.tags?.includes('app:access')) throw new DOMException('Full', 'QuotaExceededError');
      return result;
    }, options));
    try { await expect(f.storage.enrollPresentation(token, next, bootstrap)).rejects.toHaveProperty('kind', 'quota'); }
    finally { failure.mockRestore(); }
    expect((await f.storage.store.read())?.entitlement?.issuedAt).toBe(first.issuedAt);
    expect((await f.storage.replica.database.get('metadata', 'presentation') as { grant: OfflineGrant }).grant.issuedAt).toBe(first.issuedAt);
    expect((await f.storage.enrollPresentation(await f.storage.access.capture(), next, bootstrap)).applied).toBe(true);
    expect((await f.storage.store.read())?.entitlement?.issuedAt).toBe(next.issuedAt);
    expect((await f.storage.replica.database.get('metadata', 'presentation') as { grant: OfflineGrant }).grant.issuedAt).toBe(next.issuedAt);
  });

  test('online success stays fresh; only connection failure falls back; known outage skips transport', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: ['old'] }, '1');
    expect(await f.dispatcher.get('/students', f.context, async () => ({ data: { data: ['fresh'] } }))).toEqual({ data: { data: ['fresh'] } });
    let requests = 0;
    const offline = async () => { requests++; throw new TypeError('Failed to fetch'); };
    expect(await f.dispatcher.get('/students', f.context, offline)).toEqual({ data: { data: ['old'] } });
    expect(await f.dispatcher.get('/students', f.context, offline)).toEqual({ data: { data: ['old'] } });
    expect(requests).toBe(1);
  });

  test('HTTP errors, caller aborts, timeouts and programming errors never become cached success', async () => {
    for (const error of [Object.assign(new Error('refused'), { status: 401 }), Object.assign(new Error('refused'), { status: 403 }),
      Object.assign(new Error('not found'), { status: 404 }), Object.assign(new Error('bad'), { status: 422 }),
      Object.assign(new Error('server'), { status: 503 }), new DOMException('cancelled', 'AbortError'),
      new DOMException('slow', 'TimeoutError'), new TypeError('Cannot read properties of null')]) {
      const f = await setup();
      await snapshot(f.storage, scope(), { data: [] }, '1');
      await expect(f.dispatcher.get('/students', f.context, async () => { throw error; })).rejects.toBe(error);
      expect(f.dispatcher.knownOutage()).toBe(false);
      expect(f.locks()).toBe([401, 403].includes((error as { status?: number }).status ?? 0) ? 1 : 0);
    }
  });

  test('a slow response stays pending and a late account result is discarded', async () => {
    const f = await setup();
    let resolve!: (value: { data: unknown }) => void;
    const pending = f.dispatcher.get('/students', f.context, () => new Promise(done => { resolve = done; }));
    let settled = false;
    void pending.then(() => { settled = true; }).catch(() => undefined);
    await new Promise(done => setTimeout(done, 10));
    expect(settled).toBe(false);
    f.change({ ...f.context, accountId: 'another', epoch: 2 });
    resolve({ data: ['private previous account'] });
    await expect(pending).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    expect(f.dispatcher.knownOutage()).toBe(false);
  });

  test('a server response survives an edit fence or offline lock; only another account discards it', async () => {
    const f = await setup();
    let resolve!: (value: { data: unknown }) => void;
    const pending = f.dispatcher.get('/students', f.context, () => new Promise(done => { resolve = done; }));
    await new Promise(done => setTimeout(done, 10));
    // A save or a lock moves the selection fence and the local-read epoch.
    f.change({ ...f.context, pointer: 'fence-after-edit', epoch: 7 });
    resolve({ data: ['fresh from the server'] });
    expect(await pending).toEqual({ data: ['fresh from the server'] });
    const later = f.dispatcher.get('/students', f.context, () => new Promise(done => { resolve = done; }));
    await new Promise(done => setTimeout(done, 10));
    f.change({ ...f.context, accountEpoch: 1 });
    resolve({ data: ['previous session'] });
    await expect(later).rejects.toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
  });

  test('each read a retained copy answers is reported, and no server response is', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: ['retained'] }, '1');
    await f.dispatcher.get('/students', f.context, async () => ({ data: { data: ['server'] } }));
    expect(f.served()).toBe(0);
    await f.dispatcher.get('/students', f.context, async () => { throw new TypeError('Failed to fetch'); });
    await f.dispatcher.local('/students', f.context);
    expect(f.served()).toBe(2);
  });

  test('an optional capability that was never granted stays refused without revoking the authorized Students slice', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: ['authorized child'] }, '1');
    const forbidden = Object.assign(new Error('Classes were never granted'), { status: 403 });
    await expect(f.dispatcher.get('/classes', f.context, async () => { throw forbidden; })).rejects.toBe(forbidden);
    expect(f.locks()).toBe(0);
    expect(f.dispatcher.knownOutage()).toBe(false);
    expect((await f.dispatcher.local('/students', f.context)).data).toEqual({ data: ['authorized child'] });
  });

  test('an HTTP recovery probe ends outage mode so subsequent server errors cannot become cached success', async () => {
    const f = await setup();
    await snapshot(f.storage, scope(), { data: ['cached'] }, '1');
    await f.dispatcher.get('/students', f.context, async () => { throw new TypeError('Failed to fetch'); });
    f.advance(1000);
    const failure = Object.assign(new Error('Server unavailable'), { status: 503 });
    await f.dispatcher.get('/students', f.context, async () => { throw failure; });
    expect(f.dispatcher.knownOutage()).toBe(false);
    expect(f.recoveries()).toBe(1);
    await expect(f.dispatcher.get('/students', f.context, async () => { throw failure; })).rejects.toBe(failure);
  });

  test('only enumerated exact routes can read offline', () => {
    for (const path of ['/students?onDate=2026-01-01', '/students/count', '/students/my-identity', '/students/one/fees',
      '/fees', '/alerts', '/auth/session', '//external/students', 'https://external/students', '/students/a%2Fb']) expect(offlineRoute(path)).toBeNull();
    expect(offlineRoute('/students/one/parents')?.capability).toBe('read:students');
  });
});
