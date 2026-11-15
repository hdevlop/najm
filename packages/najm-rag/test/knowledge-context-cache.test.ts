import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { KnowledgeContextProvider } from '../src/knowledge/KnowledgeContextProvider';
import { KnowledgeDocumentService } from '../src/knowledge/KnowledgeDocumentService';
import { DocumentIngestionService } from '../src/knowledge/DocumentIngestionService';
import { DocumentSourceRepository } from '../src/knowledge/DocumentSourceRepository';
import { KnowledgeValidator } from '../src/knowledge/KnowledgeValidator';
import { SqliteVecStrategy } from '../src/vectorStore';
import { loadSqliteVec } from '../src/vectorStore/sqliteVecLoader';
import { ragSchema } from '../src/schema/sqlite';
import { rag } from '../src/plugin';

const CHATBOT_CONTEXT_PROVIDER = Symbol.for('najm:chatbot:context-provider');

function citation(text: string) {
  return { chunkId: 'c1', similarity: 0.9, text, page: null, ordinal: 0,
    document: { id: 'd1', namespace: 'rag', sourceType: 'text', originalPath: 'faq.md', metadata: null } };
}

function makeProvider(texts: string[]) {
  let call = 0;
  const knowledge = { search: mock(async () => ({ query: 'q', citations: [citation(texts[Math.min(call++, texts.length - 1)])] })) };
  const settings = { getEffectiveSettings: async () => ({ enableKnowledge: true }) };
  const provider = new KnowledgeContextProvider(knowledge as any, settings as any);
  return { provider, knowledge };
}

describe('R1: knowledge context cache', () => {
  test('a cached answer expires after 60 seconds', async () => {
    const { provider, knowledge } = makeProvider(['old text', 'new text']);
    let now = 1_000_000;
    (provider as any).now = () => now;

    expect(await provider.getContext('q')).toContain('old text');
    now += 59_000;
    expect(await provider.getContext('q')).toContain('old text');
    now += 2_000;
    expect(await provider.getContext('q')).toContain('new text');
    expect(knowledge.search).toHaveBeenCalledTimes(2);
  });

  test('clearCache makes the next message search again', async () => {
    const { provider, knowledge } = makeProvider(['old text', 'new text']);
    await provider.getContext('q');
    provider.clearCache();
    expect(await provider.getContext('q')).toContain('new text');
    expect(knowledge.search).toHaveBeenCalledTimes(2);
  });

  test('ingest, reindex and delete clear the context cache', async () => {
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
    const validator = new KnowledgeValidator();
    (validator as any).schema = ragSchema;
    const repo = new DocumentSourceRepository();
    Object.assign(repo as any, { db, vectors: new SqliteVecStrategy(), validator });

    const contextProvider = { clearCache: mock(() => {}) };
    const container = { has: () => true, get: () => contextProvider };
    const ingestion = new DocumentIngestionService(
      repo,
      { embedBatch: async (texts: string[]) => texts.map(() => new Array(768).fill(0.1)) } as any,
      { knowledge: { enabled: true, namespace: 'rag' }, rag: { embedding: {} } } as any,
      { info() {}, error() {}, warn() {} } as any,
    );
    (ingestion as any).container = container;
    const docs = new KnowledgeDocumentService(repo, ingestion);
    (docs as any).container = container;

    const { documentId } = await ingestion.ingestText({ sourceType: 'text', text: 'Opening hours are 9 to 5.', originalPath: 'text://hours' });
    expect(contextProvider.clearCache).toHaveBeenCalledTimes(1);
    await ingestion.reindexDocument(documentId);
    expect(contextProvider.clearCache).toHaveBeenCalledTimes(2);
    await docs.deleteDocument(documentId);
    expect(contextProvider.clearCache).toHaveBeenCalledTimes(3);
  });
});

describe('R2: knowledge without tool routing', () => {
  test('rag({ knowledge: true }) registers the chatbot context provider', () => {
    const plugin: any = rag({ dialect: 'sqlite', knowledge: true });
    expect(plugin.services).toContain(KnowledgeContextProvider);
    expect(plugin.aliases).toContainEqual([CHATBOT_CONTEXT_PROVIDER, KnowledgeContextProvider]);
  });

  test('without routing settings the provider treats knowledge as enabled', async () => {
    const knowledge = { search: async () => ({ query: 'q', citations: [citation('Opening hours are 9 to 5.')] }) };
    const provider = new KnowledgeContextProvider(knowledge as any);
    (provider as any).container = { has: () => false, get: () => { throw new Error('not registered'); } };

    expect(await provider.getContext('when do you open?')).toContain('Opening hours');
  });
});
