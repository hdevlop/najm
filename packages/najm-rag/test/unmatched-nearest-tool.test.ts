import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ToolRouterService } from '../src/toolRouter';
import { UnmatchedQueryRepository } from '../src/unmatched/UnmatchedQueryRepository';
import { UnmatchedQueryService } from '../src/unmatched/UnmatchedQueryService';
import { ragSchema } from '../src/schema/sqlite';

function setup(config: Record<string, unknown> = {}) {
  const raw = new Database(':memory:');
  const db = drizzle(raw, { schema: ragSchema });
  const merged = { dialect: 'sqlite', ...config } as any;
  const repository = new UnmatchedQueryRepository();
  Object.assign(repository as any, { db, schema: ragSchema, config: merged });
  const service = new UnmatchedQueryService(repository, merged);
  return { raw, service };
}

const miss = { query: 'Wach kayn chi commande', normalized: 'wach kayn chi commande', score: 0.31, threshold: 0.45, source: 'low_confidence' };

describe('DR5: the unmatched inbox shows the nearest tool and the canonical text', () => {
  test('a miss is recorded with the tool behind its best score', async () => {
    const config = { toolRouting: { enabled: true, similarityThreshold: 0.45, fallbackOnNoMatch: 'none' } } as any;
    const unmatched = { recordMiss: mock(async () => {}) } as any;
    const router = new ToolRouterService(
      config,
      { tools: [{ name: 'orders_list', description: 'List orders' }, { name: 'users_list', description: 'List users' }] } as any,
      { embed: async () => new Array(768).fill(0.1) } as any,
      {
        searchSemantics: async () => [{ toolName: 'orders_list', similarity: 0.31 }, { toolName: 'users_list', similarity: 0.2 }],
        searchEmbeddings: async () => [],
      } as any,
      { error() {}, warn() {} } as any,
      { getRoutingConfig: async () => config.toolRouting } as any,
      unmatched,
    );

    await router.findRelevantTools('wach kayn chi commande');
    await router.settled();

    expect(unmatched.recordMiss.mock.calls[0][0]).toMatchObject({ score: 0.31, nearestTool: 'orders_list' });
  });

  test('nothing indexed records no nearest tool', async () => {
    const config = { toolRouting: { enabled: true, similarityThreshold: 0.45, fallbackOnNoMatch: 'none' } } as any;
    const unmatched = { recordMiss: mock(async () => {}) } as any;
    const router = new ToolRouterService(
      config,
      { tools: [{ name: 'orders_list', description: 'List orders' }] } as any,
      { embed: async () => new Array(768).fill(0.1) } as any,
      { searchSemantics: async () => [], searchEmbeddings: async () => [] } as any,
      { error() {}, warn() {} } as any,
      { getRoutingConfig: async () => config.toolRouting } as any,
      unmatched,
    );

    await router.findRelevantTools('hello');
    await router.settled();

    expect(unmatched.recordMiss.mock.calls[0][0]).toMatchObject({ source: 'no_match', nearestTool: null });
  });

  test('the nearest tool is stored, returned, and replaced by a later miss', async () => {
    const { service } = setup();
    await service.recordMiss({ ...miss, nearestTool: 'orders_list' });
    expect((await service.list())[0]).toMatchObject({ nearestTool: 'orders_list', occurrenceCount: 1 });

    await service.recordMiss({ ...miss, nearestTool: 'orders_create' });
    expect((await service.list())[0]).toMatchObject({ nearestTool: 'orders_create', occurrenceCount: 2 });
  });

  test('an inbox table made by an earlier release gains the column and keeps its rows', async () => {
    const { raw, service } = setup();
    raw.run(`CREATE TABLE chatbot_unmatched_queries (
      id TEXT PRIMARY KEY, query TEXT NOT NULL, normalized TEXT NOT NULL UNIQUE,
      score TEXT NOT NULL, threshold TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'router',
      occurrence_count INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT)`);
    raw.run(`INSERT INTO chatbot_unmatched_queries (id, query, normalized, score, threshold)
      VALUES ('old', 'old', 'old', '0.1', '0.45')`);

    const [old] = await service.list();
    expect(old).toMatchObject({ id: 'old', nearestTool: null });

    await service.recordMiss({ ...miss, nearestTool: 'orders_list' });
    expect((await service.list()).map((row) => row.nearestTool).sort()).toEqual([null, 'orders_list']);
  });

  test('concurrent first calls add the column once', async () => {
    const { raw, service } = setup();
    raw.run(`CREATE TABLE chatbot_unmatched_queries (
      id TEXT PRIMARY KEY, query TEXT NOT NULL, normalized TEXT NOT NULL UNIQUE,
      score TEXT NOT NULL, threshold TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'router',
      occurrence_count INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT)`);

    await Promise.all([service.list(), service.count(), service.list()]);
    const columns = raw.query('PRAGMA table_info(chatbot_unmatched_queries)').all() as Array<{ name: string }>;
    expect(columns.filter((column) => column.name === 'nearest_tool')).toHaveLength(1);
  });

  test('canonical is what the current rewriter makes of the message', async () => {
    const { service } = setup({ rewriteRoutingQuery: (text: string) => text.replace('wach kayn', 'هل يوجد') });
    await service.recordMiss(miss);
    const [row] = await service.list();
    expect(row.normalized).toBe('wach kayn chi commande');
    expect(row.canonical).toBe('هل يوجد chi commande');
  });

  test('canonical is null without a rewriter or when the rewriter throws', async () => {
    const plain = setup();
    await plain.service.recordMiss(miss);
    expect((await plain.service.list())[0].canonical).toBeNull();

    const failing = setup({ rewriteRoutingQuery: () => { throw new Error('bad rule'); } });
    await failing.service.recordMiss(miss);
    expect((await failing.service.list())[0].canonical).toBeNull();
  });
});
