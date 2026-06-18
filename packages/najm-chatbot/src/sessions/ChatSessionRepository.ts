import { Inject, Meta, Repository } from 'najm-core';
import { DB } from 'najm-database';
import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { CHATBOT_CONFIG, CHATBOT_SCHEMA } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
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

type SaveChatSessionInput = UpsertChatSessionInput;

@Repository()
@Meta({ layer: 'plugin', order: 45 })
export class ChatSessionRepository {
  @DB() declare db: any;
  @Inject(CHATBOT_SCHEMA) private schema!: ChatbotSchema;
  @Inject(CHATBOT_CONFIG) private config!: ChatbotConfig;
  private schemaChecked = false;

  private get table() {
    const table = this.schema.chatSessions;
    if (!table) {
      throw new Error('chat_sessions schema missing. Add chatbotSchema.chatSessions to chatbot({ schema }).');
    }
    return table;
  }

  private get dialect(): 'sqlite' | 'pg' | 'mysql' {
    return (this.config?.dialect ?? 'pg') as 'sqlite' | 'pg' | 'mysql';
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

  async save(input: SaveChatSessionInput): Promise<void> {
    await this.ensureColumns();
    const t = this.table;
    const now = new Date().toISOString();
    const lastMessageAt = input.messages.length > 0 ? now : null;
    const expiresAt = normalizeExpiresAt(input.expiresAt);
    const channel = normalizeChatChannel(input.channel);

    const insertValues: Record<string, any> = {
      sessionKey: input.sessionKey,
      userId: input.userId ?? null,
      channel,
      messages: input.messages,
      title: input.title ?? null,
      messageCount: input.messages.length,
      lastMessageAt,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    const updateSet: Record<string, any> = {
      userId: input.userId ?? null,
      channel,
      messages: input.messages,
      messageCount: input.messages.length,
      lastMessageAt,
      expiresAt,
      updatedAt: now,
    };
    if (input.title != null) {
      updateSet.title = input.title;
    }

    const baseQuery = this.db.insert(t).values(insertValues);
    if (this.dialect === 'mysql') {
      await (baseQuery as any).onDuplicateKeyUpdate({ set: updateSet });
    } else {
      await (baseQuery as any).onConflictDoUpdate({ target: t.sessionKey, set: updateSet });
    }
  }

  async upsert(input: UpsertChatSessionInput): Promise<StoredChatSession> {
    await this.save(input);
    const row = await this.findRawByKey(input.sessionKey);
    if (!row) {
      throw new Error(
        `ChatSessionRepository.upsert: row for sessionKey "${input.sessionKey}" not found immediately after a successful native write.`,
      );
    }
    return this.toStored(row);
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
