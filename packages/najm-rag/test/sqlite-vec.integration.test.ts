import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { loadSqliteVec, setSqliteVecImporterForTests } from '../src/vectorStore/sqliteVecLoader';
import { encodeF32 } from '../src/vectorStore/vectorBlob';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ToolIndexRepository, ToolIndexerService } from '../src/toolIndex';
import { ToolIndexValidator } from '../src/toolIndex/ToolIndexValidator';
import { ragSchema } from '../src/schema/sqlite';
import { sql } from 'drizzle-orm';

describe('sqlite-vec integration', () => {
  function createDb() {
    const raw = new Database(':memory:');
    const db = drizzle(raw, { schema: ragSchema });
    return { raw, db };
  }

  function createRepo(db: any, strategy: SqliteVecStrategy): ToolIndexRepository {
    const validator = new ToolIndexValidator();
    (validator as any).schema = ragSchema;
    const repo = new ToolIndexRepository();
    (repo as any).db = db;
    (repo as any).vectors = strategy;
    (repo as any).validator = validator;
    return repo;
  }

  function createTables(raw: Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS chatbot_tool_embeddings (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        "group" TEXT,
        local_name TEXT,
        arg_names TEXT,
        annotations TEXT,
        fingerprint TEXT NOT NULL,
        embedding BLOB,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS chatbot_tool_semantics (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        phrase TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'und',
        source TEXT,
        source_file TEXT,
        embedding BLOB,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS semantics_tool_phrase_lang_idx ON chatbot_tool_semantics(tool_name, phrase, lang);
      CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx ON chatbot_tool_semantics(tool_name, lang);
      CREATE TABLE IF NOT EXISTS chatbot_interaction_logs (
        id TEXT PRIMARY KEY,
        session_key TEXT,
        user_query TEXT NOT NULL,
        query_lang TEXT,
        routing_enabled INTEGER NOT NULL DEFAULT 0,
        routing_status TEXT NOT NULL,
        routed_tools TEXT,
        actual_tool_names TEXT,
        model_tool_calls TEXT,
        model_answer TEXT,
        steps_count TEXT,
        success INTEGER,
        error TEXT,
        metadata TEXT,
        created_at TEXT
      );
    `);
  }

  test('loadSqliteVec succeeds and vec_version() returns a string', async () => {
    const { raw } = createDb();
    await loadSqliteVec(raw);
    const [{ version }] = raw.query('SELECT vec_version() as version').all() as any;
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  test('loadSqliteVec is idempotent for the same client', async () => {
    const { raw } = createDb();
    await loadSqliteVec(raw);
    await loadSqliteVec(raw); // should not throw
    expect(true).toBe(true);
  });

  test('loadSqliteVec throws clear install message when sqlite-vec is missing', async () => {
    const { raw } = createDb();
    setSqliteVecImporterForTests(async () => {
      throw new Error('Cannot find package sqlite-vec');
    });

    try {
      await expect(loadSqliteVec(raw)).rejects.toThrow('optional peer dependency `sqlite-vec`');
    } finally {
      setSqliteVecImporterForTests();
    }
  });

  test('loadSqliteVec throws clear message for invalid raw client', async () => {
    await expect(loadSqliteVec(null as any)).rejects.toThrow('raw sqlite client');
    await expect(loadSqliteVec(42 as any)).rejects.toThrow('raw sqlite client');
  });

  test('SqliteVecStrategy encodeEmbedding returns Buffer', () => {
    const strategy = new SqliteVecStrategy();
    const result = strategy.encodeEmbedding([0.1, 0.2, 0.3]);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  test('SqliteVecStrategy search returns ranked semantic matches', async () => {
    const { raw, db } = createDb();
    createTables(raw);
    await loadSqliteVec(raw);

    const strategy = new SqliteVecStrategy();
    const repo = createRepo(db, strategy);

    // Insert a tool embedding
    const embedding = new Array(768).fill(0.1);
    await repo.upsertEmbedding({
      toolName: 'students_get_students',
      description: 'List students',
      group: 'students',
      fingerprint: 'fp_abc',
      embedding,
    });

    // Search with identical embedding should return high similarity
    const results = await repo.searchEmbeddings(embedding, 5, 0.0);
    expect(results.length).toBe(1);
    expect(results[0].toolName).toBe('students_get_students');
    expect(results[0].similarity).toBeCloseTo(1.0, 3);
  });

  test('ToolIndexerService indexes and skips unchanged fingerprints on sqlite', async () => {
    const { raw, db } = createDb();
    createTables(raw);
    await loadSqliteVec(raw);

    const strategy = new SqliteVecStrategy();
    const repo = createRepo(db, strategy);

    const registry = {
      tools: [
        { name: 'tool_a', description: 'Tool A', group: 'g1', localName: null, validationArgs: null, annotations: null },
      ],
    } as any;

    const embedding = {
      embedBatch: mock(() => Promise.resolve([new Array(768).fill(0.1)])),
    } as any;

    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const indexer = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry,
      embedding,
      repo,
      log,
    );

    // First index
    const result1 = await indexer.indexTools();
    expect(result1.indexed).toBe(1);
    expect(result1.skipped).toBe(0);

    // Second index — fingerprint unchanged
    const result2 = await indexer.indexTools();
    expect(result2.indexed).toBe(0);
    expect(result2.skipped).toBe(1);
  });

  test('ToolIndexRepository upserts semantics with embeddings on sqlite', async () => {
    const { raw, db } = createDb();
    createTables(raw);
    await loadSqliteVec(raw);

    const strategy = new SqliteVecStrategy();
    const repo = createRepo(db, strategy);

    const embedding = new Array(768).fill(0.2);
    const status1 = await repo.upsertSemantic({
      toolName: 'students_get_students',
      phrase: 'list students',
      lang: 'en',
      embedding,
    });
    expect(status1).toBe('inserted');

    const status2 = await repo.upsertSemantic({
      toolName: 'students_get_students',
      phrase: 'list students',
      lang: 'en',
      embedding: new Array(768).fill(0.3),
    });
    expect(status2).toBe('updated');

    const results = await repo.searchSemantics(new Array(768).fill(0.2), 5, 0.0);
    expect(results.length).toBe(1);
    expect(results[0].toolName).toBe('students_get_students');
  });

  test('ToolIndexRepository heals legacy semantics tables without source_file', async () => {
    const { raw, db } = createDb();
    raw.exec(`
      CREATE TABLE IF NOT EXISTS chatbot_tool_semantics (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        phrase TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'und',
        source TEXT,
        embedding BLOB,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS semantics_tool_phrase_lang_idx ON chatbot_tool_semantics(tool_name, phrase, lang);
      INSERT INTO chatbot_tool_semantics (id, tool_name, phrase, lang, source)
      VALUES ('legacy_1', 'students_get_students', 'list students', 'en', 'fixture');
    `);

    const strategy = new SqliteVecStrategy();
    const repo = createRepo(db, strategy);

    const rows = await repo.listSemantics();
    expect(rows.length).toBe(1);
    expect(rows[0].sourceFile).toBeNull();

    const status = await repo.upsertSemantic({
      toolName: 'students_get_students',
      phrase: 'show students',
      lang: 'en',
      source: 'import',
      sourceFile: 'semantics.json',
      embedding: new Array(768).fill(0.2),
    });
    expect(status).toBe('inserted');

    const columns = raw.query('PRAGMA table_info(chatbot_tool_semantics)').all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === 'source_file')).toBe(true);

    const [{ sourceFile }] = raw
      .query('SELECT source_file AS sourceFile FROM chatbot_tool_semantics WHERE phrase = ?')
      .all('show students') as Array<{ sourceFile: string | null }>;
    expect(sourceFile).toBe('semantics.json');
  });

  test('searchSemantics fallback to searchEmbeddings when semantics empty', async () => {
    const { raw, db } = createDb();
    createTables(raw);
    await loadSqliteVec(raw);

    const strategy = new SqliteVecStrategy();
    const repo = createRepo(db, strategy);

    const embedding = new Array(768).fill(0.1);
    await repo.upsertEmbedding({
      toolName: 'tool_a',
      description: 'Tool A',
      fingerprint: 'fp_a',
      embedding,
    });

    const results = await repo.searchSemantics(embedding, 5, 0.0);
    expect(results.length).toBe(0);

    const fallback = await repo.searchEmbeddings(embedding, 5, 0.0);
    expect(fallback.length).toBe(1);
    expect(fallback[0].toolName).toBe('tool_a');
  });
});
