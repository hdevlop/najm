import { pgTable, text, boolean, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { UIMessage } from 'ai';

export const aiSettingsTable = pgTable('ai_settings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  provider: text('provider').notNull().default('ollama'),
  apiKeyEncrypted: text('api_key_encrypted'),
  baseUrl: text('base_url'),
  model: text('model').notNull().default('llama3.1'),
  systemPrompt: text('system_prompt'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  useMemory: boolean('use_memory').notNull().default(true),
  maxStoredMessages: integer('max_stored_messages').default(100),
  maxPromptMessages: integer('max_prompt_messages').default(10),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatSessionsTable = pgTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  sessionKey: text('session_key').notNull().unique(),
  userId: text('user_id'),
  channel: text('channel').notNull().default('web'),
  messages: jsonb('messages').$type<UIMessage[]>().notNull(),
  title: text('title'),
  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotInteractionLogsTable = pgTable('chatbot_interaction_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  sessionKey: text('session_key'),
  userQuery: text('user_query').notNull(),
  queryLang: text('query_lang'),
  routingEnabled: boolean('routing_enabled').notNull().default(false),
  routingStatus: text('routing_status').notNull(),
  routedTools: text('routed_tools').array(),
  actualToolNames: text('actual_tool_names').array(),
  modelToolCalls: jsonb('model_tool_calls'),
  modelAnswer: text('model_answer'),
  stepsCount: text('steps_count'),
  success: boolean('success'),
  error: text('error'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('interaction_logs_created_at_idx').on(table.createdAt),
  index('interaction_logs_success_idx').on(table.success),
]);

export const chatbotCoreSchema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
  chatbotInteractionLogs: chatbotInteractionLogsTable,
} as const;
