import { afterEach, expect, test } from 'bun:test';
import { IDBFactory } from 'fake-indexeddb';
import { injectFault } from 'fast-idb/testing';
import { openSyncReplica, synchronizeReplica, type SyncReplica, type SnapshotManifest } from '../src/sync/client';
import { canonicalJson, sealOperation, sha256, type OperationReceipt, type ReplicaRecord, type SyncContext } from '../src/sync/contracts';

const context: SyncContext = { installationId: 'school', installationEpoch: 'epoch-1', accountId: 'teacher-a',
  scope: { kind: 'year', yearLabel: '2026-2027' }, authorizationGeneration: 'rights-1', replicaSchemaVersion: 1 };
const hashFormat = 'fixture-json-v1-sha256';
const replicas: SyncReplica[] = [];
afterEach(() => { for (const replica of replicas.splice(0)) replica.close(); });
async function open(factory = new IDBFactory(), name = crypto.randomUUID(), ctx = context) {
  const replica = await openSyncReplica({ name, factory, identity: ctx, hashFormat, now: () => 1000,
    canAccess: (policy: any, ctx) => policy?.allow === true && policy.accountId === ctx.accountId
      && policy.epoch === ctx.installationEpoch && policy.generation === ctx.authorizationGeneration });
  replicas.push(replica);
  await replica.database.write([{ put: 'metadata', key: 'access', value: { allow: true, accountId: ctx.accountId, epoch: ctx.installationEpoch, generation: ctx.authorizationGeneration } }]);
  return replica;
}
const record = (revision = '1', status = 'present'): ReplicaRecord => ({ entity: 'attendance', id: 'mark-1', revision, deleted: false, value: { status } });
async function snapshot(replica: SyncReplica, records: ReplicaRecord[] = [record()], ctx = context, cursor = 'cursor-1') {
  const ticket = await replica.beginSnapshot(ctx);
  const manifest: SnapshotManifest = { context: ctx, generation: crypto.randomUUID(), cursor, expiresAt: 2000,
    pageChecksums: records.length ? [await sha256(canonicalJson(records))] : [], recordCount: records.length };
  if (records.length) await replica.stageSnapshotPage(ticket, manifest, 0, records);
  return { ticket, manifest };
}
async function ready(replica: SyncReplica, records: ReplicaRecord[] = [record()]) {
  const { ticket, manifest } = await snapshot(replica, records);
  return replica.activateSnapshot(ticket, manifest);
}
async function operation(intent = { command: 'attendance.student.correct', status: 'absent' }, dependencies: string[] = []) {
  return sealOperation({ installationId: context.installationId, installationEpoch: context.installationEpoch, accountId: context.accountId,
    scope: context.scope, operationId: crypto.randomUUID(), deviceId: 'device-a', protocolVersion: 1, hashFormat,
    dependencies, createdAtClient: new Date(1000).toISOString(), intent });
}
const receipt = (op: Awaited<ReturnType<typeof operation>>, revision = '2'): OperationReceipt => ({
  operationId: op.operationId, payloadHash: op.payloadHash,
  outcome: { state: 'acknowledged', records: [record(revision, 'absent')], result: { id: 'mark-1' }, mappings: { 'local:mark': 'mark-1' } },
});

test('partial/expired/checksum-failed snapshot cannot activate; explicit empty coverage can', async () => {
  const replica = await open();
  const staged = await snapshot(replica);
  await expect(replica.capture(context)).rejects.toThrow('COVERAGE_INCOMPLETE');
  await expect(replica.stageSnapshotPage(staged.ticket, staged.manifest, 0, [record('9')])).rejects.toThrow('SNAPSHOT_CHECKSUM');
  await expect(replica.activateSnapshot(staged.ticket, { ...staged.manifest, recordCount: 2 })).rejects.toThrow('COVERAGE_INCOMPLETE');
  await expect(replica.activateSnapshot(staged.ticket, { ...staged.manifest, expiresAt: 1000 })).rejects.toThrow('SNAPSHOT_EXPIRED');
  const empty = await snapshot(replica, []);
  const captured = await replica.activateSnapshot(empty.ticket, empty.manifest);
  expect((await replica.read(captured)).records).toEqual([]);
});

test('a newer download or intervening canonical write fences an old snapshot callback', async () => {
  const replica = await open(); const captured = await ready(replica);
  const old = await snapshot(replica);
  const newer = await snapshot(replica);
  await expect(replica.activateSnapshot(old.ticket, old.manifest)).rejects.toThrow('STALE_RUNTIME');
  await replica.applyChanges(captured, 'cursor-1', 'cursor-2', [record('5')]);
  await expect(replica.activateSnapshot(newer.ticket, newer.manifest)).rejects.toThrow('STALE_RUNTIME');
  expect((await replica.read(captured)).records[0].revision).toBe('5');
});

test('durable intent is immutable, idempotent by hash and ordered across two connections', async () => {
  const factory = new IDBFactory(); const name = crypto.randomUUID(); const a = await open(factory, name); const captured = await ready(a);
  const b = await open(factory, name); const op = await operation();
  expect(await a.enqueue(captured, op)).toBe(1);
  expect(await b.enqueue(captured, op)).toBe(1);
  op.intent.status = 'late';
  expect((await a.read(captured)).pending[0].operation.intent).toEqual({ command: 'attendance.student.correct', status: 'absent' });
  const second = await operation(); second.operationId = op.operationId; second.intent.status = 'late';
  const { payloadHash: _, ...unsigned } = second;
  await expect(b.enqueue(captured, await sealOperation(unsigned))).rejects.toThrow('OPERATION_HASH_MISMATCH');
  expect(await b.enqueue(captured, await operation())).toBe(2);
});

test('second-write and commit faults retain pending intent and the old cursor/records', async () => {
  const replica = await open(); const captured = await ready(replica); const op = await operation(); await replica.enqueue(captured, op); await replica.markSending(captured, op.operationId);
  injectFault(replica.database, { store: 'outbox', op: 'put' });
  await expect(replica.applyReceipt(captured, receipt(op))).rejects.toThrow();
  const state = await replica.read(captured);
  expect(state.records[0].revision).toBe('1'); expect(state.mappings).toEqual([]); expect(state.pending[0].state).toBe('sending');
  injectFault(replica.database, { op: 'commit' });
  await expect(replica.applyChanges(captured, 'cursor-1', 'cursor-2', [record('9')])).rejects.toThrow();
  expect((await replica.capture(context)).cursor).toBe('cursor-1'); expect((await replica.read(captured)).records[0].revision).toBe('1');
});

test('receipt advances canonical state and mapping without clearing a later edit; replay cannot regress', async () => {
  const replica = await open(); const captured = await ready(replica); const first = await operation(); const later = await operation({ command: 'attendance.student.correct', status: 'late' }, [first.operationId]);
  await replica.enqueue(captured, first); await replica.enqueue(captured, later); await replica.markSending(captured, first.operationId);
  await replica.applyChanges(captured, 'cursor-1', 'cursor-2', [record('5', 'late')]);
  await replica.applyReceipt(captured, receipt(first, '2')); await replica.applyReceipt(captured, receipt(first, '2'));
  const state = await replica.read(captured);
  expect(state.records[0].revision).toBe('5'); expect(state.mappings).toEqual([{ localReference: 'local:mark', canonicalId: 'mark-1' }]);
  expect(state.pending.map(row => row.state)).toEqual(['acknowledged', 'pending']);
  expect(state.pending[1].operation.payloadHash).toBe(later.payloadHash);
});

test('policy/account/epoch/year/fence checks happen inside delayed acknowledgement and cursor commits', async () => {
  const replica = await open(); const captured = await ready(replica); const op = await operation(); await replica.enqueue(captured, op); await replica.markSending(captured, op.operationId);
  await replica.database.write([{ put: 'metadata', key: 'access', value: { allow: false } }]);
  await expect(replica.applyReceipt(captured, receipt(op))).rejects.toThrow('OFFLINE_ACCESS_REVOKED');
  await expect(replica.applyChanges(captured, 'cursor-1', 'cursor-2', [record('9')])).rejects.toThrow('OFFLINE_ACCESS_REVOKED');
  await replica.lock(context);
  expect((await replica.database.getAll('outbox'))[0].operation.payloadHash).toBe(op.payloadHash);
  await expect(replica.read(captured)).rejects.toThrow('STALE_RUNTIME');
});

test('another account cannot reopen the same named database even with its own new policy', async () => {
  const factory = new IDBFactory(); const name = crypto.randomUUID(); const replica = await open(factory, name); await ready(replica);
  await expect(open(factory, name, { ...context, accountId: 'teacher-b' })).rejects.toThrow('RESOURCE_FORBIDDEN');
});

test('sent or dependent commands cannot be cancelled; unknown cursor responses cannot advance', async () => {
  const replica = await open(); const captured = await ready(replica); const first = await operation(); const second = await operation({ command: 'attendance.student.correct', status: 'late' }, [first.operationId]);
  await replica.enqueue(captured, first); await replica.enqueue(captured, second);
  await expect(replica.cancel(captured, first.operationId)).rejects.toThrow('DEPENDENCY_PENDING');
  await replica.cancel(captured, second.operationId);
  await replica.markSending(captured, first.operationId);
  await expect(replica.cancel(captured, first.operationId)).rejects.toThrow('OPERATION_UNCERTAIN');
  await expect(replica.applyChanges(captured, 'unknown', 'next', [record('99')])).rejects.toThrow('STALE_CURSOR');
  expect((await replica.capture(context)).cursor).toBe('cursor-1');
});

test('reopening after lost reply uses status lookup and the original hash, without repeating a known mutation', async () => {
  const factory = new IDBFactory(); const name = crypto.randomUUID(); let replica = await open(factory, name); let captured = await ready(replica); const op = await operation(); await replica.enqueue(captured, op);
  let pushes = 0; let stored: OperationReceipt | undefined; let time = 1000;
  const transport = {
    async push(sent: typeof op) { pushes++; expect(sent.payloadHash).toBe(op.payloadHash); stored = receipt(op); throw new Error('reply lost'); },
    async lookup() { return { state: 'known' as const, receipt: stored! }; },
  };
  const locks = { request: async (_: string, work: () => Promise<void>) => work() } as any;
  await expect(synchronizeReplica({ replica, captured, transport, locks, now: () => time })).rejects.toThrow('reply lost');
  expect((await replica.read(captured)).pending[0].state).toBe('uncertain');
  replica.close(); replica = await open(factory, name); captured = await replica.capture(context); time = 4000;
  await synchronizeReplica({ replica, captured, transport, locks, now: () => time });
  expect(pushes).toBe(1); expect((await replica.read(captured)).pending[0].state).toBe('acknowledged');
});

test('expired operation identities quarantine without automatic replay or cancellation', async () => {
  const replica = await open(); const captured = await ready(replica); const op = await operation();
  await replica.enqueue(captured, op); await replica.markSending(captured, op.operationId);
  const { SyncError } = await import('../src/sync/contracts');
  let pushes = 0;
  const transport = { async lookup() { return { state: 'expired' as const }; }, async push() { pushes++; throw new SyncError('should-not-send'); } };
  const locks = { request: async (_: string, work: () => Promise<void>) => work() } as any;
  await expect(synchronizeReplica({ replica, captured, transport, locks, now: () => 1000 })).rejects.toThrow('OPERATION_EXPIRED');
  expect((await replica.read(captured)).pending[0].state).toBe('quarantined');
  await synchronizeReplica({ replica, captured, transport, locks, now: () => 100000 }); expect(pushes).toBe(0);
  await expect(replica.resume(captured, op.operationId)).rejects.toThrow('RECONCILIATION_REQUIRED');
  await expect(replica.cancel(captured, op.operationId)).rejects.toThrow('OPERATION_UNCERTAIN');
});

test('membership rebootstrap quarantines original commands; explicit recovery retains uncertainty/hash', async () => {
  const replica = await open(); const captured = await ready(replica); const op = await operation();
  await replica.enqueue(captured, op); await replica.markSending(captured, op.operationId);
  const revised = { ...context, authorizationGeneration: 'rights-2' };
  await replica.database.write([{ put: 'metadata', key: 'access', value: { allow: true, accountId: context.accountId, epoch: context.installationEpoch, generation: revised.authorizationGeneration } }]);
  const download = await snapshot(replica, [record()], revised);
  const next = await replica.activateSnapshot(download.ticket, download.manifest);
  const pending = (await replica.read(next)).pending[0]; expect(pending.state).toBe('quarantined');
  expect(pending.operation.payloadHash).toBe(op.payloadHash);
  await replica.resume(next, op.operationId);
  const restored = (await replica.read(next)).pending[0]; expect(restored.state).toBe('uncertain'); expect(restored.firstSentAt).toBe(pending.firstSentAt);
  expect(restored.authorizationGenerationAtCapture).toBe('rights-1'); expect(restored.operation.payloadHash).toBe(op.payloadHash);
});
