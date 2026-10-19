import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { sealOperation, SyncError, type SyncContext, type SyncOperation } from '../../dist/sync/contracts.mjs';
import { applyOperation, lookupOperation, CommandRefusal } from '../../dist/sync/server.mjs';
import { createCaptureSql, createPostgresOperationStore, syncRows, type SyncSqlTransaction } from '../../dist/sync/pg.mjs';
import { browserProof } from './browsers';

const runId = crypto.randomUUID();
const database = 'najm_sync_proof_' + runId.replaceAll('-', '');
const adminUrl = new URL(process.env.OFFLINE_PROOF_ADMIN_URL ?? process.env.DB_URL ?? '');
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(adminUrl.hostname)) throw Error('A loopback disposable PostgreSQL proof is required');
adminUrl.pathname = '/postgres';
const admin = postgres(adminUrl.toString(), { max: 1, prepare: false, onnotice: () => {} });
const proofUrl = new URL(adminUrl); proofUrl.pathname = '/' + database;
let connection: ReturnType<typeof postgres> | undefined;
let created = false;
const report = { runId, database, date: new Date().toISOString(), productionDatabaseContacted: false, dropped: false, checks: [] as { name: string; status: string }[], browsers: [] as unknown[] };
const context: SyncContext = { installationId: 'installation-1', installationEpoch: 'epoch-1', accountId: 'teacher-a',
  scope: { kind: 'year', yearLabel: '2026-2027' }, authorizationGeneration: 'generation-1', replicaSchemaVersion: 1 };
const hashFormat = 'fixture-json-v1-sha256';
async function test(name: string, action: () => Promise<void>) {
  try { await action(); report.checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { report.checks.push({ name, status: 'FAIL' }); throw error; }
}
try {
  await admin.unsafe(`CREATE DATABASE "${database}"`); created = true;
  connection = postgres(proofUrl.toString(), { max: 8, prepare: false, onnotice: () => {} });
  const [identity] = await connection`select current_database() as name`; assert.equal(identity.name, database);
  await connection.unsafe(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  await connection`insert into proof_marker values (${runId})`;
  await connection.unsafe(createCaptureSql({ installationId: context.installationId, tables: [
    { table: 'attendance', entity: 'attendance', keyColumn: 'id', yearColumn: 'academic_year_id', projection: { id: 'id', status: 'status', academicYearId: 'academic_year_id' } },
    { table: 'attendance_history', entity: 'attendance_history', keyColumn: 'id', projection: { id: 'id', attendanceId: 'attendance_id', oldStatus: 'old_status', newStatus: 'new_status' } },
  ] }));
  const db = drizzle(connection);
  const active = new AsyncLocalStorage<SyncSqlTransaction>();
  const store = createPostgresOperationStore(work => db.transaction(tx => active.run(tx as unknown as SyncSqlTransaction, () => work(tx as unknown as SyncSqlTransaction))));
  const unsigned = (id = crypto.randomUUID()) => ({ installationId: context.installationId, installationEpoch: context.installationEpoch, accountId: context.accountId,
    scope: context.scope, operationId: id, deviceId: 'device-a', protocolVersion: 1 as const, hashFormat, dependencies: [],
    createdAtClient: new Date().toISOString(), intent: { command: 'mark', status: 'absent' } });
  let allowed = true;
  const authorize = async () => { if (!allowed) throw new SyncError('RESOURCE_FORBIDDEN'); return context; };
  let calls = 0;
  const apply = async (operation: SyncOperation) => {
    calls++;
    const id = operation.operationId;
    await active.getStore()!.execute(sql`insert into attendance (id, status, academic_year_id, secret) values (${id}, 'absent', 'year-1', 'must not replicate')`);
    const [row] = syncRows<{ revision: string }>(await active.getStore()!.execute(sql`select revision::text from sync_record_versions where entity = 'attendance' and record_id = ${id}`));
    return { state: 'acknowledged' as const, result: { id }, records: [{ entity: 'attendance', id, revision: row.revision, deleted: false, value: { id, status: 'absent' } }], mappings: {} };
  };
  const run = (operation: SyncOperation, mutation = apply) => applyOperation({ store, operation, hashFormat, authorize, apply: mutation });
  let accepted: Awaited<ReturnType<typeof sealOperation>>;

  await test('concurrent copies and lost-response retry produce one canonical mutation/result', async () => {
    accepted = await sealOperation(unsigned());
    const [a, b] = await Promise.all([run(accepted), run(accepted)]); assert.deepEqual(a, b); assert.equal(calls, 1);
    assert.deepEqual(await run(accepted), a); assert.equal(calls, 1);
    const [count] = await connection!`select count(*)::int as n from attendance where id = ${accepted.operationId}`; assert.equal(count.n, 1);
  });
  await test('same operation ID with a different sealed hash is refused', async () => {
    const changed = await sealOperation({ ...unsigned(accepted.operationId), intent: { command: 'mark', status: 'late' } });
    await assert.rejects(run(changed), /OPERATION_HASH_MISMATCH/); assert.equal(calls, 1);
  });
  await test('current authorization is required even for an already accepted operation', async () => {
    allowed = false; await assert.rejects(run(accepted), /RESOURCE_FORBIDDEN/); allowed = true; assert.equal(calls, 1);
  });
  await test('a domain/history second-write failure rolls back domain, revision, journal and outcome', async () => {
    const op = await sealOperation(unsigned());
    await assert.rejects(run(op, async operation => { await apply(operation); await active.getStore()!.execute(sql`insert into attendance_history (id, attendance_id, new_status) values ('invalid', ${op.operationId}, null)`); return apply(operation); }));
    for (const table of ['attendance', 'sync_record_versions', 'sync_changes', 'sync_operations']) {
      const key = table === 'attendance' ? 'id' : table === 'sync_operations' ? 'operation_id' : 'record_id';
      const [row] = await connection!.unsafe(`select count(*)::int as n from ${table} where ${key} = $1`, [op.operationId]); assert.equal(row.n, 0);
    }
  });
  await test('reviewable conflict rolls back its partial domain savepoint before durable refusal', async () => {
    const op = await sealOperation(unsigned());
    const refused = await run(op, async operation => { await apply(operation); throw new CommandRefusal({ state: 'conflict', code: 'RECORD_CONFLICT' }); });
    assert.equal(refused.outcome.state, 'conflict');
    const [row] = await connection!`select count(*)::int as n from attendance where id = ${op.operationId}`; assert.equal(row.n, 0);
    assert.deepEqual(await run(op), refused);
  });
  await test('ordinary SQL insert/upsert/delete captures only committed AFTER ROW effects and explicit fields', async () => {
    await connection!`insert into attendance values ('ordinary', 'present', 'year-1', 'secret')`;
    await connection!`insert into attendance values ('ordinary', 'late', 'year-1', 'secret2') on conflict (id) do update set status = excluded.status`;
    await connection!`delete from attendance where id = 'ordinary'`;
    const rows = await connection!`select revision::text, deleted, value from sync_changes where record_id = 'ordinary' order by position, ordinal`;
    assert.equal(rows.length, 3); assert.deepEqual(rows.map(row => row.revision), ['1', '2', '3']); assert.equal(rows[2].deleted, true);
    assert(!JSON.stringify(rows).includes('secret'));
  });
  await test('changed year emits old-scope tombstone and new-scope canonical row in one group', async () => {
    await connection!`insert into attendance values ('move-year', 'present', 'year-1', null)`;
    await connection!`update attendance set academic_year_id = 'year-2' where id = 'move-year'`;
    const rows = await connection!`select position::text, scope, deleted, revision::text from sync_changes where record_id = 'move-year' order by ordinal`;
    assert.equal(rows.length, 3); assert.equal(rows[1].position, rows[2].position); assert.equal(rows[1].revision, rows[2].revision);
    assert.equal(rows[1].scope, 'year-id:year-1'); assert.equal(rows[1].deleted, true); assert.equal(rows[2].scope, 'year-id:year-2'); assert.equal(rows[2].deleted, false);
  });
  await test('unresolved years, record-ID mutation and truncate fail closed', async () => {
    await assert.rejects(connection!.unsafe('TRUNCATE attendance'), /TRUNCATE/);
    await assert.rejects(connection!`update attendance set id = 'different' where id = ${accepted.operationId}`, /immutable/);
  });
  await test('unknown/rejected dependencies never invoke the mutation or create a terminal outcome', async () => {
    const op = await sealOperation({ ...unsigned(), dependencies: [crypto.randomUUID()] });
    const before = calls; await assert.rejects(run(op), /DEPENDENCY_PENDING/); assert.equal(calls, before);
    const [row] = await connection!`select count(*)::int as n from sync_operations where operation_id = ${op.operationId}`; assert.equal(row.n, 0);
  });
  await test('predecessor mappings cannot be borrowed from another device identity', async () => {
    const op = await sealOperation({ ...unsigned(), deviceId: 'foreign-device', dependencies: [accepted.operationId] });
    const before = calls; await assert.rejects(run(op), /DEPENDENCY_REJECTED/); assert.equal(calls, before);
  });

  await connection!`insert into attendance values ('browser-mark', 'present', 'year-1', 'private field')`;
  const correction = async (operation: SyncOperation) => {
    const intent = operation.intent as { id?: string; status?: string; expectedRevision?: string };
    if (intent.id !== 'browser-mark' || !['present', 'absent', 'late'].includes(intent.status ?? '')) throw new CommandRefusal({ state: 'rejected', code: 'PAYLOAD_INVALID' });
    const [before] = syncRows<{ status: string; revision: string }>(await active.getStore()!.execute(sql`select a.status, v.revision::text
      from attendance a join sync_record_versions v on v.entity = 'attendance' and v.record_id = a.id
      where a.id = ${intent.id}`));
    if (before?.revision !== intent.expectedRevision) throw new CommandRefusal({ state: 'conflict', code: 'RECORD_CONFLICT' });
    await active.getStore()!.execute(sql`update attendance set status = ${intent.status!} where id = ${intent.id}`);
    await active.getStore()!.execute(sql`insert into attendance_history (id, attendance_id, old_status, new_status)
      values (${operation.operationId}, ${intent.id}, ${before.status}, ${intent.status!})`);
    const [after] = syncRows<{ revision: string }>(await active.getStore()!.execute(sql`select revision::text from sync_record_versions where entity = 'attendance' and record_id = ${intent.id}`));
    return { state: 'acknowledged' as const, result: { id: intent.id }, records: [{ entity: 'attendance', id: intent.id, revision: after.revision, deleted: false, value: { id: intent.id, status: intent.status } }], mappings: {} };
  };
  report.browsers = await browserProof({
    push: operation => applyOperation({ store, operation, hashFormat, authorize, apply: correction }),
    lookup: operation => lookupOperation({ store, operation, hashFormat, authorize }),
    bootstrap: async () => {
      const [row] = await connection!`select a.id, a.status, v.revision::text from attendance a
        join sync_record_versions v on v.entity = 'attendance' and v.record_id = a.id where a.id = 'browser-mark'`;
      return { cursor: 'fixture-current', records: [{ entity: 'attendance', id: row.id, revision: row.revision, deleted: false, value: { id: row.id, status: row.status } }] };
    },
    stats: async () => {
      const [row] = await connection!`select count(*)::int as history from attendance_history`;
      return row;
    },
  });
} finally {
  if (connection) {
    const markers = await connection`select run_id from proof_marker`;
    if (markers.length !== 1 || markers[0].run_id !== runId) throw Error('Proof marker mismatch; refusing cleanup');
    await connection.end({ timeout: 5 });
    if (created && /^najm_sync_proof_[a-f0-9]{32}$/.test(database)) {
      await admin.unsafe(`DROP DATABASE "${database}"`); report.dropped = true;
    }
  }
  await admin.end({ timeout: 5 });
  await mkdir(new URL('./.output/', import.meta.url), { recursive: true });
  await writeFile(new URL('./.output/results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
