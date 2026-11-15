import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RAG_CONFIG, RAG_SCHEMA } from '../tokens';
import type { RagMergedConfig, RagSchema } from '../config';
import type { UnmatchedMiss, UnmatchedQueryRow } from './UnmatchedQueryDto';

@Repository()
export class UnmatchedQueryRepository {
  @DB() private db: any;
  @Inject(RAG_SCHEMA) private schema!: RagSchema;
  @Inject(RAG_CONFIG) private config!: RagMergedConfig;
  private ready = false;

  private table() {
    return this.schema.chatbotUnmatchedQueries;
  }

  async record(data: UnmatchedMiss): Promise<void> {
    const table = this.table();
    if (!table) return;
    await this.ensureTable();

    const [existing] = await this.db
      .select()
      .from(table)
      .where(eq(table.normalized, data.normalized))
      .limit(1);

    if (existing) {
      await this.db
        .update(table)
        .set({
          query: data.query,
          score: String(data.score),
          threshold: String(data.threshold),
          source: data.source ?? 'router',
          nearestTool: data.nearestTool ?? null,
          occurrenceCount: (existing.occurrenceCount ?? 1) + 1,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(table.id, existing.id));
      return;
    }

    await this.db.insert(table).values({
      id: nanoid(12),
      query: data.query,
      normalized: data.normalized,
      score: String(data.score),
      threshold: String(data.threshold),
      source: data.source ?? 'router',
      nearestTool: data.nearestTool ?? null,
      occurrenceCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async list(limit = 100): Promise<UnmatchedQueryRow[]> {
    const table = this.table();
    if (!table) return [];
    await this.ensureTable();
    return this.db.select().from(table).orderBy(desc(table.createdAt)).limit(limit);
  }

  async count(): Promise<number> {
    const table = this.table();
    if (!table) return 0;
    await this.ensureTable();
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(row?.count ?? 0);
  }

  async findById(id: string): Promise<UnmatchedQueryRow | null> {
    const table = this.table();
    if (!table) return null;
    await this.ensureTable();
    const [row] = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return row ?? null;
  }

  async deleteById(id: string): Promise<void> {
    const table = this.table();
    if (!table) return;
    await this.ensureTable();
    await this.db.delete(table).where(eq(table.id, id));
  }

  /**
   * Deletes entries last seen before `cutoff`; returns how many were removed.
   * On SQLite, inserts store ISO text and updates store CURRENT_TIMESTAMP text,
   * so both sides go through datetime() to compare as times, not strings.
   */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const table = this.table();
    if (!table) return 0;
    await this.ensureTable();
    const lastSeen = sql`coalesce(${table.updatedAt}, ${table.createdAt})`;
    const condition = this.config.dialect === 'sqlite'
      ? sql`datetime(${lastSeen}) < datetime(${cutoff.toISOString()})`
      : sql`${lastSeen} < ${cutoff.toISOString()}`;
    const deleted = await this.db.delete(table).where(condition).returning({ id: table.id });
    return Array.isArray(deleted) ? deleted.length : 0;
  }

  private ensuring: Promise<void> | null = null;

  /**
   * Creates the table, and adds `nearest_tool` to a table made by an earlier
   * release. Concurrent first calls share one check; a failed check is retried.
   */
  private ensureTable(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.config?.ensureSchema === false) { this.ready = true; return Promise.resolve(); }
    this.ensuring ??= this.ensureTableOnce()
      .then(() => { this.ready = true; })
      .finally(() => { this.ensuring = null; });
    return this.ensuring;
  }

  private async ensureTableOnce(): Promise<void> {
    if (this.config.dialect === 'sqlite' && typeof this.db.run === 'function') {
      await this.db.run(sql`
        CREATE TABLE IF NOT EXISTS chatbot_unmatched_queries (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          normalized TEXT NOT NULL UNIQUE,
          score TEXT NOT NULL,
          threshold TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'router',
          nearest_tool TEXT,
          occurrence_count INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      if (typeof this.db.all === 'function') {
        const columns = await this.db.all(sql`PRAGMA table_info(chatbot_unmatched_queries)`);
        const list = Array.isArray(columns) ? columns : columns?.rows ?? [];
        if (!list.some((column: any) => column.name === 'nearest_tool')) {
          await this.db.run(sql`ALTER TABLE chatbot_unmatched_queries ADD COLUMN nearest_tool TEXT`);
        }
      }
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chatbot_unmatched_queries (
          id text PRIMARY KEY,
          query text NOT NULL,
          normalized text NOT NULL UNIQUE,
          score text NOT NULL,
          threshold text NOT NULL,
          source text NOT NULL DEFAULT 'router',
          nearest_tool text,
          occurrence_count integer NOT NULL DEFAULT 1,
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        ALTER TABLE chatbot_unmatched_queries
        ADD COLUMN IF NOT EXISTS nearest_tool text
      `);
    }
  }
}
