import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { loadSqliteVec } from '../src/vectorStore/sqliteVecLoader';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';
import { KnowledgeRepository } from '../src/knowledge/KnowledgeRepository';
import { KnowledgeValidator } from '../src/knowledge/KnowledgeValidator';
import { DocumentSourceRepository } from '../src/knowledge/DocumentSourceRepository';
import { DocumentIngestionService } from '../src/knowledge/DocumentIngestionService';
import { TextChunker } from '../src/knowledge/TextChunker';
import { MarkdownChunker } from '../src/knowledge/MarkdownChunker';
import { sql } from 'drizzle-orm';

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

function createDocumentSourceRepository(db: any, strategy: SqliteVecStrategy): DocumentSourceRepository {
  const validator = new KnowledgeValidator();
  (validator as any).schema = ragSchema;
  const repo = new DocumentSourceRepository();
  (repo as any).db = db;
  (repo as any).vectors = strategy;
  (repo as any).validator = validator;
  return repo;
}

function createKnowledgeRepository(db: any, strategy: SqliteVecStrategy): KnowledgeRepository {
  const validator = new KnowledgeValidator();
  (validator as any).schema = ragSchema;
  const repo = new KnowledgeRepository();
  (repo as any).db = db;
  (repo as any).vectors = strategy;
  (repo as any).validator = validator;
  return repo;
}

describe('DocumentSourceRepository', () => {
  test('creates a source and retrieves it', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const source = await repo.createSource({
      sourceType: 'text',
      originalPath: 'text://text',
      namespace: 'rag',
    });

    expect(source.id).toBeDefined();
    expect(source.sourceType).toBe('text');
    expect(source.status).toBe('pending');

    const retrieved = await repo.getSourceById(source.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(source.id);
  });

  test('updates source status to ready', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const source = await repo.createSource({
      sourceType: 'text',
      originalPath: 'text://text',
    });

    await repo.updateSourceStatus(source.id, 'ready');
    const updated = await repo.getSourceById(source.id);
    expect(updated!.status).toBe('ready');
    expect(updated!.ingestedAt).not.toBeNull();
  });

  test('updates source status to failed with error', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const source = await repo.createSource({
      sourceType: 'markdown',
      originalPath: 'text://markdown',
    });

    await repo.updateSourceStatus(source.id, 'failed', 'Something went wrong');
    const updated = await repo.getSourceById(source.id);
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('Something went wrong');
  });

  test('creates chunks and retrieves them by document ID', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const source = await repo.createSource({ sourceType: 'text', originalPath: 'text://text' });

    const chunks = await repo.createChunks([
      { documentId: source.id, ordinal: 0, text: 'Chunk 0', tokens: 10, page: null },
      { documentId: source.id, ordinal: 1, text: 'Chunk 1', tokens: 12, page: null },
      { documentId: source.id, ordinal: 2, text: 'Chunk 2', tokens: 8, page: 3 },
    ]);

    expect(chunks.length).toBe(3);
    expect(chunks[0].text).toBe('Chunk 0');
    expect(chunks[2].page).toBe(3);

    const retrieved = await repo.getChunksByDocumentId(source.id);
    expect(retrieved.length).toBe(3);
  });

  test('deletes source cascades to chunks and embeddings', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const source = await repo.createSource({ sourceType: 'text', originalPath: 'text://text' });
    const chunks = await repo.createChunks([
      { documentId: source.id, ordinal: 0, text: 'Chunk 0', tokens: 10 },
    ]);

    await repo.createEmbedding({
      chunkId: chunks[0].id,
      embedding: new Array(768).fill(0.1),
      model: 'test',
      dimensions: 768,
    });

    const embeddingCountBefore = await repo.countEmbeddings();
    expect(embeddingCountBefore).toBe(1);

    await repo.deleteSource(source.id);

    const sourceAfter = await repo.getSourceById(source.id);
    expect(sourceAfter).toBeNull();

    const chunksAfter = await repo.getChunksByDocumentId(source.id);
    expect(chunksAfter.length).toBe(0);

    const embeddingCountAfter = await repo.countEmbeddings();
    expect(embeddingCountAfter).toBe(0);
  });

  test('counts sources and chunks', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    expect(await repo.countSources()).toBe(0);
    expect(await repo.countChunks()).toBe(0);

    const s1 = await repo.createSource({ sourceType: 'text', originalPath: 'a' });
    const s2 = await repo.createSource({ sourceType: 'text', originalPath: 'b' });
    await repo.createChunks([
      { documentId: s1.id, ordinal: 0, text: 'c1', tokens: 5 },
      { documentId: s1.id, ordinal: 1, text: 'c2', tokens: 5 },
    ]);

    expect(await repo.countSources()).toBe(2);
    expect(await repo.countChunks()).toBe(2);
  });
});

describe('DocumentIngestionService', () => {
  test('ingests plain text: chunk → embed → store → search round-trip', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const embeddingMock = {
      embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
      embedBatch: mock((texts: string[]) => Promise.resolve(texts.map(() => new Array(768).fill(0.1)))),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test-model', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(
      repo as any,
      embeddingMock as any,
      config as any,
      log as any,
    );

    const text = 'This is the first paragraph about cats.\n\nThis is the second paragraph about dogs.\n\nThis is the third paragraph about birds.';

    const result = await service.ingestText({
      sourceType: 'text',
      text,
      namespace: 'rag',
      originalPath: 'text://test',
      chunkOptions: { targetTokens: 20, overlapTokens: 0 },
    });

    expect(result.documentId).toBeDefined();
    expect(result.chunks).toBeGreaterThan(0);
    expect(result.embedded).toBe(result.chunks);
    expect(result.failed).toBe(0);

    const source = await repo.getSourceById(result.documentId);
    expect(source!.status).toBe('ready');

    const chunks = await repo.getChunksByDocumentId(result.documentId);
    expect(chunks.length).toBe(result.chunks);

    const knowledgeRepo = createKnowledgeRepository(db, strategy);
    const queryEmbedding = new Array(768).fill(0.1);
    const matches = await knowledgeRepo.searchChunks(queryEmbedding, 5, 0.0);
    expect(matches.length).toBeGreaterThan(0);
  });

  test('ingests markdown text using MarkdownChunker', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const embeddingMock = {
      embed: mock(() => Promise.resolve(new Array(768).fill(0.2))),
      embedBatch: mock((texts: string[]) => Promise.resolve(texts.map(() => new Array(768).fill(0.2)))),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test-model', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(
      repo as any,
      embeddingMock as any,
      config as any,
      log as any,
    );

    const markdown = '# Title\n\nThis has **bold** text.\n\n## Section\n\nMore *italic* text here.';

    const result = await service.ingestText({
      sourceType: 'markdown',
      text: markdown,
      namespace: 'rag',
      originalPath: 'text://markdown-test',
      chunkOptions: { targetTokens: 20, overlapTokens: 0 },
    });

    expect(result.chunks).toBeGreaterThan(0);
    expect(result.embedded).toBe(result.chunks);

    const chunks = await repo.getChunksByDocumentId(result.documentId);
    for (const chunk of chunks) {
      expect(chunk.text).not.toContain('**');
      expect(chunk.text).not.toContain('#');
    }
  });

  test('handles empty text gracefully', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const embeddingMock = {
      embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
      embedBatch: mock((texts: string[]) => Promise.resolve(texts.map(() => new Array(768).fill(0.1)))),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test-model', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(
      repo as any,
      embeddingMock as any,
      config as any,
      log as any,
    );

    const result = await service.ingestText({
      sourceType: 'text',
      text: '   ',
      namespace: 'rag',
    });

    expect(result.chunks).toBe(0);
    expect(result.embedded).toBe(0);
    expect(result.failed).toBe(0);

    const source = await repo.getSourceById(result.documentId);
    expect(source!.status).toBe('failed');
  });

  test('handles embedding failure gracefully', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    const embeddingMock = {
      embed: mock(() => Promise.reject(new Error('embedding down'))),
      embedBatch: mock(() => Promise.reject(new Error('embedding down'))),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(
      repo as any,
      embeddingMock as any,
      config as any,
      log as any,
    );

    const result = await service.ingestText({
      sourceType: 'text',
      text: 'Some text that will produce chunks but fail embedding.',
      namespace: 'rag',
      chunkOptions: { targetTokens: 20, overlapTokens: 0 },
    });

    expect(result.chunks).toBeGreaterThan(0);
    expect(result.embedded).toBe(0);
    expect(result.failed).toBe(result.chunks);

    const source = await repo.getSourceById(result.documentId);
    expect(source!.status).toBe('failed');
  });

  test('creates embeddings in batches', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const strategy = new SqliteVecStrategy();
    const repo = createDocumentSourceRepository(db, strategy);

    let batchCalls = 0;
    const embeddingMock = {
      embed: mock(() => Promise.resolve(new Array(768).fill(0.5))),
      embedBatch: mock((texts: string[]) => {
        batchCalls++;
        return Promise.resolve(texts.map(() => new Array(768).fill(0.5)));
      }),
    };

    const config = {
      knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
      rag: { embedding: { model: 'test', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
    };

    const log = { info: mock(() => {}), error: mock(() => {}) };

    const service = new DocumentIngestionService(
      repo as any,
      embeddingMock as any,
      config as any,
      log as any,
    );

    const result = await service.ingestText({
      sourceType: 'text',
      text: Array.from({ length: 30 }, (_, i) => `Paragraph number ${i} has enough content for chunking.`).join('\n\n'),
      namespace: 'rag',
      chunkOptions: { targetTokens: 30, overlapTokens: 0 },
    });

    expect(result.chunks).toBeGreaterThan(0);
    expect(result.embedded).toBe(result.chunks);
    expect(batchCalls).toBeGreaterThan(0);

    const embeddingCount = await repo.countEmbeddings();
    expect(embeddingCount).toBe(result.chunks);
  });
});