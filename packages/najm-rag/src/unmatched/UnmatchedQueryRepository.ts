import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RAG_CONFIG, RAG_SCHEMA } from '../tokens';
import type { RagMergedConfig, RagSchema } from '../config';
import type { UnmatchedQueryRow } from './UnmatchedQueryDto';

@Repository()
export class UnmatchedQueryRepository {
  @DB() private db: any;
  @Inject(RAG_SCHEMA) private schema!: RagSchema;
  @Inject(RAG_CONFIG) private config!: RagMergedConfig;
  private ready = false;

  private table() {
    return this.schema.chatbotUnmatchedQueries;
  }

  async record(data: {
    query: string;
    normalized: string;
    score: number;
    threshold: number;
    source?: string;
  }): Promise<void> {
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

  private async ensureTable(): Promise<void> {
    if (this.ready) return;
    this.ready = true;

    if (this.config.dialect === 'sqlite' && typeof this.db.run === 'function') {
      await this.db.run(sql`
        CREATE TABLE IF NOT EXISTS chatbot_unmatched_queries (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          normalized TEXT NOT NULL UNIQUE,
          score TEXT NOT NULL,
          threshold TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'router',
          occurrence_count INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
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
          occurrence_count integer NOT NULL DEFAULT 1,
          created_at timestamp DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
  }
}
