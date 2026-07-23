import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { eq, sql } from 'drizzle-orm';
import { RAG_SCHEMA } from '../tokens';
import type { RagSchema } from '../config';

@Repository()
export class RoutingSettingsRepository {
  @DB() declare db: any;
  @Inject(RAG_SCHEMA) private schema!: RagSchema;
  private schemaChecked = false;

  private table() {
    const t = this.schema.chatbotRoutingSettings;
    if (!t) throw new Error('chatbot_routing_settings schema missing');
    return t;
  }

  async get(): Promise<any | null> {
    await this.ensureColumns();
    const table = this.table();
    const [row] = await this.db.select().from(table).limit(1);
    return row ?? null;
  }

  async create(data: Record<string, any>): Promise<any> {
    await this.ensureColumns();
    const table = this.table();
    const [row] = await this.db.insert(table).values(data).returning();
    return row;
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    await this.ensureColumns();
    const table = this.table();
    const [row] = await this.db
      .update(table)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(table.id, id))
      .returning();
    return row;
  }

  private async ensureColumns(): Promise<void> {
    if (this.schemaChecked) return;
    this.schemaChecked = true;

    if (typeof this.db.all === 'function') {
      const columns = await this.db.all(sql`PRAGMA table_info(chatbot_routing_settings)`);
      const list = Array.isArray(columns) ? columns : columns?.rows ?? [];
      if (list.length === 0) return;
      if (!list.some((column: any) => column.name === 'enable_knowledge')) {
        await this.db.run(sql`ALTER TABLE chatbot_routing_settings ADD COLUMN enable_knowledge INTEGER NOT NULL DEFAULT 1`);
      }
      if (!list.some((column: any) => column.name === 'allowed_langs')) {
        await this.db.run(sql`ALTER TABLE chatbot_routing_settings ADD COLUMN allowed_langs TEXT`);
      }
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`
        ALTER TABLE chatbot_routing_settings
        ADD COLUMN IF NOT EXISTS enable_knowledge boolean NOT NULL DEFAULT true
      `);
      await this.db.execute(sql`
        ALTER TABLE chatbot_routing_settings
        ADD COLUMN IF NOT EXISTS allowed_langs jsonb
      `);
    }
  }
}
