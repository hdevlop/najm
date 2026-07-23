import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Body, Headers, Params, User } from 'najm-core';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { ChatbotRagController } from '../src/chatbotRag/ChatbotRagController';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { ToolMetadataService } from '../src/chatbotRag/ToolMetadataService';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc123',
    toolName: 'products_get_all',
    phrase: 'list all products',
    lang: 'en',
    source: 'admin',
    sourceFile: null,
    embedding: Buffer.from([1, 2, 3]),
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const repository = {
    listSemantics: mock(() => Promise.resolve([makeRow()])),
    findSemanticById: mock(() => Promise.resolve(makeRow())),
    upsertSemantic: mock(() => Promise.resolve('inserted' as const)),
    updateSemanticById: mock(() => Promise.resolve()),
    deleteSemanticById: mock(() => Promise.resolve()),
    deleteSemanticsByIds: mock(() => Promise.resolve(1)),
    deleteAllSemantics: mock(() => Promise.resolve(1)),
    listSemanticsWithoutEmbeddings: mock(() => Promise.resolve([])),
    updateSemanticEmbeddingById: mock(() => Promise.resolve()),
    pruneDuplicateSemantics: mock(() => Promise.resolve()),
    listEmbeddings: mock(() => Promise.resolve([])),
    countEmbeddings: mock(() => Promise.resolve(0)),
    countSemantics: mock(() => Promise.resolve(1)),
  } as any;

  const embedding = {
    embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
    embedBatch: mock(() => Promise.resolve([new Array(768).fill(0.1)])),
  } as any;

  const indexer = {
    isIndexing: false,
    indexTools: mock(() => Promise.resolve({ indexed: 0, skipped: 0 })),
  } as any;

  const registry = {
    tools: [],
  } as any;

  const config = {
    toolRouting: { enabled: true },
    rag: { embedding: { model: 'test' } },
    dialect: 'pg',
  } as any;

  const validator = new ChatbotRagValidator();

  const service = new SemanticPhraseService(
    { ...repository, ...(overrides.repository as any) },
    { ...registry, ...(overrides.registry as any) },
    { ...embedding, ...(overrides.embedding as any) },
    validator,
    { ...indexer, ...(overrides.indexer as any) },
    { ...config, ...(overrides.config as any) },
  );

  return { service, repository, embedding };
}

function makeToolMetadataService(overrides: Partial<Record<string, unknown>> = {}) {
  const repository = {
    listEmbeddings: mock(() => Promise.resolve([])),
  } as any;
  const registry = {
    tools: [],
  } as any;
  const config = {
    toolRouting: { enabled: true, dependencies: {} },
  } as any;
  const service = new ToolMetadataService(
    { ...repository, ...(overrides.repository as any) },
    { ...registry, ...(overrides.registry as any) },
    { ...config, ...(overrides.config as any) },
  );
  return { service, repository, registry, config };
}

// ---------------------------------------------------------------------------
// getToolList — owned by ToolMetadataService
// ---------------------------------------------------------------------------

function makeToolMetadataService(overrides: Partial<Record<string, unknown>> = {}) {
  const repository = {
    listEmbeddings: mock(() => Promise.resolve([])),
  } as any;
  const registry = {
    tools: [],
  } as any;
  const config = {
    toolRouting: { enabled: true, dependencies: {} },
  } as any;
  const service = new ToolMetadataService(
    { ...repository, ...(overrides.repository as any) },
    { ...registry, ...(overrides.registry as any) },
    { ...config, ...(overrides.config as any) },
  );
  return { service, repository, registry, config };
}

describe('ToolMetadataService.getToolList', () => {
  test('does not expose request context parameters as model inputs', async () => {
    class TestController {
      myProducts(@User('id') userId: string) {
        return userId;
      }

      logout(@User('id') userId: string, @Headers('authorization') authorization?: string) {
        return { userId, authorization };
      }

      update(@Params('id') id: string, @Body() body: unknown, @User('id') userId: string) {
        return { id, body, userId };
      }
    }

    const { service } = makeToolMetadataService({
      repository: { listEmbeddings: mock(() => Promise.resolve([])) },
      registry: {
        tools: [
          {
            name: 'test_my_products',
            description: 'List current user products',
            group: 'test',
            target: TestController,
            methodKey: 'myProducts',
          },
          {
            name: 'test_logout',
            description: 'Logout current user',
            group: 'test',
            target: TestController,
            methodKey: 'logout',
          },
          {
            name: 'test_update',
            description: 'Update item',
            group: 'test',
            target: TestController,
            methodKey: 'update',
          },
        ],
      },
    });

    const tools = await service.getToolList();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get('test_my_products')?.parameters).toEqual([]);
    expect(byName.get('test_logout')?.parameters).toEqual([]);
    expect(byName.get('test_update')?.parameters).toEqual([
      { name: 'id', type: 'unknown', required: true },
      { name: 'body', type: 'unknown', required: true },
    ]);
  });
});

// ---------------------------------------------------------------------------
// listSemantics
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.listSemantics', () => {
  test('returns phrase list without raw embedding buffer', async () => {
    const { service } = makeService();
    const result = await service.listSemantics();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('abc123');
    expect(result[0].hasEmbedding).toBe(true);
    expect((result[0] as any).embedding).toBeUndefined();
  });

  test('hasEmbedding is false when embedding is null', async () => {
    const { service } = makeService({
      repository: {
        listSemantics: mock(() => Promise.resolve([makeRow({ embedding: null })])),
      },
    });
    const result = await service.listSemantics();
    expect(result[0].hasEmbedding).toBe(false);
  });

  test('forwards toolName filter to repository', async () => {
    const listSemantics = mock(() => Promise.resolve([]));
    const { service } = makeService({ repository: { listSemantics } });
    await service.listSemantics('products_get_all');
    expect(listSemantics).toHaveBeenCalledWith('products_get_all');
  });
});

// ---------------------------------------------------------------------------
// getSemanticById
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.getSemanticById', () => {
  test('returns phrase when found', async () => {
    const { service } = makeService();
    const result = await service.getSemanticById('abc123');
    expect(result.id).toBe('abc123');
    expect(result.phrase).toBe('list all products');
  });

  test('throws 404 when not found', async () => {
    const { service } = makeService({
      repository: { findSemanticById: mock(() => Promise.resolve(null)) },
    });
    await expect(service.getSemanticById('missing')).rejects.toHaveProperty('status', 404);
  });
});

// ---------------------------------------------------------------------------
// createSemantic
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.createSemantic', () => {
  test('embeds phrase on create and calls upsertSemantic', async () => {
    const upsertSemantic = mock(() => Promise.resolve('inserted' as const));
    const listSemantics = mock(() =>
      Promise.resolve([makeRow({ source: 'admin' })]),
    );
    const embed = mock(() => Promise.resolve(new Array(768).fill(0.5)));

    const { service } = makeService({
      repository: { upsertSemantic, listSemantics },
      embedding: { embed },
    });

    const result = await service.createSemantic({
      toolName: 'products_get_all',
      phrase: 'list all products',
      lang: 'en',
    });

    expect(embed).toHaveBeenCalledWith('list all products');
    expect(upsertSemantic).toHaveBeenCalledTimes(1);
    const call = upsertSemantic.mock.calls[0][0];
    expect(call.toolName).toBe('products_get_all');
    expect(call.source).toBe('admin');
    expect(call.embedding).toHaveLength(768);
    expect(result.id).toBe('abc123');
  });

  test('saves without embedding if embed fails', async () => {
    const upsertSemantic = mock(() => Promise.resolve('inserted' as const));
    const listSemantics = mock(() =>
      Promise.resolve([makeRow({ phrase: 'test phrase', lang: 'en', embedding: null })]),
    );
    const embed = mock(() => Promise.reject(new Error('ollama down')));

    const { service } = makeService({
      repository: { upsertSemantic, listSemantics },
      embedding: { embed },
    });

    const result = await service.createSemantic({
      toolName: 'products_get_all',
      phrase: 'test phrase',
      lang: 'en',
    });

    expect(upsertSemantic).toHaveBeenCalledTimes(1);
    const call = upsertSemantic.mock.calls[0][0];
    expect(call.embedding).toBeUndefined();
    expect(result.hasEmbedding).toBe(false);
  });

  test('normalizes missing lang to "und"', async () => {
    const upsertSemantic = mock(() => Promise.resolve('inserted' as const));
    const listSemantics = mock(() =>
      Promise.resolve([makeRow({ phrase: 'products', lang: 'und' })]),
    );

    const { service } = makeService({
      repository: { upsertSemantic, listSemantics },
    });

    await service.createSemantic({
      toolName: 'products_get_all',
      phrase: 'products',
      lang: 'und',
    });

    expect(upsertSemantic.mock.calls[0][0].lang).toBe('und');
  });
});

// ---------------------------------------------------------------------------
// updateSemantic
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.updateSemantic', () => {
  test('re-embeds when phrase changes', async () => {
    let callCount = 0;
    const findSemanticById = mock(() => {
      callCount++;
      return Promise.resolve(makeRow({ phrase: callCount === 1 ? 'list all products' : 'updated phrase' }));
    });
    const updateSemanticById = mock(() => Promise.resolve());
    const embed = mock(() => Promise.resolve(new Array(768).fill(0.9)));

    const { service } = makeService({
      repository: { findSemanticById, updateSemanticById },
      embedding: { embed },
    });

    const result = await service.updateSemantic('abc123', { phrase: 'updated phrase' });

    expect(embed).toHaveBeenCalledWith('updated phrase');
    expect(updateSemanticById).toHaveBeenCalledTimes(1);
    const patch = updateSemanticById.mock.calls[0][1];
    expect(patch.phrase).toBe('updated phrase');
    expect(patch.embedding).toHaveLength(768);
    expect(result.phrase).toBe('updated phrase');
  });

  test('does not re-embed when only lang changes', async () => {
    const findSemanticById = mock(() => Promise.resolve(makeRow({ lang: 'fr' })));
    const updateSemanticById = mock(() => Promise.resolve());
    const embed = mock(() => Promise.resolve([]));

    const { service } = makeService({
      repository: { findSemanticById, updateSemanticById },
      embedding: { embed },
    });

    await service.updateSemantic('abc123', { lang: 'fr' });

    expect(embed).not.toHaveBeenCalled();
    const patch = updateSemanticById.mock.calls[0][1];
    expect(patch.lang).toBe('fr');
    expect(patch.embedding).toBeUndefined();
  });

  test('throws 404 when not found', async () => {
    const { service } = makeService({
      repository: { findSemanticById: mock(() => Promise.resolve(null)) },
    });
    await expect(service.updateSemantic('missing', { phrase: 'x' })).rejects.toHaveProperty('status', 404);
  });
});

// ---------------------------------------------------------------------------
// deleteSemantic
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.deleteSemantic', () => {
  test('deletes and returns { deleted: true }', async () => {
    const deleteSemanticById = mock(() => Promise.resolve());
    const { service } = makeService({ repository: { deleteSemanticById } });
    const result = await service.deleteSemantic('abc123');
    expect(result).toEqual({ deleted: true });
    expect(deleteSemanticById).toHaveBeenCalledWith('abc123');
  });

  test('throws 404 when row does not exist', async () => {
    const { service } = makeService({
      repository: {
        findSemanticById: mock(() => Promise.resolve(null)),
        deleteSemanticById: mock(() => Promise.resolve()),
      },
    });
    await expect(service.deleteSemantic('ghost')).rejects.toHaveProperty('status', 404);
  });
});

// ---------------------------------------------------------------------------
// exportSemantics
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.exportSemantics', () => {
  test('groups phrases by toolName in import-compatible format', async () => {
    const rows = [
      makeRow({ toolName: 'tool_a', phrase: 'phrase 1', lang: 'en' }),
      makeRow({ id: 'xyz', toolName: 'tool_a', phrase: 'phrase 2', lang: 'ar' }),
      makeRow({ id: 'pqr', toolName: 'tool_b', phrase: 'do thing', lang: 'en' }),
    ];
    const { service } = makeService({
      repository: { listSemantics: mock(() => Promise.resolve(rows)) },
    });

    const result = await service.exportSemantics();
    expect(result).toEqual({
      tool_a: {
        ar: ['phrase 2'],
        en: ['phrase 1'],
      },
      tool_b: {
        en: ['do thing'],
      },
    });
  });

  test('returns empty items array when no phrases exist', async () => {
    const { service } = makeService({
      repository: { listSemantics: mock(() => Promise.resolve([])) },
    });
    const result = await service.exportSemantics();
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// reindexSemantics
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.reindexSemantics', () => {
  test('embeds only phrases without embeddings', async () => {
    const unindexed = [makeRow({ embedding: null }), makeRow({ id: 'def', embedding: null })];
    const embedBatch = mock(() => Promise.resolve([new Array(768).fill(0.1)]));
    const updateSemanticEmbeddingById = mock(() => Promise.resolve());
    const listSemanticsWithoutEmbeddings = mock(() => Promise.resolve(unindexed));

    const { service } = makeService({
      repository: { listSemanticsWithoutEmbeddings, updateSemanticEmbeddingById },
      embedding: { embedBatch },
    });

    const result = await service.reindexSemantics();
    expect(embedBatch).toHaveBeenCalledTimes(2);
    expect(updateSemanticEmbeddingById).toHaveBeenCalledTimes(2);
    expect(result.reindexed).toBe(2);
    expect(result.failed).toBe(0);
  });

  test('counts failures without throwing', async () => {
    const unindexed = [makeRow({ embedding: null })];
    const embedBatch = mock(() => Promise.reject(new Error('model down')));
    const updateSemanticEmbeddingById = mock(() => Promise.resolve());

    const { service } = makeService({
      repository: {
        listSemanticsWithoutEmbeddings: mock(() => Promise.resolve(unindexed)),
        updateSemanticEmbeddingById,
      },
      embedding: { embedBatch },
    });

    const result = await service.reindexSemantics();
    expect(result.failed).toBe(1);
    expect(result.reindexed).toBe(0);
    expect(updateSemanticEmbeddingById).not.toHaveBeenCalled();
  });

  test('returns zeros when nothing to reindex', async () => {
    const { service } = makeService();
    const result = await service.reindexSemantics();
    expect(result).toEqual({ reindexed: 0, skipped: 0, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// previewRouting
// ---------------------------------------------------------------------------

describe('SemanticPhraseService.previewRouting', () => {
  test('delegates to ToolRouterService when available', async () => {
    const { service } = makeService();
    const preview = {
      query: 'list products',
      normalized: 'list products',
      status: 'routed',
      matches: [{ toolName: 'products_get_all', similarity: 0.9, source: 'semantics' }],
      dependencies: [],
      gateDecisions: [],
      confirmations: [],
      finalTools: ['products_get_all'],
      config: { maxTools: 12, topSemanticHits: 8, similarityThreshold: 0.45, fallbackOnNoMatch: 'none', fallbackOnRouterError: 'all' },
    };
    (service as any).preview = { previewRouting: mock(() => Promise.resolve(preview)) };
    const result = await service.previewRouting('list products');
    expect(result.status).toBe('routed');
    expect(result.matches).toHaveLength(1);
  });

  test('returns disabled status when router is not available', async () => {
    const { service } = makeService();
    (service as any).preview = undefined;
    const result = await service.previewRouting('anything');
    expect(result.status).toBe('disabled');
    expect(result.matches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Controller delegation
// ---------------------------------------------------------------------------

describe('ChatbotRagController — Phase 5 endpoints', () => {
  let semantics: any;
  let controller: ChatbotRagController;

  beforeEach(() => {
    semantics = {
      listSemantics: mock(() => Promise.resolve([])),
      exportSemantics: mock(() => Promise.resolve({})),
      importSemantics: mock(() => Promise.resolve({ results: [] })),
      reindexSemantics: mock(() => Promise.resolve({ reindexed: 0, skipped: 0, failed: 0 })),
      getSemanticById: mock(() => Promise.resolve({})),
      createSemantic: mock(() => Promise.resolve({})),
      updateSemantic: mock(() => Promise.resolve({})),
      deleteSemantic: mock(() => Promise.resolve({ deleted: true })),
      previewRouting: mock(() => Promise.resolve({ status: 'routed' })),
    };
    controller = new ChatbotRagController() as any;
    controller.semantics = semantics;
  });

  test('listSemantics forwards optional toolName', async () => {
    await controller.listSemantics('tool_a');
    expect(semantics.listSemantics).toHaveBeenCalledWith('tool_a');
  });

  test('exportSemantics delegates to service', async () => {
    const result = await controller.exportSemantics();
    expect(result).toEqual({});
  });

  test('reindexSemantics delegates to service', async () => {
    const result = await controller.reindexSemantics();
    expect(result).toEqual({ reindexed: 0, skipped: 0, failed: 0 });
  });

  test('getSemanticById passes id', async () => {
    await controller.getSemanticById('abc123');
    expect(semantics.getSemanticById).toHaveBeenCalledWith('abc123');
  });

  test('createSemantic passes body', async () => {
    const body = { toolName: 't', phrase: 'p', lang: 'en' };
    await controller.createSemantic(body);
    expect(semantics.createSemantic).toHaveBeenCalledWith(body);
  });

  test('updateSemantic passes id and body', async () => {
    const body = { phrase: 'updated' };
    await controller.updateSemantic('abc123', body);
    expect(semantics.updateSemantic).toHaveBeenCalledWith('abc123', body);
  });

  test('deleteSemantic passes id', async () => {
    await controller.deleteSemantic('abc123');
    expect(semantics.deleteSemantic).toHaveBeenCalledWith('abc123');
  });

  test('previewRouting extracts query from body', async () => {
    await controller.previewRouting({ query: 'test query' });
    expect(semantics.previewRouting).toHaveBeenCalledWith('test query');
  });

  test('exportSemantics delegates to service', async () => {
    const result = await controller.exportSemantics();
    expect(result).toEqual({});
  });

  test('reindexSemantics delegates to service', async () => {
    const result = await controller.reindexSemantics();
    expect(result).toEqual({ reindexed: 0, skipped: 0, failed: 0 });
  });

  test('getSemanticById passes id', async () => {
    await controller.getSemanticById('abc123');
    expect(semantics.getSemanticById).toHaveBeenCalledWith('abc123');
  });

  test('createSemantic passes body', async () => {
    const body = { toolName: 't', phrase: 'p', lang: 'en' };
    await controller.createSemantic(body);
    expect(semantics.createSemantic).toHaveBeenCalledWith(body);
  });

  test('updateSemantic passes id and body', async () => {
    await controller.updateSemantic('abc', { phrase: 'new phrase' });
    expect(semantics.updateSemantic).toHaveBeenCalledWith('abc', { phrase: 'new phrase' });
  });

  test('deleteSemantic passes id', async () => {
    const result = await controller.deleteSemantic('abc');
    expect(result).toEqual({ deleted: true });
    expect(semantics.deleteSemantic).toHaveBeenCalledWith('abc');
  });

  test('previewRouting extracts query from body', async () => {
    const result = await controller.previewRouting({ query: 'test query' });
    expect(semantics.previewRouting).toHaveBeenCalledWith('test query');
    expect(result.status).toBe('routed');
  });
});
