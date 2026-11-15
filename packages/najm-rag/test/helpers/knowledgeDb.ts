import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { DocumentSourceRepository } from '../../src/knowledge/DocumentSourceRepository';
import { KnowledgeRepository } from '../../src/knowledge/KnowledgeRepository';
import { KnowledgeValidator } from '../../src/knowledge/KnowledgeValidator';
import { DocumentIngestionService } from '../../src/knowledge/DocumentIngestionService';
import { SqliteVecStrategy } from '../../src/vectorStore';
import { loadSqliteVec } from '../../src/vectorStore/sqliteVecLoader';
import { ragSchema } from '../../src/schema/sqlite';

/** An in-memory knowledge store with real repositories over sqlite-vec. */
export async function createKnowledgeDb() {
  const raw = new Database(':memory:');
  const db = drizzle(raw, { schema: ragSchema });
  raw.exec(`
    CREATE TABLE chatbot_document_sources (id TEXT PRIMARY KEY, namespace TEXT NOT NULL DEFAULT 'rag', source_type TEXT NOT NULL,
      original_path TEXT NOT NULL, ext TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
      error TEXT, ingested_at TEXT, metadata TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE chatbot_document_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ordinal INTEGER NOT NULL, page INTEGER,
      text TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, metadata TEXT, created_at TEXT);
    CREATE TABLE chatbot_document_embeddings (id TEXT PRIMARY KEY, chunk_id TEXT NOT NULL UNIQUE, embedding BLOB,
      model TEXT NOT NULL DEFAULT '', dimensions INTEGER NOT NULL DEFAULT 768, created_at TEXT);
  `);
  await loadSqliteVec(raw);
  const vectors = new SqliteVecStrategy();
  const validator = new KnowledgeValidator();
  (validator as any).schema = ragSchema;
  const sources = new DocumentSourceRepository();
  Object.assign(sources as any, { db, vectors, validator });
  const knowledge = new KnowledgeRepository();
  Object.assign(knowledge as any, { db, vectors, validator });
  return { raw, db, sources, knowledge };
}

/** A StorageService stand-in that keeps files in memory. */
export function memoryStorage() {
  const files = new Map<string, Buffer>();
  const key = (namespace: string, path: string) => `${namespace}/${path}`;
  return {
    files,
    async saveFile(namespace: string, path: string, file: Blob) {
      files.set(key(namespace, path), Buffer.from(await file.arrayBuffer()));
      return { path };
    },
    async get(namespace: string, path: string) { return files.get(key(namespace, path)) ?? null; },
    async delete(namespace: string, path: string) { return files.delete(key(namespace, path)); },
  };
}

export function fakeEmbedder(fail: () => boolean = () => false) {
  return {
    embedBatch: async (texts: string[]) => {
      if (fail()) throw new Error('embedding provider unavailable');
      return texts.map(() => new Array(768).fill(0.1));
    },
  };
}

export function createIngestion(sources: DocumentSourceRepository, embedder: any, storage?: any) {
  const ingestion = new DocumentIngestionService(
    sources,
    embedder,
    { knowledge: { enabled: true, namespace: 'rag' }, rag: { embedding: {} } } as any,
    { info() {}, error() {}, warn() {} } as any,
  );
  if (storage) (ingestion as any).storage = storage;
  return ingestion;
}
