import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { UIMessage } from 'ai';
import {
  chatbotRoutingSettingsTable,
  chatbotToolEmbeddingsTable,
  chatbotToolSemanticsTable,
} from 'najm-rag/sqlite';
export const aiSettingsTable = sqliteTable('ai_settings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  provider: text('provider', {
    enum: ['anthropic', 'openai', 'google', 'zai', 'opencode', 'openrouter', 'minimax', 'qwen', 'ollama', 'custom'],
  }).notNull().default('ollama'),
  apiKeyEncrypted: text('api_key_encrypted'),
  baseUrl: text('base_url'),
  model: text('model').notNull().default('llama3.1'),
  systemPrompt: text('system_prompt'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  useMemory: integer('use_memory', { mode: 'boolean' }).notNull().default(true),
  maxStoredMessages: integer('max_stored_messages').default(100),
  maxPromptMessages: integer('max_prompt_messages').default(10),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatSessionsTable = sqliteTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  sessionKey: text('session_key').notNull().unique(),
  userId: text('user_id'),
  channel: text('channel', { enum: ['web', 'whatsapp', 'other'] }).notNull().default('web'),
  messages: text('messages', { mode: 'json' }).$type<UIMessage[]>().notNull(),
  title: text('title'),
  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: text('last_message_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatbotInteractionLogsTable = sqliteTable('chatbot_interaction_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  sessionKey: text('session_key'),
  userQuery: text('user_query').notNull(),
  queryLang: text('query_lang'),
  routingEnabled: integer('routing_enabled', { mode: 'boolean' }).notNull().default(false),
  routingStatus: text('routing_status').notNull(),
  routedTools: text('routed_tools', { mode: 'json' }).$type<string[]>(),
  actualToolNames: text('actual_tool_names', { mode: 'json' }).$type<string[]>(),
  modelToolCalls: text('model_tool_calls', { mode: 'json' }).$type<Record<string, unknown>[]>(),
  modelAnswer: text('model_answer'),
  stepsCount: text('steps_count'),
  success: integer('success', { mode: 'boolean' }),
  error: text('error'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('interaction_logs_created_at_idx').on(table.createdAt),
  index('interaction_logs_success_idx').on(table.success),
]);

export const chatbotCoreSchema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
  chatbotInteractionLogs: chatbotInteractionLogsTable,
} as const;

/**
 * @deprecated Use `chatbotCoreSchema` from "najm-chatbot/sqlite" together with
 * `ragSchema` from "najm-rag/sqlite".
 */
export const chatbotSchema = {
  ...chatbotCoreSchema,
  chatbotToolEmbeddings: chatbotToolEmbeddingsTable,
  chatbotToolSemantics: chatbotToolSemanticsTable,
  chatbotRoutingSettings: chatbotRoutingSettingsTable,
} as const;

export type AiSettings = typeof aiSettingsTable.$inferSelect;
export type NewAiSettings = typeof aiSettingsTable.$inferInsert;
export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type NewChatSession = typeof chatSessionsTable.$inferInsert;
export type ChatbotToolEmbedding = typeof chatbotToolEmbeddingsTable.$inferSelect;
export type NewChatbotToolEmbedding = typeof chatbotToolEmbeddingsTable.$inferInsert;
export type ChatbotToolSemantic = typeof chatbotToolSemanticsTable.$inferSelect;
export type NewChatbotToolSemantic = typeof chatbotToolSemanticsTable.$inferInsert;
export type ChatbotRoutingSettings = typeof chatbotRoutingSettingsTable.$inferSelect;
export type NewChatbotRoutingSettings = typeof chatbotRoutingSettingsTable.$inferInsert;
export type ChatbotInteractionLog = typeof chatbotInteractionLogsTable.$inferSelect;
export type NewChatbotInteractionLog = typeof chatbotInteractionLogsTable.$inferInsert;
