// ============================================================================
// najm-storage - MySQL Schema
// ============================================================================

import { mysqlTable, varchar, int, customType, uniqueIndex } from 'drizzle-orm/mysql-core';

const longblob = customType<{ data: Buffer }>({
  dataType: () => 'longblob',
});

export const storageFiles = mysqlTable('storage_files', {
  id: varchar('id', { length: 512 }).primaryKey(),
  namespace: varchar('namespace', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 512 }).notNull(),
  data: longblob('data').notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  size: int('size').notNull(),
  category: varchar('category', { length: 31 }).notNull(),
  createdAt: varchar('created_at', { length: 30 }).notNull(),
  updatedAt: varchar('updated_at', { length: 30 }).notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_ns_path_idx').on(t.namespace, t.filePath),
}));

export const storageBuckets = mysqlTable('storage_buckets', {
  name: varchar('name', { length: 255 }).primaryKey(),
  label: varchar('label', { length: 255 }),
  maxFileSize: int('max_file_size'),
  allowedMimeTypes: varchar('allowed_mime_types', { length: 512 }),
  protected: int('protected').default(0),
  createdAt: varchar('created_at', { length: 30 }).default('CURRENT_TIMESTAMP'),
  updatedAt: varchar('updated_at', { length: 30 }).default('CURRENT_TIMESTAMP'),
});

export const storageSchema = { storageFiles, storageBuckets } as const;

export type StorageFile = typeof storageFiles.$inferSelect;
export type NewStorageFile = typeof storageFiles.$inferInsert;
