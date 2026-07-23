import { database } from 'najm-database';
import { schema } from '../database/schema';

const dbPath = process.env.DATABASE_URL || './playground.db';
const isBunRuntime = typeof Bun !== 'undefined';

let db: any;

if (isBunRuntime) {
  const { Database } = await import('bun:sqlite');
  const { drizzle } = await import('drizzle-orm/bun-sqlite');
  db = drizzle(new Database(dbPath), { schema });
} else {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  db = drizzle(new Database(dbPath), { schema });
}

export const databaseConfig = () => database({ default: db });
