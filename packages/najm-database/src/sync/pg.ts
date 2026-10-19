/** Server-only PostgreSQL schema and transaction adapter. Never import from a browser. */
import { sql, type SQL } from 'drizzle-orm';
import { bigint, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { SyncError, scopeKey, type OperationReceipt, type SyncContext } from './contracts';
import type { OperationStore, OperationTransaction } from './server';
export { createCaptureSql, type CaptureTable } from './captureSql';

export const syncInstallations = pgTable('sync_installations', {
  id: text('id').primaryKey(), epoch: text('epoch').notNull(),
});
export const syncCounters = pgTable('sync_counters', {
  installationId: text('installation_id').primaryKey().references(() => syncInstallations.id),
  position: bigint('position', { mode: 'bigint' }).notNull().default(0n),
});
export const syncOperations = pgTable('sync_operations', {
  installationId: text('installation_id').notNull().references(() => syncInstallations.id),
  accountId: text('account_id').notNull(), operationId: text('operation_id').notNull(),
  deviceId: text('device_id').notNull(),
  installationEpoch: text('installation_epoch').notNull(), scope: text('scope').notNull(),
  payloadHash: text('payload_hash').notNull(), outcome: jsonb('outcome').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.installationId, table.accountId, table.operationId] })]);
export const syncRecordVersions = pgTable('sync_record_versions', {
  installationId: text('installation_id').notNull(), entity: text('entity').notNull(), recordId: text('record_id').notNull(),
  revision: bigint('revision', { mode: 'bigint' }).notNull(),
}, table => [primaryKey({ columns: [table.installationId, table.entity, table.recordId] })]);
export const syncChanges = pgTable('sync_changes', {
  installationId: text('installation_id').notNull(), position: bigint('position', { mode: 'bigint' }).notNull(),
  ordinal: bigint('ordinal', { mode: 'bigint' }).generatedAlwaysAsIdentity(),
  entity: text('entity').notNull(), recordId: text('record_id').notNull(), scope: text('scope').notNull(),
  revision: bigint('revision', { mode: 'bigint' }).notNull(), deleted: boolean('deleted').notNull(),
  value: jsonb('value'), originOperationId: text('origin_operation_id'),
}, table => [primaryKey({ columns: [table.installationId, table.position, table.ordinal] })]);
export const syncSnapshots = pgTable('sync_snapshots', {
  id: text('id').primaryKey(), installationId: text('installation_id').notNull(), installationEpoch: text('installation_epoch').notNull(),
  accountId: text('account_id').notNull(), scope: text('scope').notNull(), authorizationGeneration: text('authorization_generation').notNull(),
  protocolVersion: integer('protocol_version').notNull(), replicaSchemaVersion: integer('replica_schema_version').notNull(),
  watermark: bigint('watermark', { mode: 'bigint' }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  manifest: jsonb('manifest').notNull(),
});
export const syncSnapshotPages = pgTable('sync_snapshot_pages', {
  snapshotId: text('snapshot_id').notNull().references(() => syncSnapshots.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(), checksum: text('checksum').notNull(), records: jsonb('records').notNull(),
}, table => [primaryKey({ columns: [table.snapshotId, table.page] })]);

export const syncSchema = { syncInstallations, syncCounters, syncOperations, syncRecordVersions, syncChanges, syncSnapshots, syncSnapshotPages };

export interface SyncSqlTransaction {
  execute(statement: SQL): Promise<unknown>;
  transaction<T>(work: (transaction: SyncSqlTransaction) => Promise<T>): Promise<T>;
}
export function syncRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)) return (result as { rows: T[] }).rows;
  throw new SyncError('DATABASE_RESULT_UNSUPPORTED');
}

/** Caller runs this at service transaction ENTRY, before row/domain locks. */
export async function acquireSyncOrder(transaction: Pick<SyncSqlTransaction, 'execute'>, installationId: string): Promise<string> {
  const existing = syncRows<{ id: string }>(await transaction.execute(sql`select id from sync_installations where id = ${installationId}`));
  if (existing.length !== 1) throw new SyncError('INSTALLATION_MISMATCH');
  // Reuse the position in nested domain calls and AFTER ROW capture.
  const state = syncRows<{ installation: string | null; position: string | null }>(await transaction.execute(sql`select
    nullif(current_setting('najm_sync.installation_id', true), '') as installation,
    nullif(current_setting('najm_sync.position', true), '') as position`))[0];
  if (state?.position) {
    if (state.installation !== installationId) throw new SyncError('INSTALLATION_MISMATCH');
    return state.position;
  }
  await transaction.execute(sql`insert into sync_counters (installation_id, position) values (${installationId}, 0) on conflict do nothing`);
  const [row] = syncRows<{ position: string }>(await transaction.execute(sql`update sync_counters set position = position + 1
    where installation_id = ${installationId} returning position::text`));
  if (!row) throw new SyncError('INSTALLATION_MISMATCH');
  await transaction.execute(sql`select set_config('najm_sync.installation_id', ${installationId}, true), set_config('najm_sync.position', ${row.position}, true)`);
  return row.position;
}

/**
 * run must bind domain repositories to this SAME transaction (e.g. Najm's
 * TransactionService.run). A second independent pool/transaction is invalid.
 */
export function createPostgresOperationStore(run: <T>(work: (transaction: SyncSqlTransaction) => Promise<T>) => Promise<T>): OperationStore {
  return {
    transaction: work => run(async transaction => {
      const port: OperationTransaction = {
        async lock(context, operationId) {
          await acquireSyncOrder(transaction, context.installationId);
          const [installation] = syncRows<{ epoch: string }>(await transaction.execute(sql`select epoch from sync_installations where id = ${context.installationId}`));
          if (installation?.epoch !== context.installationEpoch) throw new SyncError('DATASET_EPOCH_CHANGED');
          await transaction.execute(sql`select set_config('najm_sync.operation_id', ${operationId}, true)`);
        },
        async find(context, operationId) {
          const [row] = syncRows<{ device_id: string; installation_epoch: string; scope: string; payload_hash: string; outcome: OperationReceipt['outcome'] }>(
            await transaction.execute(sql`select device_id, installation_epoch, scope, payload_hash, outcome from sync_operations
              where installation_id = ${context.installationId} and account_id = ${context.accountId} and operation_id = ${operationId}`));
          if (!row) return null;
          if (row.installation_epoch !== context.installationEpoch) throw new SyncError('DATASET_EPOCH_CHANGED');
          if (row.scope !== scopeKey(context.scope)) throw new SyncError('RESOURCE_FORBIDDEN');
          return { operationId, payloadHash: row.payload_hash, outcome: row.outcome, deviceId: row.device_id };
        },
        async save(context, receipt, deviceId) {
          await transaction.execute(sql`insert into sync_operations (installation_id, account_id, operation_id, device_id, installation_epoch, scope, payload_hash, outcome)
            values (${context.installationId}, ${context.accountId}, ${receipt.operationId}, ${deviceId}, ${context.installationEpoch}, ${scopeKey(context.scope)},
              ${receipt.payloadHash}, ${JSON.stringify(receipt.outcome)}::jsonb)`);
        },
        savepoint: work => transaction.transaction(async () => work()),
      };
      return work(port);
    }),
  };
}
