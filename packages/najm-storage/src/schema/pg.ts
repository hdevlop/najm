// ============================================================================
// najm-storage - PostgreSQL Schema
// ============================================================================

import { pgTable, text, integer, serial, customType, uniqueIndex } from 'drizzle-orm/pg-core';

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

export const storageTags = pgTable('storage_tags', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('storage_tags_ns_name_idx').on(t.namespace, t.name),
}));

export const storageFileTags = pgTable('storage_file_tags', {
  fileId: text('file_id').notNull().references(() => storageFiles.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => storageTags.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('storage_file_tags_pk').on(t.fileId, t.tagId),
}));

export const auditLog = pgTable('storage_audit_log', {
  id: serial('id').primaryKey(),
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
