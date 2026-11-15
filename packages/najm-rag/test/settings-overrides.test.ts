import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService, RoutingPreviewService } from '../src/toolRouter';
import { RoutingSettingsService } from '../src/routingSettings/RoutingSettingsService';
import { KnowledgeContextProvider } from '../src/knowledge/KnowledgeContextProvider';
import { createKnowledgeDb, fakeEmbedder, createIngestion } from './helpers/knowledgeDb';

const TOOLS = [{ name: 'orders_list', description: 'List orders' }, { name: 'products_list', description: 'List products' }];

function services(toolsOverride: 'auto' | 'none' | 'all') {
  const config = { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45, fallbackOnNoMatch: 'none', fallbackOnRouterError: 'all', dependencies: {} } } as any;
  const settings = new RoutingSettingsService(config, { get: async () => ({ toolsOverride }) } as any);
  const provider = { getRoutingConfig: () => settings.getRoutingConfig() } as any;
  const embedding = { embed: mock(async () => new Array(768).fill(0.1)) } as any;
  const repository = {
    searchSemantics: async () => [{ toolName: 'orders_list', similarity: 0.9 }],
    searchEmbeddings: async () => [],
    scoreEmbeddingsForTools: async () => [],
  } as any;
  const log = { error() {}, warn() {} } as any;
  return {
    embedding,
    router: new ToolRouterService(config, { tools: TOOLS } as any, embedding, repository, log, provider),
    preview: new RoutingPreviewService(config, { tools: TOOLS } as any, embedding, repository, log, provider),
  };
}

describe('H5: studio overrides take effect', () => {
  test("toolsOverride 'none' gives the model no tools, without embedding", async () => {
    const { router, preview, embedding } = services('none');
    const routed = await router.findRelevantTools('my orders');
    expect(routed).toMatchObject({ status: 'fallback_none', tools: [] });
    expect((await preview.previewRouting('my orders')).finalTools).toEqual([]);
    expect(embedding.embed).not.toHaveBeenCalled();
  });

  test("toolsOverride 'all' gives the model every routable tool", async () => {
    const { router, preview } = services('all');
    const routed = await router.findRelevantTools('my orders');
    expect(routed.status).toBe('fallback_all');
    expect(routed.tools.map((tool) => tool.name)).toEqual(['orders_list', 'products_list']);
    expect((await preview.previewRouting('my orders')).finalTools).toEqual(['orders_list', 'products_list']);
  });

  test("toolsOverride 'auto' routes as usual", async () => {
    const { router } = services('auto');
    expect((await router.findRelevantTools('my orders')).tools.map((tool) => tool.name)).toEqual(['orders_list']);
  });

  test("contextOverride 'none' turns knowledge context off", async () => {
    const knowledge = { search: mock(async () => ({ query: 'q', citations: [] })) };
    const provider = new KnowledgeContextProvider(knowledge as any,
      { getEffectiveSettings: async () => ({ enableKnowledge: true, contextOverride: 'none' }) } as any);
    expect(await provider.getContext('q')).toBeNull();
    expect(knowledge.search).not.toHaveBeenCalled();
  });

  test('a disabled chunk is not returned by knowledge search', async () => {
    const { raw, sources, knowledge } = await createKnowledgeDb();
    await createIngestion(sources, fakeEmbedder()).ingestText({
      sourceType: 'text', text: 'First paragraph about opening hours.\n\nSecond paragraph about holidays.',
      originalPath: 'text://hours', chunkOptions: { targetTokens: 8, overlapTokens: 0 },
    });
    const chunkIds = (raw.query('SELECT id FROM chatbot_document_chunks ORDER BY ordinal').all() as Array<{ id: string }>).map((row) => row.id);
    expect(chunkIds.length).toBeGreaterThan(1);
    raw.run('UPDATE chatbot_document_chunks SET enabled = 0 WHERE id = ?', [chunkIds[0]]);

    const rows = await knowledge.findChunksWithSource(chunkIds);
    expect(rows.map((row) => row.chunkId).sort()).toEqual(chunkIds.slice(1).sort());
  });
});
