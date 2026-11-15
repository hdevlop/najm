import 'reflect-metadata';
import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ToolIndexRepository } from '../src/toolIndex/ToolIndexRepository';
import { ToolIndexValidator } from '../src/toolIndex/ToolIndexValidator';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { SemanticSeedService } from '../src/chatbotRag/SemanticSeedService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';
import { rag } from '../src/plugin';
import type { RagMergedConfig } from '../src/config';

const seedOf = (config: any) => (rag(config).config as RagMergedConfig).seedSemantics;

const cfg = { dialect: 'sqlite', rag: { embedding: { provider: 'ollama', model: 'm' }, indexOnBoot: true }, toolRouting: { enabled: true } } as any;
const tools = [{ name: 'orders_list' }, { name: 'orders_get' }];

function setup() {
  const raw = new Database(':memory:');
  raw.exec(`CREATE TABLE chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'und', source TEXT, source_file TEXT, fingerprint TEXT, embedding BLOB, created_at TEXT, updated_at TEXT);
    CREATE UNIQUE INDEX semantics_tool_phrase_lang_idx ON chatbot_tool_semantics(tool_name, phrase, lang);`);
  const db = drizzle(raw, { schema: ragSchema });
  const validator = new ToolIndexValidator();
  (validator as any).schema = ragSchema;
  const repo = new ToolIndexRepository();
  Object.assign(repo as any, { db, vectors: new SqliteVecStrategy(), validator, config: cfg });
  const embedBatch = mock(async (texts: string[]) => texts.map(() => new Array(768).fill(0.2)));
  const svc = new SemanticPhraseService(repo, { tools } as any, { embedBatch } as any,
    new ChatbotRagValidator(), { isIndexing: false } as any, cfg);
  const rows = () => raw.query('SELECT tool_name, phrase, lang, source FROM chatbot_tool_semantics ORDER BY phrase').all() as any[];
  return { svc, repo, embedBatch, rows };
}

const seed = {
  items: [
    { toolName: 'orders_list', phrases: [{ phrase: 'show my orders', lang: 'en' }, { phrase: 'وريني الطلبيات', lang: 'darija' }] },
    { toolName: 'orders_get', phrases: [{ phrase: 'order 42', lang: 'en' }] },
  ],
};

describe('seedSemantics', () => {
  test('adds missing phrases with source seed, embedding only those', async () => {
    const { svc, embedBatch, rows } = setup();
    const result = await svc.seedSemantics(seed);
    expect(result).toEqual({ inserted: 3, alreadyStored: 0, failed: 0, unknownTools: [] });
    expect(rows().map((r) => r.source)).toEqual(['seed', 'seed', 'seed']);
    expect(embedBatch).toHaveBeenCalledTimes(1);
    expect(embedBatch.mock.calls[0][0]).toHaveLength(3);
  });

  test('a second run adds and embeds nothing', async () => {
    const { svc, embedBatch } = setup();
    await svc.seedSemantics(seed);
    expect(await svc.seedSemantics(seed)).toEqual({ inserted: 0, alreadyStored: 3, failed: 0, unknownTools: [] });
    expect(embedBatch).toHaveBeenCalledTimes(1);
  });

  test('stored phrases are kept as they are; the same text in another language is new', async () => {
    const { svc, repo, embedBatch, rows } = setup();
    await repo.upsertSemantic({ toolName: 'orders_list', phrase: 'show my orders', lang: 'en', source: 'studio', embedding: new Array(768).fill(0.1) });
    await repo.upsertSemantic({ toolName: 'orders_list', phrase: 'added in the studio', lang: 'en', source: 'studio', embedding: new Array(768).fill(0.1) });
    const result = await svc.seedSemantics({ items: [{ toolName: 'orders_list', phrases: [{ phrase: ' show my orders ', lang: 'en' }, { phrase: 'show my orders', lang: 'fr' }] }] });
    expect(result.inserted).toBe(1);
    expect(result.alreadyStored).toBe(1);
    expect(embedBatch.mock.calls[0][0]).toHaveLength(1);
    const studio = rows().filter((r) => r.source === 'studio').map((r) => `${r.phrase}/${r.lang}`);
    expect(studio).toEqual(['added in the studio/en', 'show my orders/en']);
  });

  test('phrases for tools that are not registered are skipped and reported', async () => {
    const { svc, rows } = setup();
    const result = await svc.seedSemantics({ items: [{ toolName: 'old_tool', phrases: [{ phrase: 'x', lang: 'en' }] }, ...seed.items] });
    expect(result.unknownTools).toEqual(['old_tool']);
    expect(rows().some((r) => r.tool_name === 'old_tool')).toBe(false);
  });
});

describe('SemanticSeedService (boot)', () => {
  const service = (config: any, health = { ok: true }) => {
    const seedSemantics = mock(async () => ({ inserted: 1, alreadyStored: 0, failed: 0, unknownTools: [] }));
    const warn = mock(() => {});
    const svc = new SemanticSeedService(config, { health: async () => health } as any, { seedSemantics } as any,
      { warn, info: () => {}, error: () => {} } as any);
    return { svc, seedSemantics, warn };
  };

  test('seeds once the provider answers', async () => {
    const { svc, seedSemantics } = service({ ...cfg, seedSemantics: seed });
    svc.onReady();
    await svc.running;
    expect(seedSemantics).toHaveBeenCalledWith(seed);
  });

  test('does nothing without a seed or with indexOnBoot false', () => {
    for (const config of [cfg, { ...cfg, seedSemantics: seed, rag: { ...cfg.rag, indexOnBoot: false } }]) {
      const { svc, seedSemantics } = service(config);
      svc.onReady();
      expect(svc.running).toBeNull();
      expect(seedSemantics).not.toHaveBeenCalled();
    }
  });

  test('an unreachable provider skips the seed with one warning', async () => {
    const { svc, seedSemantics, warn } = service({ ...cfg, seedSemantics: seed }, { ok: false } as any);
    svc.onReady();
    await svc.running;
    expect(seedSemantics).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('rag() keeps a seed only when it has items', () => {
    expect(seedOf({ dialect: 'sqlite', toolRouting: { enabled: true }, seedSemantics: { items: [] } })).toBeUndefined();
    expect(seedOf({ dialect: 'sqlite', toolRouting: { enabled: true }, seedSemantics: seed })).toEqual(seed);
  });
});
