import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { productsTable } from '../product/ProductSchema';

export const cartItemsTable = sqliteTable(
  'cart_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    // Keep as plain text to avoid cross-dialect FK coupling with authSchema users table.
    userId: text('user_id').notNull(),
    productId: text('product_id').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userProductUnique: uniqueIndex('cart_items_user_product_unique').on(table.userId, table.productId),
  }),
);

export type CartItem = typeof cartItemsTable.$inferSelect;
export type NewCartItem = typeof cartItemsTable.$inferInsert;
