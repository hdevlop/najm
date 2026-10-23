import { openSyncReplica, synchronizeReplica, type CapturedRuntime, type SyncReplica } from '../../dist/sync/client.mjs';
import { canonicalJson, sealOperation, sha256, SyncError, type ReplicaRecord, type SyncContext } from '../../dist/sync/contracts.mjs';

const context: SyncContext = { installationId: 'installation-1', installationEpoch: 'epoch-1', accountId: 'teacher-a',
  scope: { kind: 'year', yearLabel: '2026-2027' }, authorizationGeneration: 'generation-1', replicaSchemaVersion: 1 };
const hashFormat = 'fixture-json-v1-sha256';
let replica: SyncReplica;
let captured: CapturedRuntime;
async function json(path: string, body?: unknown) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw new SyncError(value.code ?? 'SERVER_UNAVAILABLE');
  return value;
}
async function open(name = 'native-sync-proof') {
  replica = await openSyncReplica({ name, identity: context, hashFormat,
    canAccess: (policy: any, ctx) => policy?.allow === true && policy.accountId === ctx.accountId && policy.generation === ctx.authorizationGeneration });
  try { captured = await replica.capture(context); } catch { /* Explicit prepare is required for a new device. */ }
}
async function prepare() {
  await replica.database.write([{ put: 'metadata', key: 'access', value: { allow: true, accountId: context.accountId, generation: context.authorizationGeneration } }]);
  const ticket = await replica.beginSnapshot(context);
  const data = await json('/api/bootstrap');
  const records: ReplicaRecord[] = data.records;
  const manifest = { context, generation: crypto.randomUUID(), cursor: data.cursor, expiresAt: Date.now() + 60000,
    pageChecksums: [await sha256(canonicalJson(records))], recordCount: records.length };
  await replica.stageSnapshotPage(ticket, manifest, 0, records);
  captured = await replica.activateSnapshot(ticket, manifest);
}
async function queue(status: string, expectedRevision?: string) {
  const state = await replica.read(captured);
  const record = state.records.find(row => row.id === 'browser-mark');
  const operation = await sealOperation({ installationId: context.installationId, installationEpoch: context.installationEpoch, accountId: context.accountId,
    scope: context.scope, operationId: crypto.randomUUID(), deviceId: 'browser-device', protocolVersion: 1, hashFormat,
    dependencies: [], createdAtClient: new Date().toISOString(), intent: { command: 'correct', id: 'browser-mark', status, expectedRevision: expectedRevision ?? record?.revision } });
  await replica.enqueue(captured, operation);
  return operation;
}
async function synchronize() {
  await synchronizeReplica({ replica, captured, transport: {
    lookup: operation => json('/api/lookup', operation), push: operation => json('/api/push', operation),
  } });
}
const api = { open, prepare, queue, synchronize, state: () => replica.read(captured),
  async retryNow() {
    // The proof advances only retry scheduling, never immutable intent or firstSentAt.
    await replica.database.transaction(['outbox'], async tx => {
      for (const row of await tx.getAll('outbox')) if (row.state === 'uncertain') await tx.put('outbox', { ...row, nextAttemptAt: 0 });
    });
  },
  close: () => replica.close(),
};

if (typeof document === 'undefined') {
  self.onmessage = async (event: MessageEvent) => {
    try { await open(event.data.name); await synchronize(); self.postMessage({ ok: true, state: await api.state() }); }
    catch (error) { self.postMessage({ ok: false, error: String(error) }); }
    finally { replica?.close(); }
  };
} else {
  await open(new URL(location.href).searchParams.get('database') ?? undefined);
  Object.assign(window, { proof: api });
  document.querySelector('h1')!.textContent = 'Native durable sync proof ready';
}
