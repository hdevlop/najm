import { openDatabase, type Database, type DatabaseOptions } from 'fast-idb/db';
import { assertOperationContext, assertRecord, canonicalJson, sameContext, scopeKey, sha256, SyncError, verifyOperation,
  type OperationReceipt, type ReplicaRecord, type SyncContext, type SyncOperation } from './contracts';

export type PendingState = 'pending' | 'sending' | 'uncertain' | 'acknowledged' | 'conflict' | 'rejected' | 'blocked_dependency' | 'quarantined' | 'cancelled';
export interface PendingOperation<I = unknown> {
  localSequence?: number;
  operation: SyncOperation<I>;
  state: PendingState;
  attempts: number;
  authorizationGenerationAtCapture: string;
  firstSentAt?: string;
  nextAttemptAt: number;
  outcome?: OperationReceipt['outcome'];
  lastErrorCode?: string;
}
interface Runtime { context: SyncContext; fence: string; cursor: string | null; ready: boolean; dataRevision: number }
interface StoredRecord extends ReplicaRecord { scope: string }
interface SnapshotPage { generation: string; page: number; checksum: string; records: readonly ReplicaRecord[] }
export type ReplicaSchema = {
  records: StoredRecord;
  outbox: PendingOperation;
  mappings: { localReference: string; canonicalId: string };
  metadata: unknown;
  snapshotPages: SnapshotPage;
}
export interface CapturedRuntime { context: SyncContext; fence: string; cursor: string | null }
export interface SnapshotTicket { context: SyncContext; fence: string; runtimeFence: string | null; dataRevision: number }
export interface SnapshotManifest {
  generation: string;
  context: SyncContext;
  cursor: string;
  expiresAt: number;
  pageChecksums: readonly string[];
  recordCount: number;
}
export interface ReplicaOptions {
  name: string;
  /** A database contains exactly one installation/account, across downloaded years. */
  identity: Pick<SyncContext, 'installationId' | 'accountId'>;
  hashFormat: string;
  factory?: IDBFactory;
  onBlocked?: DatabaseOptions<ReplicaSchema>['onBlocked'];
  onClose?: DatabaseOptions<ReplicaSchema>['onClose'];
  now?: () => number;
  /** Synchronous policy check, reading the durable access row INSIDE each commit. */
  canAccess: (policy: unknown, context: SyncContext, writing: boolean) => boolean;
}
const runtimeKey = (scope: string) => 'runtime:' + scope;
const checkedClone = <T>(value: T): T => JSON.parse(canonicalJson(value));
function checkedTime(now: () => number): number {
  const time = now();
  if (!Number.isSafeInteger(time) || time < 0) throw new SyncError('CLOCK_INVALID');
  return time;
}

/** No database/browser is opened at import time. Never deletes a database. */
export async function openSyncReplica(options: ReplicaOptions) {
  const now = options.now ?? Date.now;
  const identity = checkedClone(options.identity);
  const db: Database<ReplicaSchema> = await openDatabase<ReplicaSchema>({
    name: options.name, version: 1, factory: options.factory, onBlocked: options.onBlocked, onClose: options.onClose,
    stores: {
      records: { key: ['scope', 'entity', 'id'] },
      outbox: { key: 'localSequence', autoIncrement: true, indexes: { operationId: { path: 'operation.operationId', unique: true } } },
      mappings: { key: 'localReference' }, metadata: {}, snapshotPages: { key: ['generation', 'page'] },
    },
  });
  try {
    await db.transaction(['metadata'], async tx => {
      const previous = await tx.get('metadata', 'identity');
      if (previous && canonicalJson(previous) !== canonicalJson(identity)) throw new SyncError('RESOURCE_FORBIDDEN');
      if (!previous) await tx.put('metadata', identity, 'identity');
    }, { durability: 'strict' });
  } catch (error) { db.close(); throw error; }
  async function assertIdentity(context: SyncContext) {
    if (context.installationId !== identity.installationId || context.accountId !== identity.accountId) throw new SyncError('RESOURCE_FORBIDDEN');
    if (!Number.isSafeInteger(context.replicaSchemaVersion) || context.replicaSchemaVersion !== 1) throw new SyncError('SCHEMA_UNSUPPORTED');
    scopeKey(context.scope);
  }
  // Only IDB requests are awaited while a fast-idb transaction is active.
  async function current(tx: Pick<Database<ReplicaSchema>, 'get'>, captured: CapturedRuntime, writing: boolean): Promise<Runtime> {
    const runtime = await tx.get('metadata', runtimeKey(scopeKey(captured.context.scope))) as Runtime | undefined;
    if (!runtime || !runtime.ready || runtime.fence !== captured.fence || !sameContext(runtime.context, captured.context)) throw new SyncError('STALE_RUNTIME');
    const policy = await tx.get('metadata', 'access');
    if (!options.canAccess(policy, runtime.context, writing)) throw new SyncError('OFFLINE_ACCESS_REVOKED');
    return runtime;
  }
  async function findOperation(tx: Pick<Database<ReplicaSchema>, 'getAllFromIndex'>, id: string) {
    return (await tx.getAllFromIndex('outbox', 'operationId', id))[0];
  }

  return {
    /** Shares the metadata/access row with the existing auth helper's atomic CAS adapter. */
    database: db,
    close: () => db.close(),
    subscribe: (listener: () => void) => db.onCommit(listener),

    async capture(context: SyncContext): Promise<CapturedRuntime> {
      await assertIdentity(context);
      const copy = checkedClone(context);
      return db.read(['metadata'], async tx => {
        const runtime = await tx.get('metadata', runtimeKey(scopeKey(copy.scope))) as Runtime | undefined;
        if (!runtime || !sameContext(runtime.context, copy)) throw new SyncError('COVERAGE_INCOMPLETE');
        const captured = { context: copy, fence: runtime.fence, cursor: runtime.cursor };
        await current(tx, captured, false);
        return captured;
      });
    },

    /** Locking preserves all confirmed records, mappings and original pending commands. */
    async lock(context: SyncContext): Promise<void> {
      await assertIdentity(context);
      const key = runtimeKey(scopeKey(context.scope));
      await db.transaction(['metadata'], async tx => {
        const runtime = await tx.get('metadata', key) as Runtime | undefined;
        if (runtime) await tx.put('metadata', { ...runtime, ready: false, fence: crypto.randomUUID() }, key);
      }, { durability: 'strict', tags: ['sync:locked'] });
    },

    /** Reserve before starting a request; a newer download invalidates all older callbacks. */
    async beginSnapshot(context: SyncContext): Promise<SnapshotTicket> {
      await assertIdentity(context);
      const copy = checkedClone(context);
      return db.transaction(['metadata'], async tx => {
        if (!options.canAccess(await tx.get('metadata', 'access'), copy, false)) throw new SyncError('OFFLINE_ACCESS_REVOKED');
        const runtime = await tx.get('metadata', runtimeKey(scopeKey(copy.scope))) as Runtime | undefined;
        const ticket = { context: copy, fence: crypto.randomUUID(), runtimeFence: runtime?.fence ?? null, dataRevision: runtime?.dataRevision ?? 0 };
        await tx.put('metadata', ticket, 'download:' + scopeKey(copy.scope));
        return ticket;
      }, { durability: 'strict', tags: ['sync:download'] });
    },

    async stageSnapshotPage(ticket: SnapshotTicket, manifest: SnapshotManifest, page: number, records: readonly ReplicaRecord[]) {
      await assertIdentity(manifest.context);
      if (!sameContext(ticket.context, manifest.context)) throw new SyncError('STALE_RUNTIME');
      if (!Number.isSafeInteger(page) || page < 0 || page >= manifest.pageChecksums.length || records.length > 500) throw new SyncError('PAYLOAD_INVALID');
      const copy = checkedClone(records);
      copy.forEach(assertRecord);
      const checksum = await sha256(canonicalJson(copy));
      if (new TextEncoder().encode(canonicalJson(copy)).length > 1048576) throw new SyncError('PAYLOAD_INVALID');
      if (checksum !== manifest.pageChecksums[page]) throw new SyncError('SNAPSHOT_CHECKSUM');
      if (checkedTime(now) >= manifest.expiresAt) throw new SyncError('SNAPSHOT_EXPIRED');
      await db.transaction(['metadata', 'snapshotPages'], async tx => {
        const reservation = await tx.get('metadata', 'download:' + scopeKey(ticket.context.scope)) as SnapshotTicket | undefined;
        if (reservation?.fence !== ticket.fence) throw new SyncError('STALE_RUNTIME');
        if (!options.canAccess(await tx.get('metadata', 'access'), ticket.context, false)) throw new SyncError('OFFLINE_ACCESS_REVOKED');
        await tx.put('snapshotPages', { generation: manifest.generation, page, checksum, records: copy });
      }, { tags: ['sync:download'] });
    },

    async activateSnapshot(ticket: SnapshotTicket, manifest: SnapshotManifest): Promise<CapturedRuntime> {
      await assertIdentity(manifest.context);
      const copy = checkedClone(manifest);
      if (!sameContext(ticket.context, copy.context)) throw new SyncError('STALE_RUNTIME');
      if (!copy.generation || typeof copy.cursor !== 'string' || !copy.cursor || !Number.isSafeInteger(copy.recordCount) || copy.recordCount < 0
        || !Array.isArray(copy.pageChecksums) || copy.pageChecksums.some(hash => !/^[a-f0-9]{64}$/.test(hash))) throw new SyncError('PAYLOAD_INVALID');
      const scope = scopeKey(copy.context.scope);
      const fence = crypto.randomUUID();
      return db.transaction(['metadata', 'snapshotPages', 'records', 'outbox'], async tx => {
        if (checkedTime(now) >= copy.expiresAt) throw new SyncError('SNAPSHOT_EXPIRED');
        const policy = await tx.get('metadata', 'access');
        if (!options.canAccess(policy, copy.context, false)) throw new SyncError('OFFLINE_ACCESS_REVOKED');
        const reservation = await tx.get('metadata', 'download:' + scope) as SnapshotTicket | undefined;
        const existing = await tx.get('metadata', runtimeKey(scope)) as Runtime | undefined;
        if (reservation?.fence !== ticket.fence || (existing?.fence ?? null) !== ticket.runtimeFence
          || (existing?.dataRevision ?? 0) !== ticket.dataRevision) throw new SyncError('STALE_RUNTIME');
        const pages: SnapshotPage[] = [];
        for (let page = 0; page < copy.pageChecksums.length; page++) {
          const stored = await tx.get('snapshotPages', [copy.generation, page]);
          if (!stored || stored.checksum !== copy.pageChecksums[page]) throw new SyncError('COVERAGE_INCOMPLETE');
          pages.push(stored);
        }
        const records = pages.flatMap(page => page.records);
        if (records.length !== copy.recordCount || new Set(records.map(row => canonicalJson([row.entity, row.id]))).size !== records.length) throw new SyncError('COVERAGE_INCOMPLETE');
        // Replace one confirmed scope atomically; other years and all pending intent remain.
        for (const record of await tx.getAll('records')) if (record.scope === scope) await tx.delete('records', [scope, record.entity, record.id]);
        for (const record of records) await tx.put('records', { ...record, scope });
        for (const pending of await tx.getAll('outbox')) {
          if (scopeKey(pending.operation.scope) !== scope || ['acknowledged', 'cancelled', 'conflict', 'rejected'].includes(pending.state)) continue;
          const epochChanged = pending.operation.installationEpoch !== copy.context.installationEpoch;
          const rightsChanged = pending.authorizationGenerationAtCapture !== copy.context.authorizationGeneration;
          if (epochChanged || rightsChanged) await tx.put('outbox', { ...pending, state: 'quarantined', lastErrorCode: epochChanged ? 'DATASET_EPOCH_CHANGED' : 'AUTHORIZATION_CHANGED' });
        }
        const runtime: Runtime = { context: copy.context, fence, cursor: copy.cursor, ready: true, dataRevision: ticket.dataRevision + 1 };
        await tx.put('metadata', runtime, runtimeKey(scope));
        await tx.delete('metadata', 'download:' + scope);
        for (let page = 0; page < pages.length; page++) await tx.delete('snapshotPages', [copy.generation, page]);
        return { context: copy.context, fence, cursor: copy.cursor };
      }, { durability: 'strict', tags: ['sync:ready'] });
    },

    async enqueue<I>(captured: CapturedRuntime, operation: SyncOperation<I>): Promise<number> {
      const copy = checkedClone(operation);
      await verifyOperation(copy, options.hashFormat);
      assertOperationContext(copy, captured.context);
      const time = checkedTime(now);
      return db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const existing = await findOperation(tx, copy.operationId);
        if (existing) {
          if (existing.operation.payloadHash !== copy.payloadHash) throw new SyncError('OPERATION_HASH_MISMATCH');
          return existing.localSequence!;
        }
        for (const dependency of copy.dependencies) {
          const parent = await findOperation(tx, dependency);
          if (!parent || scopeKey(parent.operation.scope) !== scopeKey(copy.scope) || parent.operation.deviceId !== copy.deviceId) throw new SyncError('DEPENDENCY_REJECTED');
        }
        return await tx.add('outbox', { operation: copy, state: 'pending', attempts: 0, nextAttemptAt: time,
          authorizationGenerationAtCapture: captured.context.authorizationGeneration }) as number;
      }, { durability: 'strict', tags: ['sync:pending'] });
    },

    async read(captured: CapturedRuntime) {
      return db.read(['metadata', 'records', 'outbox', 'mappings'], async tx => {
        await current(tx, captured, false);
        const scope = scopeKey(captured.context.scope);
        return {
          records: (await tx.getAll('records')).filter(row => row.scope === scope),
          pending: (await tx.getAll('outbox')).filter(row => scopeKey(row.operation.scope) === scope),
          mappings: await tx.getAll('mappings'),
        };
      });
    },

    async markSending(captured: CapturedRuntime, operationId: string): Promise<PendingOperation> {
      const time = checkedTime(now);
      return db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const row = await findOperation(tx, operationId);
        if (!row) throw new SyncError('OPERATION_NOT_FOUND');
        assertOperationContext(row.operation, captured.context);
        if (!['pending', 'sending', 'uncertain'].includes(row.state)) throw new SyncError('OPERATION_FINAL');
        const next: PendingOperation = { ...row, state: 'sending', attempts: row.attempts + 1, firstSentAt: row.firstSentAt ?? new Date(time).toISOString() };
        await tx.put('outbox', next);
        return next;
      }, { durability: 'strict', tags: ['sync:sending'] });
    },

    async markUncertain(captured: CapturedRuntime, operationId: string, nextAttemptAt: number) {
      if (!Number.isSafeInteger(nextAttemptAt) || nextAttemptAt < checkedTime(now)) throw new SyncError('PAYLOAD_INVALID');
      await db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const row = await findOperation(tx, operationId);
        if (!row || row.state !== 'sending') return;
        assertOperationContext(row.operation, captured.context);
        await tx.put('outbox', { ...row, state: 'uncertain', nextAttemptAt });
      }, { durability: 'strict', tags: ['sync:uncertain'] });
    },

    async quarantine(captured: CapturedRuntime, operationId: string, code: string) {
      await db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const row = await findOperation(tx, operationId);
        if (!row || row.state === 'acknowledged') return;
        assertOperationContext(row.operation, captured.context);
        await tx.put('outbox', { ...row, state: 'quarantined', lastErrorCode: code });
      }, { durability: 'strict', tags: ['sync:quarantined'] });
    },

    /** Explicit recovery after fresh authorization. Identity/epoch/hash-expiry failures need reconciliation instead. */
    async resume(captured: CapturedRuntime, operationId: string) {
      const time = checkedTime(now);
      await db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const row = await findOperation(tx, operationId);
        if (!row || row.state !== 'quarantined') throw new SyncError('OPERATION_FINAL');
        assertOperationContext(row.operation, captured.context);
        if (!['AUTHORIZATION_CHANGED', 'RESOURCE_FORBIDDEN', 'OFFLINE_ACCESS_REVOKED', 'PROTOCOL_UNSUPPORTED', 'SCHEMA_UNSUPPORTED'].includes(row.lastErrorCode ?? '')) throw new SyncError('RECONCILIATION_REQUIRED');
        await tx.put('outbox', { ...row, state: row.firstSentAt ? 'uncertain' : 'pending', nextAttemptAt: time });
      }, { durability: 'strict', tags: ['sync:resumed'] });
    },

    async applyReceipt(captured: CapturedRuntime, receipt: OperationReceipt) {
      const copy = checkedClone(receipt);
      if (copy.outcome.state === 'acknowledged') copy.outcome.records.forEach(assertRecord);
      await db.transaction(['metadata', 'outbox', 'records', 'mappings'], async tx => {
        const runtime = await current(tx, captured, true);
        const row = await findOperation(tx, copy.operationId);
        if (!row || row.operation.payloadHash !== copy.payloadHash) throw new SyncError('OPERATION_HASH_MISMATCH');
        assertOperationContext(row.operation, captured.context);
        if (row.state === 'acknowledged') return;
        if (!['sending', 'uncertain'].includes(row.state)) throw new SyncError('OPERATION_NOT_SENT');
        if (!['acknowledged', 'conflict', 'rejected', 'blocked_dependency'].includes(copy.outcome.state)) throw new SyncError('PAYLOAD_INVALID');
        if (copy.outcome.state === 'acknowledged') {
          const scope = scopeKey(captured.context.scope);
          for (const record of copy.outcome.records) await tx.putIfNewer('records', { ...record, scope }, 'revision');
          for (const [localReference, canonicalId] of Object.entries(copy.outcome.mappings)) {
            const old = await tx.get('mappings', localReference);
            if (typeof canonicalId !== 'string' || !canonicalId || (old && old.canonicalId !== canonicalId)) throw new SyncError('MAPPING_CONFLICT');
            await tx.put('mappings', { localReference, canonicalId });
          }
          await tx.put('metadata', { ...runtime, dataRevision: runtime.dataRevision + 1 }, runtimeKey(scope));
        }
        await tx.put('outbox', { ...row, state: copy.outcome.state, outcome: copy.outcome });
      }, { durability: 'strict', tags: ['sync:receipt'] });
    },

    /** Each supplied group is complete; transport fragments must be staged first. */
    async applyChanges(captured: CapturedRuntime, expectedCursor: string | null, nextCursor: string, records: readonly ReplicaRecord[]) {
      const copy = checkedClone(records); copy.forEach(assertRecord);
      if (typeof nextCursor !== 'string' || !nextCursor) throw new SyncError('INVALID_CURSOR');
      await db.transaction(['metadata', 'records'], async tx => {
        const runtime = await current(tx, captured, false);
        if (runtime.cursor !== expectedCursor) throw new SyncError('STALE_CURSOR');
        const scope = scopeKey(captured.context.scope);
        for (const record of copy) await tx.putIfNewer('records', { ...record, scope }, 'revision');
        await tx.put('metadata', { ...runtime, cursor: nextCursor, dataRevision: runtime.dataRevision + 1 }, runtimeKey(scope));
      }, { durability: 'strict', tags: ['sync:changes'] });
    },

    async cancel(captured: CapturedRuntime, operationId: string) {
      await db.transaction(['metadata', 'outbox'], async tx => {
        await current(tx, captured, true);
        const row = await findOperation(tx, operationId);
        if (!row) throw new SyncError('OPERATION_NOT_FOUND');
        assertOperationContext(row.operation, captured.context);
        if (row.firstSentAt || !['pending', 'blocked_dependency'].includes(row.state)) throw new SyncError('OPERATION_UNCERTAIN');
        if ((await tx.getAll('outbox')).some(child => child.state !== 'cancelled' && child.operation.dependencies.includes(operationId))) throw new SyncError('DEPENDENCY_PENDING');
        await tx.put('outbox', { ...row, state: 'cancelled' });
      }, { durability: 'strict', tags: ['sync:cancelled'] });
    },
  };
}

export type SyncReplica = Awaited<ReturnType<typeof openSyncReplica>>;

export interface SyncTransport {
  lookup(operation: SyncOperation): Promise<{ state: 'known'; receipt: OperationReceipt } | { state: 'not_found' | 'expired' }>;
  push(operation: SyncOperation): Promise<OperationReceipt>;
}

/** Foreground runner only. Callers schedule backoff; no hidden timer or online heuristic. */
export async function synchronizeReplica(options: {
  replica: SyncReplica; captured: CapturedRuntime; transport: SyncTransport;
  locks?: Pick<LockManager, 'request'>; now?: () => number;
}): Promise<void> {
  const locks = options.locks ?? globalThis.navigator?.locks;
  if (!locks) throw new SyncError('COORDINATION_UNAVAILABLE');
  const { replica, captured, transport } = options;
  const now = options.now ?? Date.now;
  const lockName = 'najm-sync:' + canonicalJson([captured.context.installationId, captured.context.accountId, scopeKey(captured.context.scope)]);
  await locks.request(lockName, async () => {
    const { pending } = await replica.read(captured);
    for (const row of pending) {
      if (!['pending', 'sending', 'uncertain'].includes(row.state) || row.nextAttemptAt > checkedTime(now)) continue;
      const state = await replica.read(captured);
      if (row.operation.dependencies.some(id => state.pending.find(parent => parent.operation.operationId === id)?.state !== 'acknowledged')) continue;
      const sending = await replica.markSending(captured, row.operation.operationId);
      try {
        let receipt: OperationReceipt | undefined;
        if (row.firstSentAt || row.state !== 'pending') {
          const found = await transport.lookup(row.operation);
          if (found.state === 'expired') throw new SyncError('OPERATION_EXPIRED');
          if (found.state === 'known') receipt = found.receipt;
        }
        receipt ??= await transport.push(sending.operation);
        await replica.applyReceipt(captured, receipt);
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (['OPERATION_EXPIRED', 'OPERATION_HASH_MISMATCH', 'DATASET_EPOCH_CHANGED', 'INSTALLATION_MISMATCH',
          'AUTHORIZATION_CHANGED', 'RESOURCE_FORBIDDEN', 'OFFLINE_ACCESS_REVOKED', 'PROTOCOL_UNSUPPORTED', 'SCHEMA_UNSUPPORTED'].includes(code)) {
          await replica.quarantine(captured, row.operation.operationId, code);
          throw error;
        }
        // Retain the exact frozen operation; never infer failure from a lost reply.
        const retryAt = checkedTime(now) + Math.min(60000, 2000 * 2 ** Math.min(sending.attempts - 1, 5));
        await replica.markUncertain(captured, row.operation.operationId, retryAt);
        throw error;
      }
    }
  });
}
