import { describe, test, expect } from 'bun:test';
import { ToolRouterService, RoutingPreviewService } from '../src/toolRouter';

const TOOLS = [
  { name: 'orders_list', description: 'List orders', annotations: { readOnlyHint: true } },
  { name: 'customers_get', description: 'Get a customer', annotations: { readOnlyHint: true } },
  { name: 'addresses_get', description: 'Get an address', annotations: { readOnlyHint: true } },
  { name: 'orders_delete', description: 'Delete an order' },
  { name: 'orders_cancel', description: 'Cancel an order' },
  { name: 'products_list', description: 'List products', annotations: { readOnlyHint: true } },
];

function build(routing: any, semantics: any[], embeddings: any[] = []) {
  const config = { toolRouting: { enabled: true, ...routing } } as any;
  const registry = { tools: TOOLS } as any;
  const embedding = { embed: async () => new Array(768).fill(0.1) } as any;
  const repository = {
    searchSemantics: async (_e: any, limit: number, threshold: number) =>
      semantics.filter((m) => m.similarity >= threshold).slice(0, limit),
    searchEmbeddings: async (_e: any, limit: number, threshold: number) =>
      embeddings.filter((m) => m.similarity >= threshold).slice(0, limit),
    scoreEmbeddingsForTools: async () => [],
  } as any;
  const provider = { getRoutingConfig: async () => config.toolRouting } as any;
  const log = { error() {}, warn() {} } as any;
  const router = new ToolRouterService(config, registry, embedding, repository, log, provider);
  const preview = new RoutingPreviewService(config, registry, embedding, repository, log, provider);
  return { router, preview };
}

async function bothAgree(routing: any, semantics: any[], embeddings: any[] = []) {
  const { router, preview } = build(routing, semantics, embeddings);
  const routed = await router.findRelevantTools('query');
  const previewed = await preview.previewRouting('query');
  expect(previewed.status).toBe(routed.status);
  expect(previewed.finalTools).toEqual(routed.tools.map((tool) => tool.name));
  return { routed, previewed };
}

describe('Q0: the studio preview and chat routing make the same decision', () => {
  test('dependencies of dependencies are followed by both', async () => {
    const { previewed } = await bothAgree(
      { similarityThreshold: 0.45, dependencies: { orders_list: ['customers_get'], customers_get: ['addresses_get'] } },
      [{ toolName: 'orders_list', similarity: 0.9 }],
    );
    expect(previewed.finalTools).toEqual(['orders_list', 'customers_get', 'addresses_get']);
    expect(previewed.dependencies).toEqual([
      { toolName: 'customers_get', reason: 'dependency_of:orders_list' },
      { toolName: 'addresses_get', reason: 'dependency_of:customers_get' },
    ]);
  });

  test('alternative write tools are dropped by both', async () => {
    await bothAgree({ similarityThreshold: 0.45 }, [
      { toolName: 'orders_delete', similarity: 0.9 },
      { toolName: 'orders_delete', similarity: 0.88 },
      { toolName: 'orders_cancel', similarity: 0.7 },
      { toolName: 'orders_list', similarity: 0.6 },
    ]);
  });

  test('description embeddings are used by both when no phrase clears the threshold', async () => {
    const { previewed } = await bothAgree(
      { similarityThreshold: 0.45 },
      [{ toolName: 'orders_list', similarity: 0.3 }],
      [{ toolName: 'products_list', similarity: 0.6 }],
    );
    expect(previewed.matches[0]).toMatchObject({ toolName: 'products_list', source: 'embeddings' });
  });

  test('maxTools caps both lists', async () => {
    await bothAgree({ similarityThreshold: 0.45, maxTools: 2 }, [
      { toolName: 'orders_list', similarity: 0.9 },
      { toolName: 'products_list', similarity: 0.8 },
      { toolName: 'customers_get', similarity: 0.7 },
    ]);
  });

  test('no match falls back the same way in both', async () => {
    const { routed } = await bothAgree({ similarityThreshold: 0.45, fallbackOnNoMatch: 'none' }, [{ toolName: 'orders_list', similarity: 0.1 }]);
    expect(routed.status).toBe('fallback_none');
  });
});
