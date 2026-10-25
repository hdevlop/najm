import { and, eq, lt } from 'drizzle-orm';
import { bigserial, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { ReplicaRecord, SyncContext } from 'najm-database/sync/contracts';
import { OFFLINE_SNAPSHOT_TTL_MS, type SnapshotStore } from './server';

/** Immutable, short-lived downloads; the sequence is a durable read baseline, not a write revision. */
export const offlineSnapshots = pgTable('offline_read_snapshots', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  accountId: text('account_id').notNull(),
  context: jsonb('context').$type<SyncContext>().notNull(),
  pages: jsonb('pages').$type<ReplicaRecord[][]>().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
}, table => [index('offline_read_snapshots_account_idx').on(table.accountId)]);
/** Spread into the app's Drizzle schema, like `syncSchema`. */
export const offlineSchema = { offlineSnapshots };

// Any Postgres driver's Drizzle database, or a transaction of one.
type Database = Pick<PgDatabase<any, any, any>, 'insert' | 'update' | 'select' | 'delete'>;
/**
 * The snapshot store over `offlineSnapshots`. `db` is read on every call, so
 * an injected repository database follows the current transaction.
 */
export function createPostgresSnapshotStore(db: () => Database, ttlMs = OFFLINE_SNAPSHOT_TTL_MS): SnapshotStore {
  return {
    async create(accountId, context) {
      const [row] = await db().insert(offlineSnapshots).values({ accountId, context, pages: [],
        expiresAt: new Date(Date.now() + ttlMs).toISOString() }).returning();
      return row;
    },
    async save(id, pages) {
      await db().update(offlineSnapshots).set({ pages }).where(eq(offlineSnapshots.id, BigInt(id)));
    },
    async find(id, accountId) {
      const [row] = await db().select().from(offlineSnapshots)
        .where(and(eq(offlineSnapshots.id, BigInt(id)), eq(offlineSnapshots.accountId, accountId)));
      return row;
    },
    async cleanup() {
      await db().delete(offlineSnapshots).where(lt(offlineSnapshots.expiresAt, new Date().toISOString()));
    },
  };
}
