import { database } from 'najm-database';
import { themeSchema } from 'najm-theme/sqlite';
import { schema } from '../database/schema';

const dbPath = process.env.DATABASE_URL || './theme-studio.db';

// A second file, not a second set of tables in the first one.
//
// Theme Studio's projects and styles are a *design tool's* data: local drafts
// that get exported as JSON. `najm-theme` owns a *running application's*
// appearance. Keeping them in one file would invite `db:reset` to throw away
// whichever one the developer did not have in mind, and would blur the very
// thing the managed mode exists to demonstrate — that the package brings its
// own persistence and does not adopt yours.
const managedDbPath = process.env.MANAGED_DATABASE_URL || './theme-studio-managed.db';

const isBunRuntime = typeof Bun !== 'undefined';

export let db: any;
export let managedDb: any;

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

/**
 * `najm-theme`'s SQLite tables, column for column as `najm-theme/sqlite`
 * declares them.
 *
 * A real application generates these with drizzle-kit and checks the migration
 * in — the Playground does exactly that. Theme Studio is a local tool with a
 * disposable database and no migration history to protect, so it creates them
 * on boot instead of carrying a migrations folder for two products.
 */
function ensureManagedThemeSchema(sqlite: { exec: (sql: string) => unknown }) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS najm_theme_appearance (
      scope_id text PRIMARY KEY NOT NULL,
      design_config text,
      revision integer DEFAULT 1 NOT NULL,
      updated_by_actor_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      CONSTRAINT najm_theme_appearance_revision_positive CHECK (revision > 0)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS najm_theme_branding (
      scope_id text PRIMARY KEY NOT NULL,
      slot_config text DEFAULT '{}' NOT NULL,
      revision integer DEFAULT 1 NOT NULL,
      updated_by_actor_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      CONSTRAINT najm_theme_branding_revision_positive CHECK (revision > 0)
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS najm_theme_presets (
      id text PRIMARY KEY NOT NULL,
      scope_id text NOT NULL,
      slug text NOT NULL,
      name text NOT NULL,
      design_config text NOT NULL,
      is_built_in integer DEFAULT 0 NOT NULL,
      created_by_actor_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS najm_theme_presets_scope_slug_idx
    ON najm_theme_presets (scope_id, slug)
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS najm_theme_presets_scope_created_idx
    ON najm_theme_presets (scope_id, created_at)
  `);
}

if (isBunRuntime) {
  const { Database } = await import('bun:sqlite');
  const { drizzle } = await import('drizzle-orm/bun-sqlite');

  const sqlite = new Database(dbPath);
  ensureThemeStudioSchema(sqlite);
  db = drizzle(sqlite, { schema });

  const managedSqlite = new Database(managedDbPath);
  ensureManagedThemeSchema(managedSqlite);
  managedDb = drizzle(managedSqlite, { schema: themeSchema });
} else {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');

  const sqlite = new Database(dbPath);
  ensureThemeStudioSchema(sqlite);
  db = drizzle(sqlite, { schema });

  const managedSqlite = new Database(managedDbPath);
  ensureManagedThemeSchema(managedSqlite);
  managedDb = drizzle(managedSqlite, { schema: themeSchema });
}

export const databaseConfig = () => database({ default: db, managed: managedDb });
