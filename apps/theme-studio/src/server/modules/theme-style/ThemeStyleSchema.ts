import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { themeProjectsTable } from '../theme-project/ThemeProjectSchema';

export const themeStylesTable = sqliteTable('theme_styles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => themeProjectsTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type ThemeStyleRecord = typeof themeStylesTable.$inferSelect;
export type NewThemeStyleRecord = typeof themeStylesTable.$inferInsert;