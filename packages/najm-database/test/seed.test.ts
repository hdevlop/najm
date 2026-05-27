import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from '../src/DatabasePlugin';
import { SeedService } from '../src/SeedService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// ============================================================================
// Test Schema
// ============================================================================

const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
});

const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
});

const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
});

const schema = { users, posts, products };

// ============================================================================
// Test DTOs
// ============================================================================

const userDto = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

// ============================================================================
// Tests
// ============================================================================

describe('SeedService', () => {
  let server: Server;
  let seeder: SeedService;
  let db: any;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT);
      CREATE TABLE posts (id TEXT PRIMARY KEY, user_id TEXT, title TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, sku TEXT UNIQUE, name TEXT, price INTEGER);
    `);

    // SeedService is auto-registered by database plugin — no need for .load()
    server = new Server({ isolated: true }).use(database({ default: db }));

    await server.listen(3200);
    seeder = server.container.get(SeedService);
  });

  afterEach(async () => {
    await server?.stop();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Conflict Strategy: skip (default)
  // ══════════════════════════════════════════════════════════════════════════

  test('skip: inserts new rows', async () => {
    const report = await seeder.run({
      users: [
        { id: '1', email: 'user1@test.com', name: 'User 1' },
        { id: '2', email: 'user2@test.com', name: 'User 2' },
      ],
    });

    expect(report.inserted).toBe(2);
    const result = await db.select().from(users);
    expect(result.length).toBe(2);
  });

  test('skip: does not overwrite existing rows', async () => {
    await seeder.run({
      users: [{ id: '1', email: 'user@test.com', name: 'Original' }],
    });

    // Re-run with different name — should be skipped
    const report = await seeder.run({
      users: [{ id: '1', email: 'user@test.com', name: 'Changed' }],
    });

    expect(report.skipped).toBeGreaterThan(0);
    const result = await db.select().from(users).where(eq(users.id, '1'));
    expect(result[0].name).toBe('Original'); // Preserved
  });

  test('skip: inserts new rows alongside existing', async () => {
    await seeder.run({
      users: [{ id: '1', email: 'user1@test.com', name: 'User 1' }],
    });

    await seeder.run({
      users: [
        { id: '1', email: 'user1@test.com', name: 'User 1' }, // Exists → skip
        { id: '2', email: 'user2@test.com', name: 'User 2' }, // New → insert
      ],
    });

    const result = await db.select().from(users);
    expect(result.length).toBe(2);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Conflict Strategy: replace
  // ══════════════════════════════════════════════════════════════════════════

  test('replace: overwrites existing rows', async () => {
    await seeder.run({
      products: {
        by: ['sku'],
        onConflict: 'replace',
        rows: [{ id: '1', sku: 'W-01', name: 'Widget', price: 999 }],
      },
    });

    await seeder.run({
      products: {
        by: ['sku'],
        onConflict: 'replace',
        rows: [{ id: '1', sku: 'W-01', name: 'Widget Pro', price: 1299 }],
      },
    });

    const result = await db.select().from(products).where(eq(products.sku, 'W-01'));
    expect(result[0].name).toBe('Widget Pro');
    expect(result[0].price).toBe(1299);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Conflict Strategy: fail
  // ══════════════════════════════════════════════════════════════════════════

  test('fail: throws on duplicate', async () => {
    await seeder.run({
      users: [{ id: '1', email: 'user@test.com', name: 'User' }],
    });

    await expect(async () => {
      await seeder.run({
        users: {
          onConflict: 'fail',
          rows: [{ id: '1', email: 'user@test.com', name: 'User' }],
        },
      });
    }).toThrow();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Zod Validation
  // ══════════════════════════════════════════════════════════════════════════

  test('schema: validates rows before insert', async () => {
    await expect(async () => {
      await seeder.run({
        users: {
          schema: userDto,
          rows: [{ id: '1', email: 'not-an-email', name: 'User' }],
        },
      });
    }).toThrow(/users\[0\]/);
  });

  test('schema: passes valid rows', async () => {
    const report = await seeder.run({
      users: {
        schema: userDto,
        rows: [{ id: '1', email: 'valid@test.com', name: 'User' }],
      },
    });

    expect(report.inserted).toBe(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Link Resolvers
  // ══════════════════════════════════════════════════════════════════════════

  test('resolver: accesses previously seeded rows', async () => {
    const report = await seeder.run({
      users: [{ id: '1', email: 'author@test.com', name: 'Author' }],
      posts: (seeded) => {
        const user = seeded.users[0];
        return [
          { id: '1', userId: user.id, title: 'Post 1' },
          { id: '2', userId: user.id, title: 'Post 2' },
        ];
      },
    });

    expect(report.inserted).toBe(3);
    const result = await db.select().from(posts);
    expect(result.length).toBe(2);
    expect(result[0].userId).toBe('1');
  });

  test('resolver: seeded contains ALL rows on re-run (not just inserted)', async () => {
    // First run: insert users
    await seeder.run({
      users: [{ id: '1', email: 'author@test.com', name: 'Author' }],
    });

    // Second run: users already exist (skipped), but posts resolver needs them
    const report = await seeder.run({
      users: [{ id: '1', email: 'author@test.com', name: 'Author' }],
      posts: (seeded) => {
        // seeded.users MUST contain the existing user, not be empty
        expect(seeded.users.length).toBe(1);
        expect(seeded.users[0].id).toBe('1');
        return [{ id: '10', userId: seeded.users[0].id, title: 'New Post' }];
      },
    });

    expect(report.inserted).toBeGreaterThan(0);
  });

  test('resolver: async function for transforms', async () => {
    const report = await seeder.run({
      users: async () => {
        const hashed = await new Promise<string>((resolve) =>
          setTimeout(() => resolve('hashed_pw'), 10)
        );
        return [{ id: '1', email: 'user@test.com', name: String(hashed) }];
      },
    });

    expect(report.inserted).toBe(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Options
  // ══════════════════════════════════════════════════════════════════════════

  test('dryRun: no DB writes', async () => {
    const report = await seeder.run(
      {
        users: [{ id: '1', email: 'user@test.com', name: 'User' }],
      },
      { dryRun: true }
    );

    expect(report.skipped).toBe(1);
    const result = await db.select().from(users);
    expect(result.length).toBe(0);
  });

  test('transaction: rollback on mid-seed failure', async () => {
    await expect(async () => {
      await seeder.run(
        {
          users: [{ id: '1', email: 'user@test.com', name: 'User' }],
          posts: () => {
            throw new Error('Intentional error');
          },
        },
        { transaction: true }
      );
    }).toThrow();

    const result = await db.select().from(users);
    expect(result.length).toBe(0); // Rolled back
  });

  test('global onConflict applies to all entries', async () => {
    await seeder.run({
      users: [{ id: '1', email: 'user@test.com', name: 'Original' }],
    });

    await seeder.run(
      {
        users: [{ id: '1', email: 'user@test.com', name: 'Changed' }],
      },
      { onConflict: 'replace' }
    );

    const result = await db.select().from(users).where(eq(users.id, '1'));
    expect(result[0].name).toBe('Changed');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════════════════════════════════════════

  test('empty rows: no errors', async () => {
    const report = await seeder.run({ users: [] });
    expect(report.inserted).toBe(0);
    expect(report.failed).toBe(0);
  });

  test('unknown table: error lists available tables', async () => {
    await expect(async () => {
      await seeder.run({ unknown_table: [{ id: '1' }] });
    }).toThrow(/Available.*users.*posts.*products/);
  });

  test('database auto-detection: uses default', async () => {
    const report = await seeder.run({
      users: [{ id: '1', email: 'user@test.com', name: 'User' }],
    });
    expect(report.inserted).toBe(1);
  });
});
