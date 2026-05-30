// ============================================================================
// najm-storage - SQLite Schema
// ============================================================================

import { sqliteTable, text, integer, blob, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const storageFiles = sqliteTable('storage_files', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  filePath: text('file_path').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  category: text('category').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_ns_path_idx').on(t.namespace, t.filePath),
}));

export const storageBuckets = sqliteTable('storage_buckets', {
  name: text('name').primaryKey(),
  label: text('label'),
  maxFileSize: integer('max_file_size'),
  allowedMimeTypes: text('allowed_mime_types'),
  protected: integer('protected', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const storageTags = sqliteTable('storage_tags', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_tags_ns_name_idx').on(t.namespace, t.name),
}));

export const storageFileTags = sqliteTable('storage_file_tags', {
  fileId: text('file_id').notNull().references(() => storageFiles.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => storageTags.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('storage_file_tags_pk').on(t.fileId, t.tagId),
}));

export const auditLog = sqliteTable('storage_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  namespace: text('namespace').notNull(),
  path: text('path'),
  meta: text('meta'),
  ts: text('ts').notNull().$defaultFn(() => new Date().toISOString()),
});

export const storageSchema = { storageFiles, storageBuckets, storageTags, storageFileTags, auditLog } as const;

export type StorageFile = typeof storageFiles.$inferSelect;
export type NewStorageFile = typeof storageFiles.$inferInsert;
