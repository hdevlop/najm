import { describe, expect, test } from 'bun:test';
import {
  createOfflineAccess,
  type OfflineAccessRecord,
  type OfflineAccessStore,
  type OfflineEnrollment,
} from '../src/client/offline';

function fixture() {
  let value: OfflineAccessRecord | null = null;
  let clock = 10_000;
  let failWrite = false;
  const store: OfflineAccessStore = {
    async read() { return structuredClone(value); },
    async compareAndSwap(revision, next) {
      if (failWrite) throw new Error('QuotaExceededError');
      if ((value?.revision ?? null) !== revision) return false;
      value = structuredClone(next);
      return true;
    },
  };
  const create = () => createOfflineAccess({ store, now: () => clock, clockRollbackToleranceMs: 5 });
  const access = create();
  const input: OfflineEnrollment = {
    accountId: 'teacher-a', installationId: 'school-1', installationEpoch: 'epoch-1',
    authorizationGeneration: 'policy-8', issuedAt: 1_000_000, validUntil: 1_010_000,
    scopes: [{ id: 'attendance-class-1', academicYear: '2026-2027', capabilities: ['mark:attendance', 'read:attendance'] }],
    online: { authenticated: true, accountId: 'teacher-a', permissions: ['use:offline', 'mark:attendance', 'read:attendance'] },
    consent: true,
  };
  const request = { accountId: 'teacher-a', installationId: 'school-1', installationEpoch: 'epoch-1', scopeId: 'attendance-class-1', academicYear: '2026-2027', capability: 'mark:attendance' };
  async function enroll() { return access.enroll(await access.capture(), input); }
  return { store, access, create, input, request, enroll,
    advance: (amount: number) => { clock += amount; }, setClock: (time: number) => { clock = time; },
    record: () => structuredClone(value), setRecord: (next: any) => { value = next; },
    failWrite: () => { failWrite = true; },
  };
}

describe('cached offline access is separate from online authentication', () => {
  test('automatic reading after online sign-in needs no consent and cannot grant a command', async () => {
    const f = fixture();
    const { consent: _consent, online: _online, scopes: _scopes, ...base } = f.input;
    const reading: OfflineEnrollment = {
      ...base, mode: 'automatic-read',
      scopes: [{ id: 'classes', academicYear: '2026-2027', capabilities: ['read:classes'] }],
      online: { authenticated: true, accountId: 'teacher-a', permissions: ['read:offline', 'read:classes'] },
    };
    expect((await f.access.enroll(await f.access.capture(), reading)).applied).toBe(true);
    expect((await f.access.authorize({ ...f.request, scopeId: 'classes', capability: 'read:classes' })).allowed).toBe(true);
    expect((await f.access.authorize({ ...f.request, scopeId: 'classes', capability: 'mark:attendance' })).allowed).toBe(false);
    expect(f.record()).not.toHaveProperty('online');
    expect(f.record()).not.toHaveProperty('consent');
  });

  test.each([
    ['missing read grant', { online: { authenticated: true, accountId: 'teacher-a', permissions: ['read:classes'] } }],
    ['write capability', { scopes: [{ id: 'classes', academicYear: '2026-2027', capabilities: ['mark:attendance'] }],
      online: { authenticated: true, accountId: 'teacher-a', permissions: ['read:offline', 'mark:attendance'] } }],
    ['forged consent', { consent: true }],
  ])('automatic reading rejects %s', async (_name, patch) => {
    const f = fixture();
    const { consent: _consent, online: _online, scopes: _scopes, ...base } = f.input;
    const reading = {
      ...base, mode: 'automatic-read',
      scopes: [{ id: 'classes', academicYear: '2026-2027', capabilities: ['read:classes'] }],
      online: { authenticated: true, accountId: 'teacher-a', permissions: ['read:offline', 'read:classes'] },
      ...patch,
    };
    await expect(f.access.enroll(await f.access.capture(), reading as OfflineEnrollment)).rejects.toThrow();
    expect(f.record()).toBeNull();
  });

  test('automatic reading does not replace an existing command entitlement', async () => {
    const f = fixture(); await f.enroll();
    const { consent: _consent, online: _online, scopes: _scopes, ...base } = f.input;
    const reading: OfflineEnrollment = { ...base, mode: 'automatic-read', issuedAt: f.input.issuedAt + 1,
      scopes: [{ id: 'classes', academicYear: '2026-2027', capabilities: ['read:classes'] }],
      online: { authenticated: true, accountId: 'teacher-a', permissions: ['read:offline', 'read:classes'] } };
    await expect(f.access.enroll(await f.access.capture(), reading)).rejects.toThrow(/cannot replace/);
    expect((await f.access.authorize(f.request)).allowed).toBe(true);
  });

  test('administrator wildcard grants allow read-only enrollment', async () => {
    const f = fixture();
    const { consent: _consent, online: _online, scopes: _scopes, ...base } = f.input;
    const reading: OfflineEnrollment = { ...base, mode: 'automatic-read',
      scopes: [{ id: 'classes', academicYear: '2026-2027', capabilities: ['read:classes'] }],
      online: { authenticated: true, accountId: 'teacher-a', permissions: ['*:*'] } };
    expect((await f.access.enroll(await f.access.capture(), reading)).applied).toBe(true);
  });

  test('starts closed, enrolls an exact account/install/year scope, never exposes a session', async () => {
    const f = fixture();
    expect(f.access.getSnapshot()).toEqual({ status: 'locked', reason: 'not-loaded' });
    expect(await f.access.authorize(f.request)).toEqual({ allowed: false, reason: 'not-enrolled' });
    expect((await f.enroll()).applied).toBe(true);
    expect((await f.access.authorize(f.request)).allowed).toBe(true);
    expect(f.access.getSnapshot()).toEqual({ status: 'available', accountId: 'teacher-a', installationId: 'school-1', installationEpoch: 'epoch-1', authorizationGeneration: 'policy-8', validUntil: 1_010_000 });
    expect(f.record()).not.toHaveProperty('session');
    expect(f.record()).not.toHaveProperty('online');
  });

  test.each([
    ['consent', { consent: false }], ['authentication', { online: { authenticated: false, accountId: 'teacher-a', permissions: ['use:offline'] } }],
    ['identity', { online: { authenticated: true, accountId: 'teacher-b', permissions: ['use:offline'] } }],
    ['enrollment grant', { online: { authenticated: true, accountId: 'teacher-a', permissions: ['mark:attendance', 'read:attendance'] } }],
    ['domain grant', { online: { authenticated: true, accountId: 'teacher-a', permissions: ['use:offline'] } }],
    ['policy duration', { validUntil: 1_000_000 + 8 * 24 * 60 * 60 * 1000 }],
    ['empty scope', { scopes: [] }],
    ['duplicate scope', { scopes: [{ id: 'a', academicYear: '2026', capabilities: ['read:attendance'] }, { id: 'a', academicYear: '2027', capabilities: ['read:attendance'] }] }],
  ])('requires %s', async (_name, patch) => {
    const f = fixture();
    await expect(f.access.enroll(await f.access.capture(), { ...f.input, ...patch } as OfflineEnrollment)).rejects.toThrow();
    expect(f.record()).toBeNull();
  });

  test('persists only policy fields even when the auth response carries credentials', async () => {
    const f = fixture();
    const input = { ...f.input, accessToken: 'secret', refreshToken: 'secret', scopes: [{ ...f.input.scopes[0], jwt: 'secret' }] };
    await f.access.enroll(await f.access.capture(), input);
    expect(JSON.stringify(f.record())).not.toContain('secret');
  });

  test('denies a different year, scope, or command without broadening enrollment', async () => {
    const f = fixture(); await f.enroll();
    expect(await f.access.authorize({ ...f.request, academicYear: '2025-2026' })).toEqual({ allowed: false, reason: 'scope-not-enrolled' });
    expect(await f.access.authorize({ ...f.request, scopeId: 'class-b' })).toEqual({ allowed: false, reason: 'scope-not-enrolled' });
    expect(await f.access.authorize({ ...f.request, capability: 'delete:attendance' })).toEqual({ allowed: false, reason: 'capability-not-enrolled' });
    expect((await f.access.authorize(f.request)).allowed).toBe(true);
  });

  test('installation identity or epoch mismatch locks the cache until fresh online enrollment', async () => {
    for (const patch of [{ installationId: 'school-2' }, { installationEpoch: 'restored-epoch' }]) {
      const f = fixture(); await f.enroll();
      const token = await f.access.capture();
      expect(await f.access.authorize({ ...f.request, ...patch })).toEqual({ allowed: false, reason: 'installation-mismatch' });
      expect(await f.access.isCurrent(token)).toBe(false);
      expect((await f.access.authorize(f.request)).allowed).toBe(false);
    }
  });
});

describe('expiry and clock observations are durable', () => {
  test('expires at the server-policy deadline using local elapsed time despite different clock offsets', async () => {
    const f = fixture(); await f.enroll();
    f.advance(9999); expect((await f.access.authorize(f.request)).allowed).toBe(true);
    f.advance(1); expect(await f.create().authorize(f.request)).toEqual({ allowed: false, reason: 'expired' });
    f.advance(-100); expect((await f.access.authorize(f.request)).allowed).toBe(false);
  });

  test('detects rollback after cold restart; small tolerated jitter does not extend the deadline', async () => {
    const f = fixture(); await f.enroll();
    f.advance(500); await f.access.authorize(f.request);
    f.advance(-4); expect((await f.create().authorize(f.request)).allowed).toBe(true);
    f.advance(-2); expect(await f.create().authorize(f.request)).toEqual({ allowed: false, reason: 'clock-rollback' });
    f.setClock(20_000); expect((await f.access.authorize(f.request)).allowed).toBe(false);
  });

  test('a delayed online response cannot restart its policy lifetime', async () => {
    const f = fixture(); const token = await f.access.capture();
    f.advance(5000); await f.access.enroll(token, f.input);
    f.advance(5000); expect(await f.access.authorize(f.request)).toEqual({ allowed: false, reason: 'expired' });
    const g = fixture(); const expiredToken = await g.access.capture(); g.advance(10_000);
    await expect(g.access.enroll(expiredToken, g.input)).rejects.toThrow(/expired/);
  });

  test('cannot grant access until the high-water observation has durably committed', async () => {
    const f = fixture(); await f.enroll(); f.advance(1); f.failWrite();
    await expect(f.access.authorize(f.request)).rejects.toThrow('QuotaExceededError');
    expect(f.access.getSnapshot()).toEqual({ status: 'locked', reason: 'storage-unavailable' });
  });

  test('a shorter current policy applies after reopening without extending a saved grant', async () => {
    const f = fixture(); await f.enroll(); f.advance(5000);
    const stricter = createOfflineAccess({ store: f.store, now: () => 15000, maxOfflineDurationMs: 4000 });
    expect(await stricter.authorize(f.request)).toEqual({ allowed: false, reason: 'expired' });
  });

  test('an invalid clock fails closed instead of retaining an available UI snapshot', async () => {
    const f = fixture(); await f.enroll(); f.setClock(Number.NaN);
    await expect(f.access.authorize(f.request)).rejects.toThrow(/clock/);
    expect(f.access.getSnapshot()).toEqual({ status: 'locked', reason: 'storage-unavailable' });
  });

  test('rejects corrupt/unknown records rather than replacing or deleting them', async () => {
    const f = fixture(); f.setRecord({ schemaVersion: 42, revision: 5, pendingWork: ['keep'] });
    await expect(f.access.refresh()).rejects.toThrow(/unsupported/);
    expect(f.record()).toEqual({ schemaVersion: 42, revision: 5, pendingWork: ['keep'] } as any);
    expect(f.access.getSnapshot().status).toBe('locked');
  });
});

describe('logout, account changes and concurrent callbacks', () => {
  test.each(['logout', 'account-disabled', 'authorization-revoked', 'dataset-incompatible'] as const)('%s locks persistently without removing pending work', async reason => {
    const f = fixture(); await f.enroll();
    const pendingWork = [{ accountId: 'teacher-a', operationId: 'uncertain-operation' }];
    const token = await f.access.capture();
    expect((await f.access.lock(token, reason)).applied).toBe(true);
    expect(await f.create().authorize(f.request)).toEqual({ allowed: false, reason });
    expect(await f.access.isCurrent(token)).toBe(false);
    expect(pendingWork).toEqual([{ accountId: 'teacher-a', operationId: 'uncertain-operation' }]);
    expect(f.record()!.entitlement!.accountId).toBe('teacher-a');
  });

  test('logout before enrollment creates a tombstone that fences a late response', async () => {
    const f = fixture(); const old = await f.access.capture();
    await f.access.lock(old, 'logout');
    expect((await f.access.enroll(old, f.input)).applied).toBe(false);
    expect(f.record()!.status).toBe('locked');
  });

  test('account B requires a deliberate switch and rejects A callbacks/locks', async () => {
    const f = fixture(); await f.enroll(); const old = await f.access.capture();
    const b: OfflineEnrollment = { ...f.input, accountId: 'teacher-b', online: { ...f.input.online, accountId: 'teacher-b' } };
    await expect(f.access.enroll(old, b)).rejects.toThrow(/Lock the previous/);
    await f.access.lock(old, 'account-switch');
    await f.access.enroll(await f.access.capture(), b);
    expect(await f.access.isCurrent(old)).toBe(false);
    expect((await f.access.enroll(old, f.input)).applied).toBe(false);
    expect((await f.access.lock(old, 'logout')).applied).toBe(false);
    expect(f.access.getSnapshot().accountId).toBe('teacher-b');
    expect(await f.access.authorize(f.request)).toEqual({ allowed: false, reason: 'account-mismatch' });
    expect((await f.access.authorize({ ...f.request, accountId: 'teacher-b' })).allowed).toBe(true);
  });

  test('two tabs race enrollment, exactly one grant wins the persisted fence', async () => {
    const f = fixture(); const other = f.create();
    const [a, b] = await Promise.all([f.access.capture(), other.capture()]);
    const results = await Promise.all([f.access.enroll(a, f.input), other.enroll(b, f.input)]);
    expect(results.map(r => r.applied).sort()).toEqual([false, true]);
    expect((await other.refresh()).status).toBe('available');
    const old = await other.capture();
    await f.access.lock(await f.access.capture(), 'logout');
    expect(await other.isCurrent(old)).toBe(false);
    expect(other.getSnapshot().status).toBe('locked');
  });

  test('clock-only writes keep callback fences stable, policy replacement invalidates them', async () => {
    const f = fixture(); await f.enroll(); const token = await f.access.capture();
    f.advance(200); await f.create().refresh();
    expect(await f.access.isCurrent(token)).toBe(true);
    await f.access.enroll(await f.access.capture(), { ...f.input, issuedAt: f.input.issuedAt + 1, validUntil: f.input.validUntil + 1, authorizationGeneration: 'policy-9' });
    expect(await f.access.isCurrent(token)).toBe(false);
  });

  test('replaying an old grant cannot extend expiry or unlock a revoked enrollment', async () => {
    const f = fixture(); await f.enroll(); f.advance(5000);
    expect((await f.enroll()).applied).toBe(false);
    f.advance(5000);
    expect(await f.access.authorize(f.request)).toEqual({ allowed: false, reason: 'expired' });
    expect((await f.enroll()).applied).toBe(false);
    expect(f.access.getSnapshot().status).toBe('locked');
  });

  test('subscribers see enrollment, durable external logout and storage failure', async () => {
    const f = fixture(); const events: string[] = [];
    const off = f.access.subscribe(() => { events.push(f.access.getSnapshot().status); });
    await f.enroll();
    const other = f.create(); await other.lock(await other.capture(), 'logout');
    await f.access.refresh();
    expect(events).toEqual(['empty', 'available', 'locked']);
    off(); await f.access.refresh(); expect(events).toHaveLength(3);
  });
});
