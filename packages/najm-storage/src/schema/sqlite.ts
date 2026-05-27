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

export const storageSchema = { storageFiles, storageBuckets } as const;

export type StorageFile = typeof storageFiles.$inferSelect;
export type NewStorageFile = typeof storageFiles.$inferInsert;
