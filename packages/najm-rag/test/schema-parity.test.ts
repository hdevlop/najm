/**
 * H4: an app that creates najm-rag's tables from the exported Drizzle schema
 * (drizzle-kit generate/migrate) must end up with the schema the runtime
 * checks expect, so those checks find nothing to change.
 */
import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { generateSQLiteDrizzleJson, generateSQLiteMigration, generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as sqliteTables from '../src/schema/sqlite';
import * as pgTables from '../src/schema/pg';
import { ToolIndexRepository } from '../src/toolIndex/ToolIndexRepository';
import { ToolIndexValidator } from '../src/toolIndex/ToolIndexValidator';
import { RoutingSettingsRepository } from '../src/routingSettings/RoutingSettingsRepository';
import { RoutingTestsRepository } from '../src/routingTests/RoutingTestsRepository';
import { UnmatchedQueryRepository } from '../src/unmatched/UnmatchedQueryRepository';
import { SqliteVecStrategy, PgVectorStrategy } from '../src/vectorStore';
import { rag } from '../src/plugin';

/** Each repository with a runtime schema step, wired to `db`, and a call that runs the step. */
function repositories(db: any, dialect: 'sqlite' | 'pg', schema: any, ensureSchema = true) {
  const config = { dialect, ensureSchema, rag: { embedding: { model: 'embeddinggemma' } }, toolRouting: { enabled: true } } as any;
  const validator = new ToolIndexValidator();
  (validator as any).schema = schema;
  const tools = Object.assign(new ToolIndexRepository(), {
    db, validator, config, vectors: dialect === 'sqlite' ? new SqliteVecStrategy() : new PgVectorStrategy(),
  });
  const settings = Object.assign(new RoutingSettingsRepository(), { db, schema, config });
  const tests = Object.assign(new RoutingTestsRepository(), { db, schema, config });
  const unmatched = Object.assign(new UnmatchedQueryRepository(), { db, schema, config });
  return async () => {
    await tools.countStaleSemantics(); // runs the semantics table check
    await settings.get();
    await tests.list();
    await unmatched.count();
  };
}

async function sqliteSchema(raw: Database) {
  const tables = raw.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>;
  const out: Record<string, unknown> = {};
  for (const { name } of tables) {
    out[name] = {
      columns: (raw.query(`PRAGMA table_info(${name})`).all() as any[])
        .map((c) => `${c.name} ${c.type.toLowerCase()}${c.notnull ? ' not null' : ''}${c.dflt_value != null ? ` default ${c.dflt_value}` : ''}`)
        .sort(),
      indexes: (raw.query(`PRAGMA index_list(${name})`).all() as any[])
        .map((i) => `${i.unique ? 'unique ' : ''}${(raw.query(`PRAGMA index_info(${i.name})`).all() as any[]).map((c) => c.name).join(',')}`)
        .sort(),
    };
  }
  return out;
}

async function pgSchema(client: PGlite) {
  const cols = await client.query<any>(`SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name`);
  const idx = await client.query<any>(`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`);
  const out: Record<string, { columns: string[]; indexes: string[] }> = {};
  for (const c of cols.rows) {
    (out[c.table_name] ??= { columns: [], indexes: [] }).columns
      .push(`${c.column_name} ${c.udt_name}${c.is_nullable === 'NO' ? ' not null' : ''}${c.column_default != null ? ` default ${c.column_default}` : ''}`);
  }
  for (const i of idx.rows) {
    // Index names differ between generators; compare what is indexed.
    const def = String(i.indexdef).replace(/INDEX \S+ ON/, 'INDEX ON');
    (out[i.tablename] ??= { columns: [], indexes: [] }).indexes.push(def);
  }
  for (const t of Object.values(out)) { t.columns.sort(); t.indexes.sort(); }
  return out;
}

describe('H4: the Drizzle schema matches what the runtime checks expect', () => {
  test('SQLite: tables made from ragSchema need no runtime change', async () => {
    const raw = new Database(':memory:');
    const statements = await generateSQLiteMigration(
      await generateSQLiteDrizzleJson({}),
      await generateSQLiteDrizzleJson(sqliteTables as any),
    );
    for (const statement of statements) raw.exec(statement);
    const before = await sqliteSchema(raw);
    await repositories(drizzleSqlite(raw, { schema: sqliteTables.ragSchema }), 'sqlite', sqliteTables.ragSchema)();
    expect(await sqliteSchema(raw)).toEqual(before);
  });

  test('PostgreSQL: tables made from ragSchema need no runtime change', async () => {
    // This PGlite build has no pgvector, so vector columns are stored as real[]
    // and the HNSW index is left out. The runtime checks never touch either.
    const client = await PGlite.create();
    const statements = (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(pgTables as any)))
      .filter((statement) => !/USING hnsw/i.test(statement))
      .map((statement) => statement.replace(/vector\(\d+\)/g, 'real[]'));
    for (const statement of statements) await client.exec(statement);
    const before = await pgSchema(client);
    await repositories(drizzlePglite(client, { schema: pgTables.ragSchema }), 'pg', pgTables.ragSchema)();
    expect(await pgSchema(client)).toEqual(before);
    await client.close();
  }, 30_000);
});

describe('H4: ensureSchema', () => {
  /** Tables as an earlier release left them: no fingerprint, no nearest_tool, no routing tests. */
  function legacyDb() {
    const raw = new Database(':memory:');
    raw.exec(`CREATE TABLE chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'und', source TEXT, source_file TEXT, embedding BLOB, created_at TEXT, updated_at TEXT);
      CREATE TABLE chatbot_routing_settings (id TEXT PRIMARY KEY, enable_knowledge INTEGER NOT NULL DEFAULT 1, allowed_langs TEXT);
      CREATE TABLE chatbot_unmatched_queries (id TEXT PRIMARY KEY, query TEXT NOT NULL, normalized TEXT NOT NULL UNIQUE,
      score TEXT NOT NULL, threshold TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'router', occurrence_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT, updated_at TEXT);`);
    return raw;
  }

  test('false: repositories leave the schema as it is', async () => {
    const raw = legacyDb();
    const before = await sqliteSchema(raw);
    // The queries themselves may fail on the old tables; only the schema matters here.
    await repositories(drizzleSqlite(raw, { schema: sqliteTables.ragSchema }), 'sqlite', sqliteTables.ragSchema, false)().catch(() => {});
    expect(await sqliteSchema(raw)).toEqual(before);
  });

  test('true (the default): the same tables are brought up to date', async () => {
    const raw = legacyDb();
    await repositories(drizzleSqlite(raw, { schema: sqliteTables.ragSchema }), 'sqlite', sqliteTables.ragSchema)();
    const after = await sqliteSchema(raw) as any;
    expect(after.chatbot_tool_semantics.columns).toContain('fingerprint text');
    expect(after.chatbot_unmatched_queries.columns).toContain('nearest_tool text');
    expect(after.chatbot_routing_tests).toBeDefined();
  });

  test('rag() defaults it to true and passes false through', () => {
    const merged = (config: any) => (rag({ dialect: 'sqlite', toolRouting: { enabled: true }, ...config }) as any).config;
    expect(merged({}).ensureSchema).toBe(true);
    expect(merged({ ensureSchema: false }).ensureSchema).toBe(false);
  });
});
