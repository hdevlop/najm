import { describe, expect, test } from 'bun:test';
import { canonicalJson, sha256, type ReplicaRecord, type SyncContext } from 'najm-database/sync/contracts';
import { createWriteMatcher, offlineEnabled, offlinePath, projectionId } from '../src/index';
import { authorizationGeneration, authorizeActor, buildGrant, createSnapshot, installationDto, pageQuery, readSnapshotPage,
  snapshotDto, splitReadPages, type OfflineActor, type OfflineRefusal, type SnapshotRow, type SnapshotStore } from '../src/server';
import { createOfflineShellWorker } from '../src/worker';

class Refused extends Error { constructor(readonly status: number, readonly reason: OfflineRefusal) { super(reason); } }
const refuse = (status: number, reason: OfflineRefusal): never => { throw new Refused(status, reason); };
const actor: OfflineActor = { id: 'account', name: 'Admin', email: null, image: null, status: 'active', role: 'admin',
  permissions: ['read:classes', 'read:offline', 'read:students'], ownership: 'none' };
const identity = { installationId: crypto.randomUUID(), installationEpoch: crypto.randomUUID() };

function memoryStore() {
  const rows = new Map<string, SnapshotRow>();
  let next = 0n;
  const store: SnapshotStore = {
    async create(accountId, context) {
      const row = { id: ++next, accountId, context, pages: [], expiresAt: new Date(Date.now() + 60_000).toISOString() };
      rows.set(String(row.id), row); return row;
    },
    async save(id, pages) { rows.get(String(id))!.pages = pages; },
    async find(id, accountId) { const row = rows.get(id); return row?.accountId === accountId ? row : undefined; },
    async cleanup() {},
  };
  return { store, rows };
}

describe('read download boundary', () => {
  test('never accepts arbitrary routes, controller names, years, methods or records', () => {
    expect(installationDto.safeParse(identity).success).toBe(true);
    for (const extra of [{ route: '/fees' }, { academicYear: '2025-2026' }, { accountId: 'another' }]) {
      expect(installationDto.safeParse({ ...identity, ...extra }).success).toBe(false);
    }
    expect(snapshotDto.safeParse({ ...identity, kind: 'year', authorizationGeneration: 'a'.repeat(64) }).success).toBe(true);
    expect(snapshotDto.safeParse({ ...identity, kind: 'fees', authorizationGeneration: 'a'.repeat(64) }).success).toBe(false);
    expect(pageQuery.safeParse({ ...identity, authorizationGeneration: 'old' }).success).toBe(false);
  });
  test('enforces both page limits and refuses an indivisible oversized response', () => {
    const records = Array.from({ length: 1001 }, (_, id): ReplicaRecord => ({ entity: 'projection', id: String(id), revision: '1', deleted: false, value: 'x'.repeat(3000) }));
    const pages = splitReadPages(records, refuse);
    expect(pages.flat()).toEqual(records);
    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(500);
      expect(new TextEncoder().encode(canonicalJson(page)).length).toBeLessThanOrEqual(1_048_576);
    }
    expect(() => splitReadPages([{ ...records[0], value: 'x'.repeat(1_048_576) }], refuse)).toThrow(new Refused(413, 'pageLimit'));
  });
  test('packs each page as full as both limits allow, counting multibyte text, in one pass', () => {
    const records = Array.from({ length: 4000 }, (_, id): ReplicaRecord => ({ entity: 'projection', id: String(id), revision: '1',
      deleted: false, value: { name: 'é'.repeat((id * 7919) % 2500), id } }));
    const started = performance.now();
    const pages = splitReadPages(records, refuse);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(pages.flat()).toEqual(records);
    const size = (page: ReplicaRecord[]) => new TextEncoder().encode(canonicalJson(page)).length;
    pages.forEach((page, index) => {
      expect(page.length).toBeLessThanOrEqual(500);
      expect(size(page)).toBeLessThanOrEqual(1_048_576);
      // Greedy packing: the next record did not fit by count or by bytes.
      if (index < pages.length - 1) expect(page.length === 500 || size([...page, pages[index + 1][0]]) > 1_048_576).toBe(true);
    });
    expect(pages.some(page => page.length < 500)).toBe(true);
  });
  test('turned off, grants and downloads are refused before any account lookup', async () => {
    expect([undefined, '', 'on', 'true'].map(offlineEnabled)).toEqual([true, true, true, true]);
    expect(['off', ' OFF '].map(offlineEnabled)).toEqual([false, false]);
    const lookups: string[] = [];
    const check = (enabled: boolean, found: OfflineActor | null = null, requestActor: { id: string; role: string } | null = null) => ({
      enabled, lookup: async (id: string) => { lookups.push(id); return found; }, requestActor,
      permissions: ['read:offline', 'read:students'], can: (permission: string, granted: string[]) => granted.includes(permission), refuse });
    await expect(authorizeActor('account', check(false))).rejects.toMatchObject({ status: 403, reason: 'disabled' });
    expect(lookups).toEqual([]);
    await expect(authorizeActor('account', check(true))).rejects.toMatchObject({ status: 403, reason: 'notPermitted' });
    expect(lookups).toEqual(['account']);
    await expect(authorizeActor('account', check(true, { ...actor, status: 'inactive' }, actor))).rejects.toMatchObject({ reason: 'notPermitted' });
    await expect(authorizeActor('account', check(true, actor, { id: 'account', role: 'teacher' }))).rejects.toMatchObject({ reason: 'accountChanged' });
    await expect(authorizeActor('account', check(true, { ...actor, permissions: ['read:students'] }, actor))).rejects.toMatchObject({ reason: 'notPermitted' });
    expect(await authorizeActor('account', check(true, actor, actor))).toBe(actor);
  });
});

describe('grant and download protocol', () => {
  test('a grant names the shared scope and each year, and retains only enumerated read permissions', async () => {
    const grant = await buildGrant({ installation: identity, actor, years: ['2025-2026', '2026-2027'], activeYear: '2026-2027',
      capabilities: ['read:students', 'read:classes'], sharedCapabilities: ['read:students'], readPermissions: ['read:classes', 'read:students'] });
    expect(grant).toMatchObject({ ...identity, protocol: 1, schema: 1, accountId: 'account', activeYear: '2026-2027',
      authorizationGeneration: await authorizationGeneration(actor) });
    expect(grant.validUntil - grant.issuedAt).toBe(8 * 60 * 60 * 1000);
    expect(grant.scopes.map(scope => [scope.id, scope.academicYear])).toEqual([['shared', 'shared'], ['year:2025-2026', '2025-2026'], ['year:2026-2027', '2026-2027']]);
    expect(grant.permissions).toEqual(['read:offline', 'read:classes', 'read:students']);
  });
  test('a changed role, permission or ownership changes the authorization generation', async () => {
    const base = await authorizationGeneration(actor);
    for (const changed of [{ role: 'teacher' }, { permissions: ['read:students'] }, { ownership: 'moved' }]) {
      expect(await authorizationGeneration({ ...actor, ...changed })).not.toBe(base);
    }
    const renamed: OfflineActor = { ...actor, name: 'Renamed' };
    expect(await authorizationGeneration(renamed)).toBe(base);
  });
  test('a download records projections in pages its manifest checks, readable only in its own scope', async () => {
    const { store, rows } = memoryStore();
    const generation = await authorizationGeneration(actor);
    const input = { ...identity, kind: 'year' as const, authorizationGeneration: generation };
    const manifest = await createSnapshot({ store, actor, input, yearLabel: () => '2026-2027', language: 'fr', refuse,
      project: async (add, kind) => { expect(kind).toBe('year'); add('/students', { data: [{ id: 's1' }] }); add('/classes', { data: [] }); } });
    const context: SyncContext = { ...identity, accountId: 'account', authorizationGeneration: generation, replicaSchemaVersion: 1,
      scope: { kind: 'year', yearLabel: '2026-2027' } };
    expect(manifest).toMatchObject({ generation: '1', cursor: '1', recordCount: 2, context });
    const records = await readSnapshotPage({ store, actor, snapshotId: '1', page: 0,
      input: { ...identity, authorizationGeneration: generation }, yearLabel: () => '2026-2027', refuse });
    expect(records.map(record => record.id)).toEqual([projectionId('fr', '/students'), projectionId('fr', '/classes')]);
    expect(manifest.pageChecksums).toEqual([await sha256(canonicalJson(records))]);
    expect((records[0].value as { body: unknown }).body).toEqual({ data: [{ id: 's1' }] });
    const read = (overrides: Partial<Parameters<typeof readSnapshotPage>[0]>) => readSnapshotPage({ store, actor, snapshotId: '1', page: 0,
      input: { ...identity, authorizationGeneration: generation }, yearLabel: () => '2026-2027', refuse, ...overrides });
    await expect(read({ yearLabel: () => '2025-2026' })).rejects.toMatchObject({ status: 403, reason: 'scopeMismatch' });
    await expect(read({ input: { ...identity, installationEpoch: crypto.randomUUID(), authorizationGeneration: generation } })).rejects.toMatchObject({ reason: 'scopeMismatch' });
    await expect(read({ actor: { ...actor, role: 'teacher' } })).rejects.toMatchObject({ status: 403, reason: 'authorizationChanged' });
    await expect(read({ page: 1 })).rejects.toMatchObject({ status: 404, reason: 'pageNotFound' });
    await expect(read({ snapshotId: '9' })).rejects.toMatchObject({ status: 404, reason: 'snapshotExpired' });
    rows.get('1')!.expiresAt = new Date(Date.now() - 1).toISOString();
    await expect(read({})).rejects.toMatchObject({ status: 404, reason: 'snapshotExpired' });
    await expect(createSnapshot({ store, actor, input: { ...input, authorizationGeneration: 'b'.repeat(64) }, yearLabel: () => '2026-2027',
      language: 'fr', refuse, project: async () => {} })).rejects.toMatchObject({ status: 409, reason: 'authorizationChanged' });
  });
});

describe('app routes and writes', () => {
  test('an offline path is exact: no query, fragment, encoded separator or external URL', () => {
    expect(offlinePath('/students/')).toBe('/students');
    expect(offlinePath('/')).toBe('/');
    for (const path of ['/students?year=1', '/students#a', '/students/a%2Fb', '//external/students', 'https://external/students', '/a\\b']) {
      expect(offlinePath(path)).toBeNull();
    }
  });
  test('a write matcher matches a prefix and what is below it, never a longer name', () => {
    const affects = createWriteMatcher(['/students', '/settings']);
    for (const path of ['/students', '/students/1', '/students?x=1', '/settings/public']) expect(affects(path)).toBe(true);
    for (const path of ['/studentsx', '/staff', '/']) expect(affects(path)).toBe(false);
  });
});

describe('worker route', () => {
  test('turned off, the worker drops the shell without reading its manifest; turned on, it precaches the shell', async () => {
    let enabled = false;
    let reads = 0;
    const GET = createOfflineShellWorker({ cacheId: 'app-shell', paths: ['/students', '/students/*'], enabled: () => enabled,
      manifest: async () => { reads++; return { version: 'a'.repeat(20), document: '/offline-shell/shell-x.html', assets: ['/offline-shell/app-x.js'] }; } });
    const off = await (await GET()).text();
    expect(reads).toBe(0);
    expect(off).not.toContain('/offline-shell/app-x.js');
    enabled = true;
    const on = await (await GET()).text();
    expect(reads).toBe(1);
    expect(on).toContain('/offline-shell/app-x.js');
    expect(on).toContain('/offline-shell/shell-x.html');
  });
});

test('a shared download never reads the request year, which it may not carry', async () => {
  const { store } = memoryStore();
  const generation = await authorizationGeneration(actor);
  const noYear = () => { throw new Error('No year scope'); };
  const manifest = await createSnapshot({ store, actor, input: { ...identity, kind: 'shared', authorizationGeneration: generation },
    yearLabel: noYear, language: 'en', refuse, project: async add => { add('/settings/public', { data: {} }); } });
  expect(manifest.context.scope).toEqual({ kind: 'shared' });
  expect(await readSnapshotPage({ store, actor, snapshotId: manifest.generation, page: 0,
    input: { ...identity, authorizationGeneration: generation }, yearLabel: noYear, refuse })).toHaveLength(1);
});
