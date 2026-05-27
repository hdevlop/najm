import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { productsTable } from '../product/ProductSchema';

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ordersTable = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Keep as plain text to avoid cross-dialect FK coupling with authSchema users table.
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('pending'),
  total: real('total').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const orderItemsTable = sqliteTable('order_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => ordersTable.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => productsTable.id),
  quantity: integer('quantity').notNull(),
  price: real('price').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;
