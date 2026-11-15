/**
 * H4: tables created from najm-chatbot's exported Drizzle schema (what an
 * app's drizzle-kit migration produces) need no runtime schema change.
 */
import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { generateSQLiteDrizzleJson, generateSQLiteMigration, generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { chatbotCoreSchema as sqliteSchema } from '../src/schema/internal/sqlite';
import { chatbotCoreSchema as pgSchema } from '../src/schema/internal/pg';
import { AiSettingsRepository } from '../src/ai-settings/AiSettingsRepository';
import { ChatSessionRepository } from '../src/sessions/ChatSessionRepository';
import { chatbot } from '../src/ChatbotPlugin';

function runChecks(db: any, dialect: 'sqlite' | 'pg', schema: any, ensureSchema = true) {
  const config = { dialect, ensureSchema };
  const settings = Object.assign(new AiSettingsRepository(), { db, schema, config, encryption: { decrypt: (v: string) => v } });
  const sessions = Object.assign(new ChatSessionRepository(), { db, schema, config });
  return Promise.all([settings.get(), sessions.findByKey('none')]);
}

function sqliteShape(raw: Database) {
  const tables = raw.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>;
  return Object.fromEntries(tables.map(({ name }) => [name, {
    columns: (raw.query(`PRAGMA table_info(${name})`).all() as any[])
      .map((c) => `${c.name} ${c.type.toLowerCase()}${c.notnull ? ' not null' : ''}${c.dflt_value != null ? ` default ${c.dflt_value}` : ''}`).sort(),
    indexes: (raw.query(`PRAGMA index_list(${name})`).all() as any[])
      .map((i) => `${i.unique ? 'unique ' : ''}${(raw.query(`PRAGMA index_info(${i.name})`).all() as any[]).map((c) => c.name).join(',')}`).sort(),
  }]));
}

async function pgShape(client: PGlite) {
  const cols = await client.query<any>(`SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public'`);
  const idx = await client.query<any>(`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`);
  const out: Record<string, { columns: string[]; indexes: string[] }> = {};
  for (const c of cols.rows) {
    (out[c.table_name] ??= { columns: [], indexes: [] }).columns
      .push(`${c.column_name} ${c.udt_name}${c.is_nullable === 'NO' ? ' not null' : ''}${c.column_default != null ? ` default ${c.column_default}` : ''}`);
  }
  for (const i of idx.rows) (out[i.tablename] ??= { columns: [], indexes: [] }).indexes.push(String(i.indexdef).replace(/INDEX \S+ ON/, 'INDEX ON'));
  for (const t of Object.values(out)) { t.columns.sort(); t.indexes.sort(); }
  return out;
}

describe('H4: the chatbot Drizzle schema matches what the runtime checks expect', () => {
  test('SQLite', async () => {
    const raw = new Database(':memory:');
    for (const s of await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(sqliteSchema as any))) raw.exec(s);
    const before = sqliteShape(raw);
    await runChecks(drizzleSqlite(raw, { schema: sqliteSchema }), 'sqlite', sqliteSchema);
    expect(sqliteShape(raw)).toEqual(before);
  });

  test('PostgreSQL', async () => {
    const client = await PGlite.create();
    for (const s of await generateMigration(generateDrizzleJson({}), generateDrizzleJson(pgSchema as any))) await client.exec(s);
    const before = await pgShape(client);
    await runChecks(drizzlePglite(client, { schema: pgSchema }), 'pg', pgSchema);
    expect(await pgShape(client)).toEqual(before);
    await client.close();
  }, 30_000);
});

describe('H4: chatbot ensureSchema', () => {
  /** Tables from a release before the memory and session-list columns. */
  function legacyDb() {
    const raw = new Database(':memory:');
    raw.exec(`CREATE TABLE ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT,
      base_url TEXT, model TEXT, system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT);
      CREATE TABLE chat_sessions (id TEXT PRIMARY KEY, session_key TEXT NOT NULL UNIQUE, user_id TEXT, channel TEXT NOT NULL DEFAULT 'web',
      messages TEXT NOT NULL DEFAULT '[]', expires_at TEXT, created_at TEXT, updated_at TEXT);`);
    return raw;
  }

  test('false: the repositories leave old tables as they are', async () => {
    const raw = legacyDb();
    const before = sqliteShape(raw);
    await runChecks(drizzleSqlite(raw, { schema: sqliteSchema }), 'sqlite', sqliteSchema, false).catch(() => {});
    expect(sqliteShape(raw)).toEqual(before);
  });

  test('true (the default): the same tables gain the missing columns', async () => {
    const raw = legacyDb();
    await runChecks(drizzleSqlite(raw, { schema: sqliteSchema }), 'sqlite', sqliteSchema).catch(() => {});
    const after = sqliteShape(raw) as any;
    expect(after.chat_sessions.columns.some((c: string) => c.startsWith('title '))).toBe(true);
    expect(after.ai_settings.columns.some((c: string) => c.startsWith('use_memory '))).toBe(true);
  });

  test('chatbot() defaults it to true and passes false through', () => {
    const merged = (config: any) => (chatbot({ dialect: 'sqlite', ...config }) as any).config;
    expect(merged({}).ensureSchema).toBe(true);
    expect(merged({ ensureSchema: false }).ensureSchema).toBe(false);
  });
});
