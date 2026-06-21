import { database } from 'najm-database';
import { schema } from '../database/schema';

const dbPath = process.env.DATABASE_URL || './theme-studio.db';
const isBunRuntime = typeof Bun !== 'undefined';

export let db: any;

function ensureThemeStudioSchema(sqlite: { exec: (sql: string) => unknown }) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS theme_projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS theme_styles (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES theme_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_theme_styles_project_id
    ON theme_styles(project_id)
  `);
}

if (isBunRuntime) {
  const { Database } = await import('bun:sqlite');
  const { drizzle } = await import('drizzle-orm/bun-sqlite');
  const sqlite = new Database(dbPath);
  ensureThemeStudioSchema(sqlite);
  db = drizzle(sqlite, { schema });
} else {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const sqlite = new Database(dbPath);
  ensureThemeStudioSchema(sqlite);
  db = drizzle(sqlite, { schema });
}

export const databaseConfig = () => database({ default: db });
