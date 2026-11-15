import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService } from '../src/toolRouter';
import { canonicalizeRoutingText } from '../src/toolRouter/ToolRouterUtils';
import { EMBEDDINGGEMMA_PRESET } from '../src/toolRouter/RoutingDefaults';
import { SemanticImportJobService } from '../src/chatbotRag/SemanticImportJobService';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { rag } from '../src/plugin';

const tools = [
  { name: 'orders_list', description: 'List orders', annotations: { readOnlyHint: true } },
  { name: 'cart_get', description: 'Get the cart', annotations: { readOnlyHint: true } },
  { name: 'cart_clear', description: 'Clear the cart', annotations: { destructiveHint: true } },
];

/**
 * Each text embeds to a one-hot vector; the repository answers by which text
 * was embedded, so a test states what each text matches.
 */
function makeRouter(matchesByText: Record<string, Array<{ toolName: string; similarity: number }>>, knowledge = false) {
  const texts: string[] = [];
  const vectorOf = (text: string) => {
    if (!texts.includes(text)) texts.push(text);
    return [texts.indexOf(text)];
  };
  const embedding = {
    embed: mock(async (text: string) => vectorOf(text)),
    embedQueries: mock(async (list: string[]) => list.map(vectorOf)),
  };
  const search = async (e: number[]) => matchesByText[texts[e[0]]] ?? [];
  const repository = { searchSemantics: search, searchEmbeddings: async () => [] } as any;
  const unmatched = { recordMiss: mock(async () => {}) };
  const config = {
    toolRouting: { enabled: true, similarityThreshold: 0.5, fallbackOnNoMatch: 'none' },
    knowledge: { enabled: knowledge },
  } as any;
  const router = new ToolRouterService(
    config, { tools } as any, embedding as any, repository,
    { error() {}, warn() {} } as any, { getRoutingConfig: async () => config.toolRouting } as any, unmatched as any,
  );
  return { router, embedding, unmatched };
}

describe('Q3: the latest message is routed first', () => {
  test('the latest message wins over an earlier turn in the joined text', async () => {
    const { router } = makeRouter({
      'and what is in my cart': [{ toolName: 'cart_get', similarity: 0.7 }],
      'show my orders\n---\nand what is in my cart': [{ toolName: 'orders_list', similarity: 0.8 }],
    });
    const result = await router.findRelevantTools('show my orders\n---\nand what is in my cart', { latestUserText: 'and what is in my cart' });
    expect(result.status).toBe('routed');
    expect(result.tools[0].name).toBe('cart_get');
  });

  test('a latest message that matches nothing falls back to the joined turns', async () => {
    const { router, unmatched } = makeRouter({
      'empty my cart\n---\nyes': [{ toolName: 'cart_clear', similarity: 0.7 }],
    });
    const result = await router.findRelevantTools('empty my cart\n---\nyes', { latestUserText: 'yes' });
    await router.settled();
    expect(result.tools.map((t) => t.name)).toEqual(['cart_clear']);
    expect(unmatched.recordMiss).not.toHaveBeenCalled();
  });

  test('when both miss, the latest message is recorded', async () => {
    const { router, unmatched } = makeRouter({});
    await router.findRelevantTools('show my orders\n---\nthanks', { latestUserText: 'Thanks' });
    await router.settled();
    expect((unmatched.recordMiss.mock.calls[0] as any)[0]).toMatchObject({ query: 'Thanks', normalized: 'thanks' });
  });

  test('both texts, and the knowledge text, go in one embedding request', async () => {
    const { router, embedding } = makeRouter({}, true);
    await router.findRelevantTools('show my orders\n---\nthanks', { latestUserText: 'thanks' });
    expect(embedding.embedQueries).toHaveBeenCalledTimes(1);
    expect(embedding.embed).not.toHaveBeenCalled();
    expect(embedding.embedQueries.mock.calls[0][0]).toEqual(['thanks', 'show my orders\n---\nthanks']);
  });

  test('a single message is embedded once, as before', async () => {
    const { router, embedding } = makeRouter({ 'my orders': [{ toolName: 'orders_list', similarity: 0.9 }] });
    await router.findRelevantTools('my orders', { latestUserText: 'my orders' });
    expect(embedding.embed).toHaveBeenCalledTimes(1);
    expect(embedding.embedQueries).not.toHaveBeenCalled();
  });
});

describe('DR1: phrases are embedded the way routing embeds a message', () => {
  const rewrite = (text: string) => text.replace('شنو', 'ما');

  test('canonical text is normalized then rewritten', () => {
    expect(canonicalizeRoutingText('  شنو كاين فالسلة؟ ', rewrite)).toBe('ما كاين فالسله؟');
    expect(canonicalizeRoutingText('Show My Orders')).toBe('show my orders');
  });

  test('creating a phrase embeds the canonical text and stores the phrase as typed', async () => {
    const embedding = { embed: mock(async () => new Array(768).fill(0.1)) };
    const repository = { upsertSemantic: mock(async () => 'inserted'), findSemanticByPhrase: mock(async () => null) } as any;
    const service = new SemanticPhraseService(
      repository, { tools: [{ name: 'cart_get' }] } as any, embedding as any, new ChatbotRagValidator(), {} as any,
      { toolRouting: { enabled: true }, rag: {}, dialect: 'sqlite', rewriteRoutingQuery: rewrite } as any,
    );
    await service.createSemantic({ toolName: 'cart_get', phrase: 'شنو كاين فالسلة', lang: 'darija' } as any).catch(() => {});
    expect((embedding.embed.mock.calls[0] as any)[0]).toBe('ما كاين فالسله');
  });

  test('the import job embeds canonical text too', async () => {
    const embedding = { embedBatch: mock(async (texts: string[]) => texts.map(() => new Array(768).fill(0.1))) };
    const repository = {
      findExistingSemantics: async () => new Map(),
      upsertSemantic: mock(async () => 'inserted'),
      upsertSemanticsBatch: mock(async () => []),
    } as any;
    const job = new SemanticImportJobService(repository, embedding as any, { rewriteRoutingQuery: rewrite } as any);
    job.createImportJob([{ name: 'a.json', content: { cart_get: { darija: ['شنو كاين فالسلة'] } } }]);
    for (let i = 0; i < 50 && embedding.embedBatch.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    expect((embedding.embedBatch.mock.calls[0] as any)[0]).toEqual(['ما كاين فالسله']);
  });
});

describe('DR6: EmbeddingGemma prompts and threshold by default', () => {
  const merged = (config: any) => (rag({ dialect: 'sqlite', toolRouting: { enabled: true }, ...config }) as any).config;

  test('the default model gets the retrieval prompts and threshold 0.35', () => {
    const config = merged({});
    expect(config.rag.embedding.queryPrefix).toBe(EMBEDDINGGEMMA_PRESET.queryPrefix);
    expect(config.rag.embedding.documentPrefix).toBe(EMBEDDINGGEMMA_PRESET.documentPrefix);
    expect(config.toolRouting.similarityThreshold).toBe(0.35);
  });

  test('a tagged or namespaced EmbeddingGemma model gets them too', () => {
    expect(merged({ embedding: { model: 'embeddinggemma:300m' } }).rag.embedding.queryPrefix).toBe(EMBEDDINGGEMMA_PRESET.queryPrefix);
    expect(merged({ embedding: { model: 'google/embeddinggemma-300m' } }).rag.embedding.queryPrefix).toBe(EMBEDDINGGEMMA_PRESET.queryPrefix);
  });

  test('an app threshold wins over the preset one', () => {
    expect(merged({ toolRouting: { enabled: true, similarityThreshold: 0.5 } }).toolRouting.similarityThreshold).toBe(0.5);
  });

  test('an app that sets a prefix, even empty, keeps its prompts and the 0.45 default', () => {
    const config = merged({ embedding: { queryPrefix: '' } });
    expect(config.rag.embedding.queryPrefix).toBe('');
    expect(config.rag.embedding.documentPrefix).toBeUndefined();
    expect(config.toolRouting.similarityThreshold).toBe(0.45);
  });

  test('another model gets no prompts and the 0.45 default', () => {
    const config = merged({ embedding: { model: 'nomic-embed-text' } });
    expect(config.rag.embedding.queryPrefix).toBeUndefined();
    expect(config.toolRouting.similarityThreshold).toBe(0.45);
  });
});
