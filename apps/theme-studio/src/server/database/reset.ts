import { Database } from 'bun:sqlite';

const dbPath = process.env.DATABASE_URL || './theme-studio.db';
const db = new Database(dbPath);

const tables = [
  'theme_styles',
  'theme_projects',
] as const;

try {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');

  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  }

  db.exec(`
    CREATE TABLE theme_projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  db.exec(`
    CREATE TABLE theme_styles (
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

  db.exec(`
    CREATE INDEX idx_theme_styles_project_id ON theme_styles(project_id)
  `);

  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  console.log(`Reset complete for ${tables.length} tables in ${dbPath}`);
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Database reset failed', error);
  throw error;
} finally {
  db.close();
}