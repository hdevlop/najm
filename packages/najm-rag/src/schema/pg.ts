import { pgTable, text, vector, uniqueIndex, index, timestamp, jsonb, integer, varchar, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const chatbotToolEmbeddingsTable = pgTable('chatbot_tool_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  toolName: text('tool_name').notNull().unique(),
  description: text('description').notNull(),
  group: text('group'),
  localName: text('local_name'),
  argNames: text('arg_names').array(),
  annotations: jsonb('annotations'),
  fingerprint: text('fingerprint').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotToolSemanticsTable = pgTable('chatbot_tool_semantics', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  toolName: text('tool_name').notNull(),
  phrase: text('phrase').notNull(),
  lang: text('lang').notNull().default('und'),
  source: text('source'),
  sourceFile: text('source_file'),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('semantics_tool_phrase_lang_idx').on(table.toolName, table.phrase, table.lang),
  index('semantics_tool_lang_idx').on(table.toolName, table.lang),
]);

export const chatbotRoutingSettingsTable = pgTable('chatbot_routing_settings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  enableKnowledge: boolean('enable_knowledge').notNull().default(true),
  maxTools: integer('max_tools'),
  topSemanticHits: integer('top_semantic_hits'),
  similarityThreshold: text('similarity_threshold'),
  fallbackOnRouterError: varchar('fallback_on_router_error', { enum: ['all', 'none'] }),
  fallbackOnNoMatch: varchar('fallback_on_no_match', { enum: ['all', 'none'] }),
  allowedLangs: jsonb('allowed_langs').$type<string[]>(),
  dependencies: jsonb('dependencies').$type<Record<string, string[]>>(),
  dangerousIntentKeywords: jsonb('dangerous_intent_keywords').$type<Record<string, string[]>>(),
  toolsOverride: varchar('tools_override', { enum: ['auto', 'none', 'all'] }),
  contextOverride: varchar('context_override', { enum: ['auto', 'none'] }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotDocumentSourcesTable = pgTable('chatbot_document_sources', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  namespace: text('namespace').notNull().default('rag'),
  sourceType: varchar('source_type', { enum: ['pdf', 'text', 'markdown', 'image', 'url'] }).notNull(),
  originalPath: text('original_path').notNull(),
  ext: text('ext').notNull().default(''),
  mime: text('mime').notNull().default(''),
  status: varchar('status', { enum: ['pending', 'extracting', 'ready', 'failed'] }).notNull().default('pending'),
  error: text('error'),
  ingestedAt: timestamp('ingested_at', { mode: 'string' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotDocumentChunksTable = pgTable('chatbot_document_chunks', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  documentId: text('document_id').notNull(),
  ordinal: integer('ordinal').notNull(),
  page: integer('page'),
  text: text('text').notNull(),
  tokens: integer('tokens').notNull().default(0),
  enabled: text('enabled').notNull().default('true'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const chatbotDocumentEmbeddingsTable = pgTable('chatbot_document_embeddings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(8)),
  chunkId: text('chunk_id').notNull().unique(),
  embedding: vector('embedding', { dimensions: 768 }),
  model: text('model').notNull().default(''),
  dimensions: integer('dimensions').notNull().default(768),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('chatbot_document_embeddings_hnsw_idx')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

export const chatbotStudioAuditLogsTable = pgTable('chatbot_studio_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  action: text('action').notNull(),
  userId: text('user_id'),
  details: text('details').notNull().default(''),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const chatbotUnmatchedQueriesTable = pgTable('chatbot_unmatched_queries', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  query: text('query').notNull(),
  normalized: text('normalized').notNull().unique(),
  score: text('score').notNull(),
  threshold: text('threshold').notNull(),
  source: text('source').notNull().default('router'),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

export const chatbotRoutingTestsTable = pgTable('chatbot_routing_tests', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(12)),
  name: text('name').notNull(),
  query: text('query').notNull(),
  lang: text('lang').notNull().default('und'),
  expectedTools: jsonb('expected_tools').$type<string[]>().notNull(),
  lastStatus: text('last_status').notNull().default('pending'),
  lastConfidence: integer('last_confidence'),
  lastActualTools: jsonb('last_actual_tools').$type<string[]>(),
  lastMissingTools: jsonb('last_missing_tools').$type<string[]>(),
  lastScores: jsonb('last_scores').$type<Array<{ toolName: string; similarity: number; matchLevel: string }>>(),
  lastRunAt: timestamp('last_run_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().$onUpdate(() => sql`CURRENT_TIMESTAMP`),
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
