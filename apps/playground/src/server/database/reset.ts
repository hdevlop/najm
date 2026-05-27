import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_URL || './playground.db';
const db = new Database(dbPath);

const tables = [
  'order_items',
  'cart_items',
  'orders',
  'products',
  'tokens',
  'role_permissions',
  'users',
  'permissions',
  'roles',
] as const;

try {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN');

  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`);
  }

  db.exec('COMMIT');
  console.log(`Reset complete for ${tables.length} tables in ${dbPath}`);
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Database reset failed', error);
  throw error;
} finally {
  db.close();
}
