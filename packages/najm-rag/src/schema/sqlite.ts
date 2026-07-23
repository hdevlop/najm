import { sqliteTable, text, blob, uniqueIndex, index, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const chatbotToolEmbeddingsTable = sqliteTable('chatbot_tool_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  toolName: text('tool_name').notNull().unique(),
  description: text('description').notNull(),
  group: text('group'),
  localName: text('local_name'),
  argNames: text('arg_names', { mode: 'json' }).$type<string[]>(),
  annotations: text('annotations', { mode: 'json' }).$type<Record<string, unknown>>(),
  fingerprint: text('fingerprint').notNull(),
  embedding: blob('embedding', { mode: 'buffer' }),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatbotToolSemanticsTable = sqliteTable('chatbot_tool_semantics', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  toolName: text('tool_name').notNull(),
  phrase: text('phrase').notNull(),
  lang: text('lang').notNull().default('und'),
  source: text('source'),
  sourceFile: text('source_file'),
  embedding: blob('embedding', { mode: 'buffer' }),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('semantics_tool_phrase_lang_idx').on(table.toolName, table.phrase, table.lang),
  index('semantics_tool_lang_idx').on(table.toolName, table.lang),
]);

export const chatbotRoutingSettingsTable = sqliteTable('chatbot_routing_settings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  enableKnowledge: integer('enable_knowledge', { mode: 'boolean' }).notNull().default(true),
  maxTools: integer('max_tools'),
  topSemanticHits: integer('top_semantic_hits'),
  similarityThreshold: text('similarity_threshold'),
  fallbackOnRouterError: text('fallback_on_router_error', { enum: ['all', 'none'] }),
  fallbackOnNoMatch: text('fallback_on_no_match', { enum: ['all', 'none'] }),
  allowedLangs: text('allowed_langs', { mode: 'json' }).$type<string[]>(),
  dependencies: text('dependencies', { mode: 'json' }).$type<Record<string, string[]>>(),
  dangerousIntentKeywords: text('dangerous_intent_keywords', { mode: 'json' }).$type<Record<string, string[]>>(),
  toolsOverride: text('tools_override', { enum: ['auto', 'none', 'all'] }),
  contextOverride: text('context_override', { enum: ['auto', 'none'] }),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatbotDocumentSourcesTable = sqliteTable('chatbot_document_sources', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  namespace: text('namespace').notNull().default('rag'),
  sourceType: text('source_type', { enum: ['pdf', 'text', 'markdown', 'image', 'url'] }).notNull(),
  originalPath: text('original_path').notNull(),
  ext: text('ext').notNull().default(''),
  mime: text('mime').notNull().default(''),
  status: text('status', { enum: ['pending', 'extracting', 'ready', 'failed'] }).notNull().default('pending'),
  error: text('error'),
  ingestedAt: text('ingested_at'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatbotDocumentChunksTable = sqliteTable('chatbot_document_chunks', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  documentId: text('document_id').notNull(),
  ordinal: integer('ordinal').notNull(),
  page: integer('page'),
  text: text('text').notNull(),
  tokens: integer('tokens').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const chatbotDocumentEmbeddingsTable = sqliteTable('chatbot_document_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  chunkId: text('chunk_id').notNull().unique(),
  embedding: blob('embedding', { mode: 'buffer' }),
  model: text('model').notNull().default(''),
  dimensions: integer('dimensions').notNull().default(768),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const chatbotStudioAuditLogsTable = sqliteTable('chatbot_studio_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  action: text('action').notNull(),
  userId: text('user_id'),
  details: text('details').notNull().default(''),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const chatbotUnmatchedQueriesTable = sqliteTable('chatbot_unmatched_queries', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  query: text('query').notNull(),
  normalized: text('normalized').notNull().unique(),
  score: text('score').notNull(),
  threshold: text('threshold').notNull(),
  source: text('source').notNull().default('router'),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const chatbotRoutingTestsTable = sqliteTable('chatbot_routing_tests', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  name: text('name').notNull(),
  query: text('query').notNull(),
  lang: text('lang').notNull().default('und'),
  expectedTools: text('expected_tools', { mode: 'json' }).$type<string[]>().notNull(),
  lastStatus: text('last_status', { enum: ['pending', 'pass', 'fail', 'low_confidence'] }).notNull().default('pending'),
  lastConfidence: integer('last_confidence'),
  lastActualTools: text('last_actual_tools', { mode: 'json' }).$type<string[]>(),
  lastMissingTools: text('last_missing_tools', { mode: 'json' }).$type<string[]>(),
  lastScores: text('last_scores', { mode: 'json' }).$type<Array<{ toolName: string; similarity: number; matchLevel: string }>>(),
  lastRunAt: text('last_run_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

export const ragSchema = {
  chatbotToolEmbeddings: chatbotToolEmbeddingsTable,
  chatbotToolSemantics: chatbotToolSemanticsTable,
  chatbotRoutingSettings: chatbotRoutingSettingsTable,
  chatbotDocumentSources: chatbotDocumentSourcesTable,
  chatbotDocumentChunks: chatbotDocumentChunksTable,
  chatbotDocumentEmbeddings: chatbotDocumentEmbeddingsTable,
  chatbotStudioAuditLogs: chatbotStudioAuditLogsTable,
  chatbotUnmatchedQueries: chatbotUnmatchedQueriesTable,
  chatbotRoutingTests: chatbotRoutingTestsTable,
} as const;

export type ChatbotToolEmbedding = typeof chatbotToolEmbeddingsTable.$inferSelect;
export type NewChatbotToolEmbedding = typeof chatbotToolEmbeddingsTable.$inferInsert;
export type ChatbotToolSemantic = typeof chatbotToolSemanticsTable.$inferSelect;
export type NewChatbotToolSemantic = typeof chatbotToolSemanticsTable.$inferInsert;
export type ChatbotRoutingSettings = typeof chatbotRoutingSettingsTable.$inferSelect;
export type NewChatbotRoutingSettings = typeof chatbotRoutingSettingsTable.$inferInsert;
export type ChatbotDocumentSource = typeof chatbotDocumentSourcesTable.$inferSelect;
export type NewChatbotDocumentSource = typeof chatbotDocumentSourcesTable.$inferInsert;
export type ChatbotDocumentChunk = typeof chatbotDocumentChunksTable.$inferSelect;
export type NewChatbotDocumentChunk = typeof chatbotDocumentChunksTable.$inferInsert;
export type ChatbotDocumentEmbedding = typeof chatbotDocumentEmbeddingsTable.$inferSelect;
export type NewChatbotDocumentEmbedding = typeof chatbotDocumentEmbeddingsTable.$inferInsert;
export type ChatbotStudioAuditLog = typeof chatbotStudioAuditLogsTable.$inferSelect;
export type NewChatbotStudioAuditLog = typeof chatbotStudioAuditLogsTable.$inferInsert;
export type ChatbotUnmatchedQuery = typeof chatbotUnmatchedQueriesTable.$inferSelect;
export type NewChatbotUnmatchedQuery = typeof chatbotUnmatchedQueriesTable.$inferInsert;
export type ChatbotRoutingTest = typeof chatbotRoutingTestsTable.$inferSelect;
export type NewChatbotRoutingTest = typeof chatbotRoutingTestsTable.$inferInsert;
