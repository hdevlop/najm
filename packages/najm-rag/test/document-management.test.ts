import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { loadSqliteVec } from '../src/vectorStore/sqliteVecLoader';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';
import { DocumentSourceRepository } from '../src/knowledge/DocumentSourceRepository';
import { DocumentIngestionService } from '../src/knowledge/DocumentIngestionService';
import { KnowledgeValidator } from '../src/knowledge/KnowledgeValidator';

function createTestDb() {
  const raw = new Database(':memory:');
  const db = drizzle(raw, { schema: ragSchema });
  return { raw, db };
}

function createTables(raw: Database) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS chatbot_document_sources (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL DEFAULT 'rag',
      source_type TEXT NOT NULL,
      original_path TEXT NOT NULL,
      ext TEXT NOT NULL DEFAULT '',
      mime TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      ingested_at TEXT,
      metadata TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS chatbot_document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      page INTEGER,
      text TEXT NOT NULL,
      tokens INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      metadata TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS chatbot_document_embeddings (
      id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL UNIQUE,
      embedding BLOB,
      model TEXT NOT NULL DEFAULT '',
      dimensions INTEGER NOT NULL DEFAULT 768,
      created_at TEXT
    );
  `);
}

function createDocRepo(db: any, strategy: SqliteVecStrategy): DocumentSourceRepository {
  const validator = new KnowledgeValidator();
  (validator as any).schema = ragSchema;
  const repo = new DocumentSourceRepository();
  (repo as any).db = db;
  (repo as any).vectors = strategy;
  (repo as any).validator = validator;
  return repo;
}

describe('DocumentSourceRepository - Phase 6C', () => {
  test('listSourcesWithChunkCount returns empty array when no sources', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const result = await repo.listSourcesWithChunkCount();
    expect(result).toEqual([]);
  });

  test('listSourcesWithChunkCount returns sources with accurate chunk counts', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const s1 = await repo.createSource({ sourceType: 'text', originalPath: 'text://a', namespace: 'rag' });
    const s2 = await repo.createSource({ sourceType: 'text', originalPath: 'text://b', namespace: 'rag' });

    await repo.createChunks([
      { documentId: s1.id, ordinal: 0, text: 'c1', tokens: 5 },
      { documentId: s1.id, ordinal: 1, text: 'c2', tokens: 5 },
      { documentId: s1.id, ordinal: 2, text: 'c3', tokens: 5 },
    ]);
    await repo.createChunks([
      { documentId: s2.id, ordinal: 0, text: 'c4', tokens: 5 },
    ]);

    const result = await repo.listSourcesWithChunkCount('rag');
    expect(result.length).toBe(2);

    const s1Result = result.find((r) => r.id === s1.id);
    const s2Result = result.find((r) => r.id === s2.id);

    expect(s1Result!.chunkCount).toBe(3);
    expect(s2Result!.chunkCount).toBe(1);
    expect(s1Result!.sourceType).toBe('text');
    expect(s1Result!.status).toBe('pending');
  });

  test('listSourcesWithChunkCount filters by namespace', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    await repo.createSource({ sourceType: 'text', originalPath: 'a', namespace: 'ns1' });
    await repo.createSource({ sourceType: 'text', originalPath: 'b', namespace: 'ns2' });
    await repo.createSource({ sourceType: 'text', originalPath: 'c', namespace: 'ns1' });

    const ns1 = await repo.listSourcesWithChunkCount('ns1');
    expect(ns1.length).toBe(2);

    const ns2 = await repo.listSourcesWithChunkCount('ns2');
    expect(ns2.length).toBe(1);
  });

  test('deleteSource removes source and cascades chunks and embeddings', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const source = await repo.createSource({ sourceType: 'text', originalPath: 'text://test' });
    const chunks = await repo.createChunks([
      { documentId: source.id, ordinal: 0, text: 'c1', tokens: 5 },
    ]);
    await repo.createEmbedding({ chunkId: chunks[0].id, embedding: new Array(768).fill(0.1) });

    expect(await repo.countSources()).toBe(1);
    expect(await repo.countChunks()).toBe(1);
    expect(await repo.countEmbeddings()).toBe(1);

    await repo.deleteSource(source.id);

    expect(await repo.countSources()).toBe(0);
    expect(await repo.countChunks()).toBe(0);
    expect(await repo.countEmbeddings()).toBe(0);
  });

  test('deleteAllChunksForDocument returns chunk IDs and deletes embeddings', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const source = await repo.createSource({ sourceType: 'text', originalPath: 'text://test' });
    const chunks = await repo.createChunks([
      { documentId: source.id, ordinal: 0, text: 'c1', tokens: 5 },
      { documentId: source.id, ordinal: 1, text: 'c2', tokens: 5 },
    ]);
    await repo.createEmbeddings(chunks.map((c) => ({
      chunkId: c.id,
      embedding: new Array(768).fill(0.2),
    })));

    expect(await repo.countEmbeddings()).toBe(2);

    const deletedIds = await repo.deleteAllChunksForDocument(source.id);

    expect(deletedIds.length).toBe(2);
    expect(await repo.countChunks()).toBe(0);
    expect(await repo.countEmbeddings()).toBe(0);
  });

  test('getChunksByDocumentId returns chunks ordered by ordinal', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const source = await repo.createSource({ sourceType: 'text', originalPath: 'text://test' });
    await repo.createChunks([
      { documentId: source.id, ordinal: 2, text: 'third', tokens: 3 },
      { documentId: source.id, ordinal: 0, text: 'first', tokens: 3 },
      { documentId: source.id, ordinal: 1, text: 'second', tokens: 3 },
    ]);

    const chunks = await repo.getChunksByDocumentId(source.id);
    expect(chunks.length).toBe(3);
    expect(chunks[0].ordinal).toBe(2);
    expect(chunks[1].ordinal).toBe(0);
    expect(chunks[2].ordinal).toBe(1);
  });
});

describe('DocumentIngestionService - Phase 6C', () => {
  test('reindexDocument clears old chunks and embeddings then re-ingests', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    let embedBatchCount = 0;
    const embeddingMock = {
      embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
      embedBatch: mock((texts: string[]) => {
        embedBatchCount++;
        return Promise.resolve(texts.map(() => new Array(768).fill(0.3)));
      }),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test-model', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(repo as any, embeddingMock as any, config as any, log as any);

    const text = 'First para here.\n\nSecond para here.\n\nThird para here.';

    const ingestResult = await service.ingestText({
      sourceType: 'text',
      text,
      namespace: 'rag',
      originalPath: 'text://test',
      chunkOptions: { targetTokens: 30, overlapTokens: 0 },
    });

    expect(ingestResult.chunks).toBeGreaterThan(0);
    expect(ingestResult.embedded).toBe(ingestResult.chunks);

    const sourceBefore = await repo.getSourceById(ingestResult.documentId);
    expect(sourceBefore!.metadata).not.toBeNull();
    expect((sourceBefore!.metadata as any).sourceText).toBe(text);

    const reindexResult = await service.reindexDocument(ingestResult.documentId, { targetTokens: 30, overlapTokens: 0 });

    expect(reindexResult.documentId).toBe(ingestResult.documentId);
    expect(reindexResult.chunks).toBeGreaterThan(0);
    expect(reindexResult.embedded).toBe(reindexResult.chunks);
    expect(reindexResult.failed).toBe(0);

    const newChunks = await repo.getChunksByDocumentId(ingestResult.documentId);
    expect(newChunks.length).toBe(reindexResult.chunks);

    const sourceAfter = await repo.getSourceById(ingestResult.documentId);
    expect(sourceAfter!.status).toBe('ready');
  });

  test('reindexDocument returns zero counts for non-existent document', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const embeddingMock = { embed: mock(() => Promise.resolve([])), embedBatch: mock(() => Promise.resolve([])) };
    const config = { knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' }, rag: { embedding: { model: 't', dimensions: 768, provider: 'ollama', baseUrl: '' } } };
    const log = { info: mock(() => {}), error: mock(() => {}) };
    const service = new DocumentIngestionService(repo as any, embeddingMock as any, config as any, log as any);

    const result = await service.reindexDocument('nonexistent-id');
    expect(result.documentId).toBe('nonexistent-id');
    expect(result.chunks).toBe(0);
    expect(result.embedded).toBe(0);
    expect(result.failed).toBe(0);
  });

  test('getKnowledgeStatus aggregates counts across all tables', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocRepo(db, strategy);

    const s1 = await repo.createSource({ sourceType: 'text', originalPath: 'a' });
    await repo.createChunks([
      { documentId: s1.id, ordinal: 0, text: 'c1', tokens: 5 },
      { documentId: s1.id, ordinal: 1, text: 'c2', tokens: 5 },
    ]);
    const chunks = await repo.getChunksByDocumentId(s1.id);
    await repo.createEmbeddings(chunks.map((c) => ({ chunkId: c.id, embedding: new Array(768).fill(0.1) })));

    const s2 = await repo.createSource({ sourceType: 'markdown', originalPath: 'b' });
    await repo.createChunks([{ documentId: s2.id, ordinal: 0, text: 'c3', tokens: 5 }]);

    expect(await repo.countSources()).toBe(2);
    expect(await repo.countChunks()).toBe(3);
    expect(await repo.countEmbeddings()).toBe(2);
  });
});