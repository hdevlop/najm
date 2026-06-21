import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const themeProjectsTable = sqliteTable('theme_projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type ThemeProjectRecord = typeof themeProjectsTable.$inferSelect;
export type NewThemeProjectRecord = typeof themeProjectsTable.$inferInsert;