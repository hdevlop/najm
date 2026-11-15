import { describe, test, expect, mock, afterEach } from 'bun:test';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';
import { ToolRouterService } from '../src/toolRouter';
import { KnowledgeService } from '../src/knowledge/KnowledgeService';
import { withEmbeddingDiagnostics, type EmbeddingDiagnostic } from '../src/diagnostics/EmbeddingDiagnostics';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Counts embedding HTTP requests and the inputs each carried. */
function countingFetch(delayMs = 0) {
  const requests: string[][] = [];
  globalThis.fetch = mock(async (_url: any, init: any) => {
    const input: string[] = JSON.parse(init.body).input;
    requests.push(input);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { ok: true, status: 200, json: async () => ({ embeddings: input.map(() => new Array(768).fill(0.1)) }) } as any;
  }) as any;
  return requests;
}

function embedder() {
  return new EmbeddingService({
    rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' } },
  } as any, new EmbeddingValidator());
}

describe('T4: concurrent requests for the same text share one provider call', () => {
  test('two concurrent embed() calls make one request', async () => {
    const requests = countingFetch(20);
    const service = embedder();

    const [a, b] = await Promise.all([service.embed('same text'), service.embed('same text')]);

    expect(requests).toHaveLength(1);
    expect(a).toEqual(b);
  });

  test('the joining call is labelled shared in diagnostics', async () => {
    countingFetch(20);
    const service = embedder();
    const events: EmbeddingDiagnostic[] = [];

    await withEmbeddingDiagnostics({ onEmbedding: (event) => { events.push(event); } }, () =>
      Promise.all([service.embed('same text', 'query', 'tool-routing'), service.embed('same text', 'query', 'knowledge-search')]));

    expect(events.map((event) => [event.operation, event.cache, event.attempts.length]))
      .toEqual([['tool-routing', 'miss', 1], ['knowledge-search', 'shared', 0]]);
  });
});

describe('T2: embedQueries batches its misses', () => {
  test('several texts go in one request and land in the cache', async () => {
    const requests = countingFetch();
    const service = embedder();

    const vectors = await service.embedQueries(['first', 'second'], 'tool-routing');
    expect(vectors).toHaveLength(2);
    expect(requests).toEqual([['first', 'second']]);

    await service.embed('second');
    expect(requests).toHaveLength(1);
  });

  test('cached texts are not sent again', async () => {
    const requests = countingFetch();
    const service = embedder();
    await service.embed('first');

    await service.embedQueries(['first', 'second'], 'tool-routing');
    expect(requests).toEqual([['first'], ['second']]);
  });

  test('with a rewriter and knowledge on, one chat message makes one embedding request', async () => {
    const requests = countingFetch();
    const embedding = embedder();
    const config = {
      toolRouting: { enabled: true, similarityThreshold: 0.45, fallbackOnNoMatch: 'none' },
      knowledge: { enabled: true },
      rewriteRoutingQuery: (text: string) => text.replace('chhal', 'how many'),
    } as any;
    const router = new ToolRouterService(
      config,
      { tools: [{ name: 'orders_count', description: 'Count orders' }] } as any,
      embedding,
      { searchSemantics: async () => [{ toolName: 'orders_count', similarity: 0.9 }], searchEmbeddings: async () => [] } as any,
      { error() {}, warn() {} } as any,
      { getRoutingConfig: async () => config.toolRouting } as any,
    );
    const knowledge = new KnowledgeService(
      { hasEmbeddings: async () => true, searchChunks: async () => [], findChunksWithSource: async () => [] } as any,
      embedding,
      config,
    );

    await router.findRelevantTools('chhal orders');
    await knowledge.search('chhal orders');

    expect(requests).toEqual([['how many orders', 'chhal orders']]);
  });
});
