import { mysqlTable, varchar, text, int, boolean, json, timestamp, mysqlEnum } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const chatbotDocumentSourcesTable = mysqlTable('chatbot_document_sources', {
  id: varchar('id', { length: 12 }).primaryKey().$defaultFn(() => nanoid(8)),
  namespace: varchar('namespace', { length: 64 }).notNull().default('rag'),
  sourceType: mysqlEnum('source_type', ['pdf', 'text', 'markdown', 'image', 'url']).notNull(),
  originalPath: text('original_path').notNull(),
  ext: varchar('ext', { length: 16 }).notNull().default(''),
  mime: varchar('mime', { length: 128 }).notNull().default(''),
  status: mysqlEnum('status', ['pending', 'extracting', 'ready', 'failed']).notNull().default('pending'),
  error: text('error'),
  ingestedAt: timestamp('ingested_at', { mode: 'string' }),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().onUpdateNow(),
});

export const chatbotDocumentChunksTable = mysqlTable('chatbot_document_chunks', {
  id: varchar('id', { length: 12 }).primaryKey().$defaultFn(() => nanoid(8)),
  documentId: varchar('document_id', { length: 12 }).notNull(),
  ordinal: int('ordinal').notNull(),
  page: int('page'),
  text: text('text').notNull(),
  tokens: int('tokens').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const chatbotStudioAuditLogsTable = mysqlTable('chatbot_studio_audit_logs', {
  id: varchar('id', { length: 14 }).primaryKey().$defaultFn(() => nanoid(12)),
  action: varchar('action', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  details: text('details').notNull().default(''),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const ragSchema = {
  chatbotDocumentSources: chatbotDocumentSourcesTable,
  chatbotDocumentChunks: chatbotDocumentChunksTable,
  chatbotStudioAuditLogs: chatbotStudioAuditLogsTable,
} as const;

export type ChatbotDocumentSource = typeof chatbotDocumentSourcesTable.$inferSelect;
export type NewChatbotDocumentSource = typeof chatbotDocumentSourcesTable.$inferInsert;
export type ChatbotDocumentChunk = typeof chatbotDocumentChunksTable.$inferSelect;
export type NewChatbotDocumentChunk = typeof chatbotDocumentChunksTable.$inferInsert;
export type ChatbotStudioAuditLog = typeof chatbotStudioAuditLogsTable.$inferSelect;
export type NewChatbotStudioAuditLog = typeof chatbotStudioAuditLogsTable.$inferInsert;
