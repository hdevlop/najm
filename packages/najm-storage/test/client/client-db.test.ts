import { describe, test, expect, afterAll } from 'bun:test';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { lt } from 'drizzle-orm';
import { createClientDb, type ClientDb } from '../../src/client-db';

const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
});

const schema = { products };
let clientDb: ClientDb<typeof schema> | undefined;

afterAll(async () => {
  await clientDb?.close();
});

describe('createClientDb (PGlite + drizzle)', () => {
  test('runs real pg-dialect queries through drizzle', async () => {
    clientDb = createClientDb({ persistence: 'memory', schema });
    const { db, client } = clientDb;

    await client.exec(
      'CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL)'
    );

    await db.insert(products).values([
      { id: 'p1', name: 'Widget', price: 5 },
      { id: 'p2', name: 'Gadget', price: 15 },
    ]);

    const cheap = await db.select().from(products).where(lt(products.price, 10));
    expect(cheap).toEqual([{ id: 'p1', name: 'Widget', price: 5 }]);

    // pg-specific feature sanity check: jsonb round-trip via raw SQL
    const result = await client.query<{ doc: { ok: boolean } }>(
      `SELECT '{"ok": true}'::jsonb AS doc`
    );
    expect(result.rows[0]?.doc).toEqual({ ok: true });
  });
});
