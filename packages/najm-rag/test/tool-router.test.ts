import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService } from '../src/toolRouter';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';
import { KnowledgeService } from '../src/knowledge';

describe('ToolRouterService', () => {
  const makeRegistry = (tools: any[]) => ({ tools } as any);
  const makeEmbedding = (embedding: number[]) =>
    ({ embed: mock(() => Promise.resolve(embedding)) } as any);
  const makeRepository = (opts: {
    semantics?: Array<{ toolName: string; similarity: number }>;
    embeddings?: Array<{ toolName: string; similarity: number }>;
    groups?: string[];
    groupTools?: string[];
    groupToolsMap?: Map<string, string[]>;
  }) =>
    ({
      searchSemantics: mock(() => Promise.resolve(opts.semantics ?? [])),
      searchEmbeddings: mock(() => Promise.resolve(opts.embeddings ?? [])),
      getGroupsForTools: mock(() => Promise.resolve(new Set(opts.groups ?? []))),
      getToolsByGroup: mock(() => Promise.resolve(opts.groupTools ?? [])),
      getToolsByGroups: mock(() => Promise.resolve(opts.groupToolsMap ?? new Map())),
    } as any);
  const makeProvider = (config: any) =>
    ({ getRoutingConfig: mock(() => Promise.resolve(config.toolRouting ?? {})) } as any);

  function createToolRouterService(
    config: any,
    registry: any,
    embedding: any,
    repository: any,
    log: any,
  ) {
    return new ToolRouterService(config, registry, embedding, repository, log, makeProvider(config));
  }

  test('returns disabled status when routing disabled', async () => {
    const tools = [{ name: 'a' }, { name: 'b' }];
    const service = createToolRouterService(
      { toolRouting: { enabled: false } } as any,
      makeRegistry(tools),
      makeEmbedding(new Array(768).fill(0)),
      makeRepository({}),
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('disabled');
    expect(result.tools.length).toBe(2);
  });

  test('routes via semantic search', async () => {
    const tools = [
      { name: 'students_get_students', description: 'List students' },
      { name: 'fees_get_by_student', description: 'Get fees' },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [{ toolName: 'students_get_students', similarity: 0.8 }],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('show me students');
    expect(result.status).toBe('routed');
    expect(result.tools.length).toBe(1);
    expect(result.tools[0].name).toBe('students_get_students');
  });

  test('expands dependencies', async () => {
    const tools = [
      { name: 'students_get_students', description: 'List students' },
      { name: 'fees_get_by_student', description: 'Get fees' },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [{ toolName: 'fees_get_by_student', similarity: 0.8 }],
    });

    const service = createToolRouterService(
      {
        toolRouting: {
          enabled: true,
          maxTools: 12,
          topSemanticHits: 8,
          similarityThreshold: 0.45,
          dependencies: { fees_get_by_student: ['students_get_students'] },
        },
      } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('student fees');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('students_get_students');
    expect(names).toContain('fees_get_by_student');
  });

  test('enforces maxTools cap', async () => {
    const tools = Array.from({ length: 20 }, (_, i) => ({
      name: `tool_${i}`,
      description: `Tool ${i}`,
    }));
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      embeddings: tools.slice(0, 10).map((t) => ({ toolName: t.name, similarity: 0.8 })),
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 5, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('query');
    expect(result.tools.length).toBeLessThanOrEqual(5);
  });

  test('primary is the tool with the strongest aggregate score, not just matches[0]', async () => {
    // Realistic Arabic-style scenario: products_get_my_products has a single phrase
    // that scores 0.60 (an outlier), but products_delete has 6 phrases clustered
    // 0.52–0.57. Aggregate should pick products_delete.
    const tools = [
      { name: 'products_delete', description: 'Delete', annotations: { destructive: true } },
      { name: 'products_get_my_products', description: 'Get my products', annotations: { readOnlyHint: true } },
      { name: 'products_update', description: 'Update' },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [
        { toolName: 'products_get_my_products', similarity: 0.60 },
        { toolName: 'products_delete', similarity: 0.57 },
        { toolName: 'products_delete', similarity: 0.54 },
        { toolName: 'products_get_my_products', similarity: 0.54 },
        { toolName: 'products_delete', similarity: 0.54 },
        { toolName: 'products_update', similarity: 0.54 },
        { toolName: 'products_delete', similarity: 0.53 },
        { toolName: 'products_delete', similarity: 0.52 },
        { toolName: 'products_delete', similarity: 0.51 },
        { toolName: 'products_get_my_products', similarity: 0.51 },
      ],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 10, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('من السوق PRD-884 أزل الإعلان');
    const names = result.tools.map((t) => t.name);
    expect(names[0]).toBe('products_delete');
    // products_update (single 0.54 hit) should be dropped as a write alternative
    expect(names).not.toContain('products_update');
  });

  test('drops sibling write tools when primary match is a write', async () => {
    const tools = [
      { name: 'products_delete', description: 'Delete', annotations: { destructive: true } },
      { name: 'products_update', description: 'Update' },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [
        { toolName: 'products_delete', similarity: 0.83 },
        { toolName: 'products_update', similarity: 0.65 },
      ],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('take down my listing');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('products_delete');
    expect(names).not.toContain('products_update');
  });

  test('keeps read-only siblings even when primary is a write', async () => {
    const tools = [
      { name: 'products_delete', description: 'Delete', annotations: { destructive: true } },
      { name: 'products_get_by_id', description: 'Get', annotations: { readOnlyHint: true } },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [
        { toolName: 'products_delete', similarity: 0.83 },
        { toolName: 'products_get_by_id', similarity: 0.6 },
      ],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('remove this product');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('products_delete');
    expect(names).toContain('products_get_by_id');
  });

  test('keeps explicit dependencies even if they are writes', async () => {
    const tools = [
      { name: 'orders_refund', description: 'Refund', annotations: { destructive: true } },
      { name: 'orders_audit_write', description: 'Write audit log' },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [{ toolName: 'orders_refund', similarity: 0.85 }],
    });

    const service = createToolRouterService(
      {
        toolRouting: {
          enabled: true,
          maxTools: 12,
          topSemanticHits: 8,
          similarityThreshold: 0.45,
          dependencies: { orders_refund: ['orders_audit_write'] },
        },
      } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('refund order 12');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('orders_refund');
    expect(names).toContain('orders_audit_write');
  });

  test('keeps multiple read-only siblings when primary is read-only', async () => {
    const tools = [
      { name: 'products_get_by_id', description: 'Get', annotations: { readOnlyHint: true } },
      { name: 'products_get_all', description: 'List', annotations: { readOnlyHint: true } },
    ];
    const embedding = new Array(768).fill(0.1);
    const repo = makeRepository({
      semantics: [
        { toolName: 'products_get_by_id', similarity: 0.88 },
        { toolName: 'products_get_all', similarity: 0.71 },
      ],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('show product');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('products_get_by_id');
    expect(names).toContain('products_get_all');
  });

  test('drops write siblings when primary is read-only (no silent escalation)', async () => {
    const tools = [
      { name: 'products_get_by_id', description: 'Get', annotations: { readOnlyHint: true } },
      { name: 'products_delete', description: 'Delete', annotations: { destructive: true } },
    ];
    const embedding = new Array(768).fill(0.1);
    // products_get_by_id wins on aggregate (3 strong phrases),
    // products_delete is a single noisy outlier with a slightly higher peak.
    const repo = makeRepository({
      semantics: [
        { toolName: 'products_get_by_id', similarity: 0.77 },
        { toolName: 'products_get_by_id', similarity: 0.72 },
        { toolName: 'products_get_by_id', similarity: 0.68 },
        { toolName: 'products_delete', similarity: 0.79 },
      ],
    });

    const service = createToolRouterService(
      { toolRouting: { enabled: true, maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(embedding),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('show product 123');
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('products_get_by_id');
    expect(names).not.toContain('products_delete');
  });

  test('returns router_error status on embed failure with fallback all', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const service = createToolRouterService(
      { toolRouting: { enabled: true, fallbackOnRouterError: 'all' } } as any,
      makeRegistry(tools),
      {
        embed: mock(() => Promise.reject(new Error('ollama down'))),
      } as any,
      makeRepository({}),
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('router_error');
    expect(result.error).toBe('ollama down');
    expect(result.tools.length).toBe(1);
  });

  test('returns router_error status on embed failure with fallback none', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const service = createToolRouterService(
      { toolRouting: { enabled: true, fallbackOnRouterError: 'none' } } as any,
      makeRegistry(tools),
      {
        embed: mock(() => Promise.reject(new Error('ollama down'))),
      } as any,
      makeRepository({}),
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('router_error');
    expect(result.error).toBe('ollama down');
    expect(result.tools.length).toBe(0);
  });

  test('returns fallback_none when no matches and configured', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const service = createToolRouterService(
      { toolRouting: { enabled: true, fallbackOnNoMatch: 'none', maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(new Array(768).fill(0.1)),
      makeRepository({ semantics: [], embeddings: [] }),
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('fallback_none');
    expect(result.tools.length).toBe(0);
  });

  test('returns fallback_all when no matches and configured', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const service = createToolRouterService(
      { toolRouting: { enabled: true, fallbackOnNoMatch: 'all', maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45 } } as any,
      makeRegistry(tools),
      makeEmbedding(new Array(768).fill(0.1)),
      makeRepository({ semantics: [], embeddings: [] }),
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('fallback_all');
    expect(result.tools.length).toBe(1);
  });

  test('falls back to tool embeddings when semantic hits are below threshold', async () => {
    const tools = [
      { name: 'students_get_students', description: 'List students' },
      { name: 'fees_get_by_student', description: 'Get fees' },
    ];
    const repo = makeRepository({
      semantics: [{ toolName: 'fees_get_by_student', similarity: 0.2 }],
      embeddings: [{ toolName: 'students_get_students', similarity: 0.9 }],
    });
    const service = createToolRouterService(
      {
        toolRouting: {
          enabled: true,
          maxTools: 12,
          topSemanticHits: 8,
          similarityThreshold: 0.45,
          fallbackOnNoMatch: 'none',
          fallbackOnRouterError: 'all',
        },
      } as any,
      makeRegistry(tools),
      makeEmbedding(new Array(768).fill(0.1)),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('routed');
    expect(result.tools.map((t) => t.name)).toEqual(['students_get_students']);
  });

  test('records low_confidence miss when both tables probe below threshold', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const repo = makeRepository({
      semantics: [{ toolName: 'a', similarity: 0.1 }],
      embeddings: [{ toolName: 'a', similarity: 0.2 }],
    });
    const service = createToolRouterService(
      {
        toolRouting: {
          enabled: true,
          maxTools: 12,
          topSemanticHits: 8,
          similarityThreshold: 0.45,
          fallbackOnNoMatch: 'none',
          fallbackOnRouterError: 'all',
        },
      } as any,
      makeRegistry(tools),
      makeEmbedding(new Array(768).fill(0.1)),
      repo,
      { error: undefined } as any,
    );

    const result = await service.findRelevantTools('hello');
    expect(result.status).toBe('fallback_none');
    expect(result.tools.length).toBe(0);
  });

  test('uses embedding cache for repeated queries', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const embedService = new EmbeddingService(
        { rag: { queryEmbeddingCacheSize: 10, embedding: { baseUrl: 'http://x', model: 'm' } } } as any,
        new EmbeddingValidator(),
      );
      const repo = makeRepository({
        semantics: [{ toolName: 'a', similarity: 0.8 }],
      });
      const service = createToolRouterService(
        { toolRouting: { enabled: true } } as any,
        makeRegistry(tools),
        embedService,
        repo,
        { error: undefined } as any,
      );

      await service.findRelevantTools('hello');
      await service.findRelevantTools('hello');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('queryEmbeddingCacheSize: 0 disables cache', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const embedService = new EmbeddingService(
        { rag: { queryEmbeddingCacheSize: 0, embedding: { baseUrl: 'http://x', model: 'm' } } } as any,
        new EmbeddingValidator(),
      );
      const repo = makeRepository({
        semantics: [{ toolName: 'a', similarity: 0.8 }],
      });
      const service = createToolRouterService(
        { toolRouting: { enabled: true } } as any,
        makeRegistry(tools),
        embedService,
        repo,
        { error: undefined } as any,
      );

      await service.findRelevantTools('hello');
      await service.findRelevantTools('hello');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('shared embedding cache dedupes router and knowledge for same user text', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const embedService = new EmbeddingService(
        { rag: { queryEmbeddingCacheSize: 10, embedding: { baseUrl: 'http://x', model: 'm' } } } as any,
        new EmbeddingValidator(),
      );
      const router = createToolRouterService(
        { toolRouting: { enabled: true } } as any,
        makeRegistry(tools),
        embedService,
        makeRepository({ semantics: [{ toolName: 'a', similarity: 0.8 }] }),
        { error: undefined } as any,
      );
      const knowledge = new KnowledgeService(
        { searchChunks: mock(() => Promise.resolve([])) } as any,
        embedService,
        { toolRouting: { similarityThreshold: 0.45 } } as any,
      );

      await router.findRelevantTools(' Hello ');
      await knowledge.search(' Hello ');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('shared embedding cache can be disabled for router and knowledge', async () => {
    const tools = [{ name: 'a', description: 'A' }];
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const embedService = new EmbeddingService(
        { rag: { queryEmbeddingCacheSize: 0, embedding: { baseUrl: 'http://x', model: 'm' } } } as any,
        new EmbeddingValidator(),
      );
      const router = createToolRouterService(
        { toolRouting: { enabled: true } } as any,
        makeRegistry(tools),
        embedService,
        makeRepository({ semantics: [{ toolName: 'a', similarity: 0.8 }] }),
        { error: undefined } as any,
      );
      const knowledge = new KnowledgeService(
        { searchChunks: mock(() => Promise.resolve([])) } as any,
        embedService,
        { toolRouting: { similarityThreshold: 0.45 } } as any,
      );

      await router.findRelevantTools(' Hello ');
      await knowledge.search(' Hello ');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
