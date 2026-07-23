import { mysqlTable, varchar, boolean, timestamp, json, text, int } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { UIMessage } from 'ai';

export const aiSettingsTable = mysqlTable('ai_settings', {
  id: varchar('id', { length: 8 }).primaryKey().$defaultFn(() => nanoid(8)),
  provider: varchar('provider', { length: 50 }).notNull().default('ollama'),
  apiKeyEncrypted: text('api_key_encrypted'),
  baseUrl: text('base_url'),
  model: varchar('model', { length: 100 }).notNull().default('llama3.1'),
  systemPrompt: text('system_prompt'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  useMemory: boolean('use_memory').notNull().default(true),
  maxStoredMessages: int('max_stored_messages').default(100),
  maxPromptMessages: int('max_prompt_messages').default(10),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatSessionsTable = mysqlTable('chat_sessions', {
  id: varchar('id', { length: 12 }).primaryKey().$defaultFn(() => nanoid(12)),
  sessionKey: varchar('session_key', { length: 255 }).notNull().unique(),
  userId: varchar('user_id', { length: 21 }),
  channel: varchar('channel', { length: 20 }).notNull().default('web'),
  messages: json('messages').$type<UIMessage[]>().notNull(),
  title: text('title'),
  messageCount: int('message_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotCoreSchema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
} as const;
