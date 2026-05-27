// ============================================================================
// najm-storage - PostgreSQL Schema
// ============================================================================

import { pgTable, text, integer, customType, uniqueIndex } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const storageFiles = pgTable('storage_files', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  filePath: text('file_path').notNull(),
  data: bytea('data').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  category: text('category').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_ns_path_idx').on(t.namespace, t.filePath),
}));

export const storageBuckets = pgTable('storage_buckets', {
  name: text('name').primaryKey(),
  label: text('label'),
  maxFileSize: integer('max_file_size'),
  allowedMimeTypes: text('allowed_mime_types'),
  protected: integer('protected').default(0),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const storageSchema = { storageFiles, storageBuckets } as const;

export type StorageFile = typeof storageFiles.$inferSelect;
export type NewStorageFile = typeof storageFiles.$inferInsert;
