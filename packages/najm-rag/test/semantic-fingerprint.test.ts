import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ToolIndexRepository } from '../src/toolIndex/ToolIndexRepository';
import { ToolIndexValidator } from '../src/toolIndex/ToolIndexValidator';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';

function config(model: string, routingTextVersion?: string) {
  return { dialect: 'sqlite', routingTextVersion, rag: { embedding: { provider: 'ollama', model } }, toolRouting: { enabled: true } } as any;
}

/** A semantics table as created by releases before the fingerprint column. */
function createDb() {
  const raw = new Database(':memory:');
  raw.exec(`CREATE TABLE chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'und', source TEXT, source_file TEXT, embedding BLOB, created_at TEXT, updated_at TEXT);
    CREATE UNIQUE INDEX semantics_tool_phrase_lang_idx ON chatbot_tool_semantics(tool_name, phrase, lang);`);
  return { raw, db: drizzle(raw, { schema: ragSchema }) };
}

function repository(db: any, cfg: any) {
  const validator = new ToolIndexValidator();
  (validator as any).schema = ragSchema;
  const repo = new ToolIndexRepository();
  Object.assign(repo as any, { db, vectors: new SqliteVecStrategy(), validator, config: cfg });
  return repo;
}

function service(repo: ToolIndexRepository, cfg: any) {
  const embedBatch = mock(async (texts: string[]) => texts.map(() => new Array(768).fill(0.2)));
  const svc = new SemanticPhraseService(repo, { tools: [] } as any, { embedBatch } as any,
    new ChatbotRagValidator(), { isIndexing: false } as any, cfg);
  return { svc, embedBatch };
}

describe('DR1: phrase vectors know which embedder made them', () => {
  test('an existing table gains the fingerprint column, and writes record it', async () => {
    const { raw, db } = createDb();
    const repo = repository(db, config('model-a'));
    await repo.upsertSemantic({ toolName: 'orders_list', phrase: 'show orders', lang: 'en', embedding: new Array(768).fill(0.1) });

    const [row] = raw.query('SELECT fingerprint FROM chatbot_tool_semantics').all() as Array<{ fingerprint: string | null }>;
    expect(row.fingerprint).toBeString();
    expect(await repo.countStaleSemantics()).toBe(0);
  });

  test('changing the embedding model marks every phrase stale, and reindex re-embeds them once', async () => {
    const { db } = createDb();
    await repository(db, config('model-a')).upsertSemantic({ toolName: 'orders_list', phrase: 'show orders', lang: 'en', embedding: new Array(768).fill(0.1) });
    await repository(db, config('model-a')).upsertSemantic({ toolName: 'orders_list', phrase: 'my orders', lang: 'en', embedding: new Array(768).fill(0.1) });

    const cfg = config('model-b');
    const repo = repository(db, cfg);
    expect(await repo.countStaleSemantics()).toBe(2);

    const { svc, embedBatch } = service(repo, cfg);
    expect((await svc.reindexSemantics()).reindexed).toBe(2);
    expect(await repo.countStaleSemantics()).toBe(0);
    expect((await svc.reindexSemantics()).reindexed).toBe(0);
    expect(embedBatch).toHaveBeenCalledTimes(2);
  });

  test('bumping routingTextVersion marks phrases stale', async () => {
    const { db } = createDb();
    await repository(db, config('model-a', 'v1')).upsertSemantic({ toolName: 'orders_list', phrase: 'show orders', lang: 'en', embedding: new Array(768).fill(0.1) });
    expect(await repository(db, config('model-a', 'v1')).countStaleSemantics()).toBe(0);
    expect(await repository(db, config('model-a', 'v2')).countStaleSemantics()).toBe(1);
  });

  test('phrases saved before this release (no fingerprint) count as stale', async () => {
    const { raw, db } = createDb();
    raw.run(`INSERT INTO chatbot_tool_semantics (id, tool_name, phrase, lang, embedding) VALUES ('s1', 'orders_list', 'show orders', 'en', x'00')`);
    expect(await repository(db, config('model-a')).countStaleSemantics()).toBe(1);
  });

  test('force re-embeds every phrase', async () => {
    const { db } = createDb();
    const cfg = config('model-a');
    const repo = repository(db, cfg);
    await repo.upsertSemantic({ toolName: 'orders_list', phrase: 'show orders', lang: 'en', embedding: new Array(768).fill(0.1) });

    const { svc } = service(repo, cfg);
    expect((await svc.reindexSemantics()).reindexed).toBe(0);
    expect((await svc.reindexSemantics({ force: true })).reindexed).toBe(1);
  });
});
