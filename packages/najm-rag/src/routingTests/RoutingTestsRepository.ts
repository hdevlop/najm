import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RAG_CONFIG, RAG_SCHEMA } from '../tokens';
import type { RagMergedConfig, RagSchema } from '../config';
import type { RoutingTestRow, RoutingTestScore, RoutingTestStatus } from './RoutingTestsDto';

@Repository()
export class RoutingTestsRepository {
  @DB() private db: any;
  @Inject(RAG_SCHEMA) private schema!: RagSchema;
  @Inject(RAG_CONFIG) private config!: RagMergedConfig;
  private ready = false;

  private table() {
    return this.schema.chatbotRoutingTests;
  }

  async create(data: { name: string; query: string; lang?: string; expectedTools: string[] }): Promise<RoutingTestRow> {
    const table = this.table();
    if (!table) throw new Error('routing tests table not configured');
    await this.ensureTable();
    const id = nanoid(12);
    const now = new Date().toISOString();
    await this.db.insert(table).values({
      id,
      name: data.name,
      query: data.query,
      lang: data.lang ?? 'und',
      expectedTools: data.expectedTools,
      lastStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    const row = await this.findById(id);
    if (!row) throw new Error('failed to create routing test');
    return row;
  }

  async update(id: string, data: Partial<{ name: string; query: string; lang: string; expectedTools: string[] }>): Promise<RoutingTestRow | null> {
    const table = this.table();
    if (!table) return null;
    await this.ensureTable();
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) set.name = data.name;
    if (data.query !== undefined) set.query = data.query;
    if (data.lang !== undefined) set.lang = data.lang;
    if (data.expectedTools !== undefined) {
      set.expectedTools = data.expectedTools;
      set.lastStatus = 'pending';
      set.lastConfidence = null;
      set.lastActualTools = null;
      set.lastMissingTools = null;
      set.lastScores = null;
      set.lastRunAt = null;
    }
    await this.db.update(table).set(set).where(eq(table.id, id));
    return this.findById(id);
  }

  async saveResult(id: string, result: {
    status: RoutingTestStatus;
    confidence: number;
    actualTools: string[];
    missingTools: string[];
    scores: RoutingTestScore[];
  }): Promise<void> {
    const table = this.table();
    if (!table) return;
    await this.ensureTable();
    await this.db.update(table).set({
      lastStatus: result.status,
      lastConfidence: result.confidence,
      lastActualTools: result.actualTools,
      lastMissingTools: result.missingTools,
      lastScores: result.scores,
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(table.id, id));
  }

  async list(): Promise<RoutingTestRow[]> {
    const table = this.table();
    if (!table) return [];
    await this.ensureTable();
    return this.db.select().from(table).orderBy(desc(table.createdAt));
  }

  async listPaginated(opts: { limit: number; offset: number; search?: string; status?: string }): Promise<{ items: RoutingTestRow[]; total: number }> {
    const table = this.table();
    if (!table) return { items: [], total: 0 };
    await this.ensureTable();

    const filters: SQL[] = [];
    if (opts.search && opts.search.trim()) {
      const term = `%${opts.search.trim().toLowerCase()}%`;
      filters.push(sql`(LOWER(${table.name}) LIKE ${term} OR LOWER(${table.query}) LIKE ${term})`);
    }
    if (opts.status && opts.status.trim()) {
      filters.push(eq(table.lastStatus, opts.status.trim()));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const baseQuery = this.db.select().from(table);
    const items = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(desc(table.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);

    const countBase = this.db.select({ count: sql<number>`count(*)` }).from(table);
    const [countRow] = await (where ? countBase.where(where) : countBase);
    const total = Number(countRow?.count ?? 0);
    return { items, total };
  }

  async createBatch(items: Array<{ name: string; query: string; lang?: string; expectedTools: string[] }>): Promise<number> {
    const table = this.table();
    if (!table) return 0;
    await this.ensureTable();
    if (items.length === 0) return 0;
    const now = new Date().toISOString();
    const rows = items.map((item) => ({
      id: nanoid(12),
      name: item.name,
      query: item.query,
      lang: item.lang ?? 'und',
      expectedTools: item.expectedTools,
      lastStatus: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    }));
    await this.db.insert(table).values(rows);
    return rows.length;
  }

  async findById(id: string): Promise<RoutingTestRow | null> {
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

  async deleteByIds(ids: string[]): Promise<number> {
    const table = this.table();
    if (!table || ids.length === 0) return 0;
    await this.ensureTable();
    await this.db.delete(table).where(inArray(table.id, ids));
    return ids.length;
  }

  async deleteAll(): Promise<number> {
    const table = this.table();
    if (!table) return 0;
    await this.ensureTable();
    const before = await this.list();
    await this.db.delete(table);
    return before.length;
  }

  private async ensureTable(): Promise<void> {
    if (this.ready) return;
    this.ready = true;

    if (this.config.dialect === 'sqlite' && typeof this.db.run === 'function') {
      await this.db.run(sql`
        CREATE TABLE IF NOT EXISTS chatbot_routing_tests (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          query TEXT NOT NULL,
          lang TEXT NOT NULL DEFAULT 'und',
          expected_tools TEXT NOT NULL,
          last_status TEXT NOT NULL DEFAULT 'pending',
          last_confidence INTEGER,
          last_actual_tools TEXT,
          last_missing_tools TEXT,
          last_scores TEXT,
          last_run_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Backfill: add lang column on pre-existing tables. ALTER TABLE ADD COLUMN
      // is not idempotent in SQLite, so swallow "duplicate column" errors.
      try {
        await this.db.run(sql`ALTER TABLE chatbot_routing_tests ADD COLUMN lang TEXT NOT NULL DEFAULT 'und'`);
      } catch {
        // column already exists
      }
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS chatbot_routing_tests (
          id text PRIMARY KEY,
          name text NOT NULL,
          query text NOT NULL,
          lang text NOT NULL DEFAULT 'und',
          expected_tools jsonb NOT NULL,
          last_status text NOT NULL DEFAULT 'pending',
          last_confidence integer,
          last_actual_tools jsonb,
          last_missing_tools jsonb,
          last_scores jsonb,
          last_run_at timestamp,
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.db.execute(sql`
        ALTER TABLE chatbot_routing_tests
          ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'und'
      `);
    }
  }
}
