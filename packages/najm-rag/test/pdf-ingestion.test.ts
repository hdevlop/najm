import { describe, afterEach, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { loadSqliteVec } from '../src/vectorStore/sqliteVecLoader';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';
import { KnowledgeValidator } from '../src/knowledge/KnowledgeValidator';
import { DocumentSourceRepository } from '../src/knowledge/DocumentSourceRepository';
import { DocumentIngestionService } from '../src/knowledge/DocumentIngestionService';
import { FileExtractor } from '../src/knowledge/FileExtractor';
import { PdfExtractor, setPdfParserForTests } from '../src/knowledge/PdfExtractor';

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

function createService(repo: DocumentSourceRepository, storage: any, pdf = new PdfExtractor()) {
  const embeddingMock = {
    embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
    embedBatch: mock((texts: string[]) => Promise.resolve(texts.map(() => new Array(768).fill(0.1)))),
  };
  const config = {
    knowledge: { enabled: true, namespace: 'rag', basePath: 'storage' },
    rag: { embedding: { model: 'test-model', dimensions: 768, provider: 'ollama', baseUrl: 'http://localhost' } },
  };
  const log = { info: mock(() => {}), error: mock(() => {}) };
  const service = new DocumentIngestionService(repo as any, embeddingMock as any, config as any, log as any);
  const extractor = new FileExtractor();
  (extractor as any).storage = storage;
  (extractor as any).pdf = pdf;
  (service as any).storage = storage;
  (service as any).extractor = extractor;
  return { service, embeddingMock };
}

describe('PdfExtractor', () => {
  afterEach(() => {
    setPdfParserForTests();
  });

  test('extracts page text and page count through pdf-parse', async () => {
    setPdfParserForTests(async (_buffer, options: any) => {
      await options.pagerender({
        getTextContent: async () => ({ items: [{ str: 'Page one' }] }),
      });
      await options.pagerender({
        getTextContent: async () => ({ items: [{ str: 'Page two' }] }),
      });
      return { text: 'Page one\n\nPage two', numpages: 2 };
    });

    const extractor = new PdfExtractor();
    const result = await extractor.extract(Buffer.from('fake pdf bytes'));

    expect(result.pageCount).toBe(2);
    expect(result.pages).toEqual([
      { page: 1, text: 'Page one' },
      { page: 2, text: 'Page two' },
    ]);
    expect(result.text).toContain('Page one');
  });
});

describe('DocumentIngestionService PDF upload', () => {
  afterEach(() => {
    setPdfParserForTests();
  });

  test('stores PDF upload, extracts pages, chunks with page numbers, and embeds', async () => {
    setPdfParserForTests(async (_buffer, options: any) => {
      await options.pagerender({
        getTextContent: async () => ({ items: [{ str: 'First page has alpha content.' }] }),
      });
      await options.pagerender({
        getTextContent: async () => ({ items: [{ str: 'Second page has beta content.' }] }),
      });
      return { text: 'First page has alpha content.\n\nSecond page has beta content.', numpages: 2 };
    });

    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const repo = createDocRepo(db, new SqliteVecStrategy());

    const files = new Map<string, Buffer>();
    const storage = {
      saveFile: mock(async (namespace: string, path: string, file: File) => {
        files.set(`${namespace}/${path}`, Buffer.from(await file.arrayBuffer()));
        return { namespace, filePath: path, mimeType: file.type, size: file.size };
      }),
      get: mock(async (namespace: string, path: string) => files.get(`${namespace}/${path}`) ?? null),
      delete: mock(async (namespace: string, path: string) => files.delete(`${namespace}/${path}`)),
    };
    const { service } = createService(repo, storage);

    const file = new File([Buffer.from('%PDF fake')], 'guide.pdf', { type: 'application/pdf' });
    const result = await service.ingestUpload({
      file,
      namespace: 'rag',
      chunkOptions: { targetTokens: 20, overlapTokens: 0 },
    });

    expect(result.sourceType).toBe('pdf');
    expect(result.originalPath).toMatch(/^sources\/.+\/original\.pdf$/);
    expect(result.embedded).toBe(result.chunks);
    expect(storage.saveFile).toHaveBeenCalledTimes(1);

    const source = await repo.getSourceById(result.documentId);
    expect(source!.status).toBe('ready');
    expect(source!.mime).toBe('application/pdf');

    const chunks = await repo.getChunksByDocumentId(result.documentId);
    expect(chunks.map((c) => c.page)).toEqual([1, 2]);
    expect(chunks[0].text).toContain('First page');
  });

  test('uploads plain text files through the same storage-backed path', async () => {
    const { raw, db } = createTestDb();
    createTables(raw);
    await loadSqliteVec(raw);
    const repo = createDocRepo(db, new SqliteVecStrategy());

    const files = new Map<string, Buffer>();
    const storage = {
      saveFile: mock(async (namespace: string, path: string, file: File) => {
        files.set(`${namespace}/${path}`, Buffer.from(await file.arrayBuffer()));
        return { namespace, filePath: path, mimeType: file.type, size: file.size };
      }),
      get: mock(async (namespace: string, path: string) => files.get(`${namespace}/${path}`) ?? null),
      delete: mock(async (namespace: string, path: string) => files.delete(`${namespace}/${path}`)),
    };
    const { service } = createService(repo, storage);

    const file = new File(['Alpha text.\n\nBeta text.'], 'notes.txt', { type: 'text/plain' });
    const result = await service.ingestUpload({
      file,
      chunkOptions: { targetTokens: 20, overlapTokens: 0 },
    });

    expect(result.sourceType).toBe('text');
    expect(result.embedded).toBe(result.chunks);

    const source = await repo.getSourceById(result.documentId);
    expect(source!.originalPath).toMatch(/original\.txt$/);

    const chunks = await repo.getChunksByDocumentId(result.documentId);
    expect(chunks[0].page).toBeNull();
  });
});
