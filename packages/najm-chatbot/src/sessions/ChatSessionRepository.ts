import { Inject, Meta, Repository } from 'najm-core';
import { DB } from 'najm-database';
import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { CHATBOT_SCHEMA } from '../tokens';
import type { ChatbotSchema } from '../ai-settings/AiSettingsRepository';
import {
  isExpired,
  normalizeChatChannel,
  normalizeExpiresAt,
  type ChatSessionMeta,
  type StoredChatSession,
} from './ChatSessionSchema';

interface UpsertChatSessionInput extends ChatSessionMeta {
  sessionKey: string;
  messages: UIMessage[];
  title?: string | null;
}

@Repository()
@Meta({ layer: 'plugin', order: 45 })
export class ChatSessionRepository {
  @DB() declare db: any;
  @Inject(CHATBOT_SCHEMA) private schema!: ChatbotSchema;
  private schemaChecked = false;

  private get table() {
    const table = this.schema.chatSessions;
    if (!table) {
      throw new Error('chat_sessions schema missing. Add chatbotSchema.chatSessions to chatbot({ schema }).');
    }
    return table;
  }

  async findByKey(sessionKey: string): Promise<StoredChatSession | null> {
    await this.ensureColumns();
    const row = await this.findRawByKey(sessionKey);
    if (!row) return null;

    if (isExpired(row.expiresAt)) {
      await this.deleteByKey(sessionKey);
      return null;
    }

    return this.toStored(row);
  }

  async upsert(input: UpsertChatSessionInput): Promise<StoredChatSession> {
    await this.ensureColumns();
    const t = this.table;
    const existing = await this.findRawByKey(input.sessionKey);
    const now = new Date().toISOString();
    const data = {
      sessionKey: input.sessionKey,
      userId: input.userId ?? null,
      channel: normalizeChatChannel(input.channel),
      messages: input.messages,
      title: input.title ?? undefined,
      messageCount: input.messages.length,
      lastMessageAt: input.messages.length > 0 ? now : undefined,
      expiresAt: normalizeExpiresAt(input.expiresAt),
      updatedAt: now,
    };

    if (existing) {
      const updateData: any = { ...data };
      if (existing.title && !input.title) {
        delete updateData.title;
      }
      const [updated] = await this.db
        .update(t)
        .set(updateData)
        .where(eq(t.sessionKey, input.sessionKey))
        .returning();
      return this.toStored(updated);
    }

    const [created] = await this.db
      .insert(t)
      .values({ ...data, createdAt: now })
      .returning();
    return this.toStored(created);
  }

  async deleteByKey(sessionKey: string): Promise<void> {
    await this.ensureColumns();
    const t = this.table;
    await this.db.delete(t).where(eq(t.sessionKey, sessionKey));
  }

  async listByUser(userId: string, opts: { limit?: number; offset?: number; channel?: string } = {}): Promise<StoredChatSession[]> {
    await this.ensureColumns();
    const t = this.table;
    const limit = Math.min(opts.limit ?? 50, 100);
    const offset = opts.offset ?? 0;
    let query = this.db
      .select()
      .from(t)
      .where(eq(t.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(t.lastMessageAt)) as any;
    if (opts.channel) {
      query = this.db
        .select()
        .from(t)
        .where(and(eq(t.userId, userId), eq(t.channel, opts.channel)))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(t.lastMessageAt)) as any;
    }
    const rows = await query;
    return rows.map((row: any) => this.toStored(row));
  }

  async updateTitle(sessionKey: string, title: string): Promise<void> {
    await this.ensureColumns();
    const t = this.table;
    await this.db
      .update(t)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(t.sessionKey, sessionKey));
  }

  async deleteExpired(now = new Date()): Promise<number> {
    await this.ensureColumns();
    const t = this.table;
    const deleted = await this.db
      .delete(t)
      .where(and(isNotNull(t.expiresAt), lt(t.expiresAt, now.toISOString())))
      .returning({ id: t.id });
    return Array.isArray(deleted) ? deleted.length : 0;
  }

  private async findRawByKey(sessionKey: string) {
    const t = this.table;
    const [row] = await this.db.select().from(t).where(eq(t.sessionKey, sessionKey)).limit(1);
    return row ?? null;
  }

  private async ensureColumns(): Promise<void> {
    if (this.schemaChecked || !this.schema.chatSessions) return;
    this.schemaChecked = true;

    if (typeof this.db.all === 'function') {
      const columns = await this.db.all(sql`PRAGMA table_info(chat_sessions)`);
      const list = Array.isArray(columns) ? columns : columns?.rows ?? [];
      if (list.length === 0) return;
      if (!list.some((column: any) => column.name === 'title')) {
        await this.db.run(sql`ALTER TABLE chat_sessions ADD COLUMN title TEXT`);
      }
      if (!list.some((column: any) => column.name === 'message_count')) {
        await this.db.run(sql`ALTER TABLE chat_sessions ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0`);
      }
      if (!list.some((column: any) => column.name === 'last_message_at')) {
        await this.db.run(sql`ALTER TABLE chat_sessions ADD COLUMN last_message_at TEXT`);
      }
      await this.db.run(sql`
        UPDATE chat_sessions
        SET
          message_count = CASE
            WHEN json_valid(messages) THEN json_array_length(messages)
            ELSE 0
          END,
          last_message_at = COALESCE(updated_at, created_at)
        WHERE message_count = 0 OR last_message_at IS NULL
      `);
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title TEXT`);
      await this.db.execute(sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0`);
      await this.db.execute(sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP`);
    }
  }

  private toStored(row: any): StoredChatSession {
    return {
      id: row.id,
      sessionKey: row.sessionKey,
      userId: row.userId ?? null,
      channel: normalizeChatChannel(row.channel),
      messages: this.normalizeMessages(row.messages),
      title: row.title ?? null,
      messageCount: row.messageCount ?? 0,
      lastMessageAt: row.lastMessageAt ?? null,
      expiresAt: normalizeExpiresAt(row.expiresAt),
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  private normalizeMessages(value: unknown): UIMessage[] {
    if (Array.isArray(value)) return value as UIMessage[];
    if (typeof value !== 'string') return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
