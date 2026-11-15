import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService, RoutingPreviewService } from '../src/toolRouter';

const ORDERS = new Array(768).fill(0.1);
const WEATHER = new Array(768).fill(0.2);

function build(hook?: (text: string, options: { signal: AbortSignal }) => Promise<string | null>) {
  const config = {
    toolRouting: { enabled: true, similarityThreshold: 0.45, fallbackOnNoMatch: 'none' },
    rewriteRoutingQueryOnMiss: hook,
  } as any;
  // "how many orders" matches; anything else does not.
  const embedding = { embed: mock(async (text: string) => (text === 'how many orders' ? ORDERS : WEATHER)) } as any;
  const repository = {
    searchSemantics: async (vector: number[]) => (vector === ORDERS ? [{ toolName: 'orders_count', similarity: 0.9 }] : [{ toolName: 'orders_count', similarity: 0.1 }]),
    searchEmbeddings: async () => [],
    scoreEmbeddingsForTools: async () => [],
  } as any;
  const unmatched = { recordMiss: mock(async () => {}) } as any;
  const registry = { tools: [{ name: 'orders_count', description: 'Count orders' }] } as any;
  const provider = { getRoutingConfig: async () => config.toolRouting } as any;
  const log = { error() {}, warn() {} } as any;
  return {
    router: new ToolRouterService(config, registry, embedding, repository, log, provider, unmatched),
    preview: new RoutingPreviewService(config, registry, embedding, repository, log, provider),
    unmatched,
  };
}

describe('DR7: rewrite a message that matched nothing, then route again', () => {
  test('a miss calls the hook once and routes on its output', async () => {
    const hook = mock(async () => 'How many orders');
    const { router, unmatched } = build(hook);

    const result = await router.findRelevantTools('ch7al men commande');
    await router.settled();

    expect(hook).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('routed');
    expect(result.tools.map((tool) => tool.name)).toEqual(['orders_count']);
    expect(result.rewrittenOnMiss).toBe(true);
    expect(unmatched.recordMiss).not.toHaveBeenCalled();
  });

  test('a hit never calls the hook', async () => {
    const hook = mock(async () => 'unused');
    const { router } = build(hook);
    expect((await router.findRelevantTools('how many orders')).status).toBe('routed');
    expect(hook).not.toHaveBeenCalled();
  });

  test('a hook that throws leaves the original no-match result', async () => {
    const { router, unmatched } = build(async () => { throw new Error('model down'); });
    const result = await router.findRelevantTools('ch7al men commande');
    await router.settled();
    expect(result.status).toBe('fallback_none');
    expect(unmatched.recordMiss).toHaveBeenCalledTimes(1);
  });

  test('a hook that does not answer in time leaves the no-match result', async () => {
    let aborted = false;
    const { router } = build((_text, { signal }) => new Promise((resolve) => {
      signal.addEventListener('abort', () => { aborted = true; resolve('how many orders'); });
    }));
    const started = Date.now();
    const result = await router.findRelevantTools('ch7al men commande');
    expect(result.status).toBe('fallback_none');
    expect(aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test('the rewrite of a repeated message is reused', async () => {
    const hook = mock(async () => 'how many orders');
    const { router } = build(hook);
    await router.findRelevantTools('ch7al men commande');
    await router.findRelevantTools('ch7al men commande');
    expect(hook).toHaveBeenCalledTimes(1);
  });

  test('without the hook nothing changes', async () => {
    const { router } = build(undefined);
    expect((await router.findRelevantTools('ch7al men commande')).status).toBe('fallback_none');
  });

  test('the preview shows the second pass the same way', async () => {
    const { preview } = build(async () => 'how many orders');
    const result = await preview.previewRouting('ch7al men commande');
    expect(result.status).toBe('routed');
    expect(result.finalTools).toEqual(['orders_count']);
    expect(result.rewrittenOnMiss).toBe('how many orders');
  });
});
