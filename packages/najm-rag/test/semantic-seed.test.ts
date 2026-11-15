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
    expect((seedSemantics.mock.calls[0] as any[])[0]).toEqual(seed);
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

describe('seedSemantics writes per batch and reports progress', () => {
  const many = {
    items: [
      { toolName: 'orders_list', phrases: ['a', 'b', 'c'].map((phrase) => ({ phrase, lang: 'en' })) },
      { toolName: 'orders_get', phrases: ['d', 'e'].map((phrase) => ({ phrase, lang: 'en' })) },
    ],
  };

  test('each batch is stored before the next is embedded, so an error keeps earlier work', async () => {
    const { svc, embedBatch, rows } = setup();
    let calls = 0;
    embedBatch.mockImplementation(async (texts: string[]) => {
      if (++calls === 2) throw new Error('embedding timed out');
      return texts.map(() => new Array(768).fill(0.2));
    });
    const result = await svc.seedSemantics(many, { batchSize: 2 });
    expect(embedBatch.mock.calls.map((c: any[]) => c[0].length)).toEqual([2, 2, 1]);
    expect(rows().map((r) => r.phrase)).toEqual(['a', 'b', 'e']);
    expect(result).toEqual({ inserted: 3, alreadyStored: 0, failed: 2, unknownTools: [], lastError: 'embedding timed out' });
  });

  test('progress counts up batch by batch', async () => {
    const { svc } = setup();
    const seen: Array<[number, number, number]> = [];
    await svc.seedSemantics(many, { batchSize: 2, onProgress: (p) => seen.push([p.done, p.total, p.inserted]) });
    expect(seen).toEqual([[0, 5, 0], [2, 5, 2], [4, 5, 4], [5, 5, 5]]);
  });

  test('three failed batches in a row stop the seed instead of timing out on every one', async () => {
    const { svc, embedBatch } = setup();
    embedBatch.mockImplementation(async () => { throw new Error('connect ECONNREFUSED'); });
    const seed = { items: [{ toolName: 'orders_list', phrases: Array.from({ length: 10 }, (_, i) => ({ phrase: `p${i}`, lang: 'en' })) }] };
    const result = await svc.seedSemantics(seed, { batchSize: 2 });
    expect(embedBatch).toHaveBeenCalledTimes(3);
    expect(result.failed).toBe(6);
    expect(result.lastError).toBe('stopped after 3 failed batches in a row: connect ECONNREFUSED');
  });
});

describe('SemanticSeedService.status() makes the outcome visible without logs', () => {
  const make = (config: any, health: any, seedSemantics: any) =>
    new SemanticSeedService(config, { health: async () => health } as any, { seedSemantics } as any,
      { warn: () => {}, info: () => {}, error: () => {} } as any);

  test('null without a seed; disabled when boot indexing is off', () => {
    expect(make(cfg, { ok: true }, mock()).status()).toBeNull();
    const off = make({ ...cfg, seedSemantics: seed, rag: { ...cfg.rag, indexOnBoot: false } }, { ok: true }, mock());
    off.onReady();
    expect(off.status()?.state).toBe('disabled');
  });

  test('an unreachable provider is reported as skipped, with the reason', async () => {
    const svc = make({ ...cfg, seedSemantics: seed }, { ok: false, error: 'connect ECONNREFUSED 127.0.0.1:11434' }, mock());
    svc.onReady();
    await svc.running;
    expect(svc.status()).toMatchObject({ state: 'skipped' });
    expect(svc.status()?.lastError).toContain('ECONNREFUSED');
  });

  test('progress while running, then counts, unknown tools and the last error when done', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const seedSemantics = mock(async (_seed: any, options: any) => {
      options.onProgress({ total: 4, done: 2, inserted: 1, alreadyStored: 0, failed: 1, unknownTools: ['old_tool'], lastError: 'bad vector' });
      await gate;
      options.onProgress({ total: 4, done: 4, inserted: 3, alreadyStored: 0, failed: 1, unknownTools: ['old_tool'], lastError: 'bad vector' });
      return { inserted: 3, alreadyStored: 0, failed: 1, unknownTools: ['old_tool'], lastError: 'bad vector' };
    });
    const svc = make({ ...cfg, seedSemantics: seed }, { ok: true }, seedSemantics);
    svc.onReady();
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.status()).toMatchObject({ state: 'running', done: 2, total: 4 });
    release();
    await svc.running;
    expect(svc.status()).toMatchObject({ state: 'done', inserted: 3, failed: 1, unknownTools: ['old_tool'], lastError: 'bad vector' });
  });
});
