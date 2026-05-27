import { describe, test, expect, mock } from 'bun:test';
import { ChatbotRagController } from '../src/chatbotRag/ChatbotRagController';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';

describe('ChatbotRagController', () => {
  test('delegates importSemantics to the rag service', async () => {
    const semantics = {
      importSemantics: mock(() => Promise.resolve({ results: [] })),
    } as any;
    const controller = new ChatbotRagController() as any;
    controller.semantics = semantics;

    const body = {
      items: [
        {
          toolName: 'students_get_students',
          phrases: [{ lang: 'en', phrase: 'list students' }],
        },
      ],
    };

    await expect(controller.importSemantics(body)).resolves.toEqual({ results: [] });
    expect(semantics.importSemantics).toHaveBeenCalledWith(body);
  });

  test('getSettings delegates to RoutingSettingsService', async () => {
    const controller = new ChatbotRagController() as any;
    controller.settings = {
      getEffectiveSettings: mock(() =>
        Promise.resolve({
          maxTools: 5,
          similarityThreshold: 0.6,
          source: 'db',
        }),
      ),
    };

    const result = await controller.getSettings();
    expect(result.maxTools).toBe(5);
    expect(result.similarityThreshold).toBe(0.6);
  });

  test('updateSettings delegates to RoutingSettingsService', async () => {
    const controller = new ChatbotRagController() as any;
    controller.settings = {
      updateSettings: mock(() =>
        Promise.resolve({
          maxTools: 3,
          similarityThreshold: 0.8,
          source: 'db',
        }),
      ),
    };

    const body = { maxTools: 3, similarityThreshold: 0.8 };
    const result = await controller.updateSettings(body);
    expect(result.maxTools).toBe(3);
    expect(result.similarityThreshold).toBe(0.8);
  });
});

describe('SemanticPhraseService', () => {
  test('importSemantics embeds phrases before upsert', async () => {
    const embedding = {
      embedBatch: mock(() => Promise.resolve([
        new Array(768).fill(0.1),
        new Array(768).fill(0.2),
      ])),
    } as any;

    const repository = {
      upsertSemantic: mock(() => Promise.resolve('inserted')),
      listSemantics: mock(() => Promise.resolve([])),
    } as any;

    const indexer = {} as any;
    const registry = { tools: [] } as any;
    const config = { toolRouting: { enabled: true }, rag: {}, dialect: 'pg' } as any;
    const validator = new ChatbotRagValidator();

    const service = new SemanticPhraseService(
      repository,
      registry,
      embedding,
      validator,
      indexer,
      config,
    );

    const result = await service.importSemantics({
      items: [
        {
          toolName: 'students_get_students',
          phrases: [
            { lang: 'en', phrase: 'list students' },
            { lang: 'ar', phrase: 'قائمة الطلاب' },
          ],
        },
      ],
    });

    expect(embedding.embedBatch).toHaveBeenCalledTimes(1);
    expect(embedding.embedBatch.mock.calls[0][0]).toEqual([
      'list students',
      'قائمة الطلاب',
    ]);

    expect(repository.upsertSemantic).toHaveBeenCalledTimes(2);
    const firstCall = repository.upsertSemantic.mock.calls[0][0];
    expect(firstCall.embedding).toEqual(new Array(768).fill(0.1));
    expect(firstCall.toolName).toBe('students_get_students');
    expect(firstCall.phrase).toBe('list students');
    expect(firstCall.lang).toBe('en');

    const secondCall = repository.upsertSemantic.mock.calls[1][0];
    expect(secondCall.embedding).toEqual(new Array(768).fill(0.2));
    expect(secondCall.lang).toBe('ar');

    expect(result.results.length).toBe(2);
    expect(result.results[0].status).toBe('inserted');
  });

  test('importSemantics handles embedding failure gracefully', async () => {
    const embedding = {
      embedBatch: mock(() => Promise.reject(new Error('ollama down'))),
    } as any;

    const repository = {
      upsertSemantic: mock(() => Promise.resolve('inserted')),
      listSemantics: mock(() => Promise.resolve([])),
    } as any;

    const indexer = {} as any;
    const registry = { tools: [] } as any;
    const config = { toolRouting: { enabled: true }, rag: {}, dialect: 'pg' } as any;
    const validator = new ChatbotRagValidator();

    const service = new SemanticPhraseService(
      repository,
      registry,
      embedding,
      validator,
      indexer,
      config,
    );

    const result = await service.importSemantics({
      items: [
        {
          toolName: 'students_get_students',
          phrases: [{ phrase: 'list students' }],
        },
      ],
    });

    expect(repository.upsertSemantic).not.toHaveBeenCalled();
    expect(result.results[0].status).toBe('skipped');
    expect(result.results[0].error).toBe('ollama down');
  });

  test('getStatus returns current routing state', async () => {
    const repository = {
      countEmbeddings: mock(() => Promise.resolve(5)),
      countSemantics: mock(() => Promise.resolve(10)),
    } as any;

    const indexer = { isIndexing: true } as any;
    const registry = { tools: [{ name: 'a' }, { name: 'b' }] } as any;
    const config = { toolRouting: { enabled: true, embedding: { model: 'test-model' } }, rag: {}, dialect: 'pg' } as any;
    const validator = new ChatbotRagValidator();

    const service = new SemanticPhraseService(
      repository,
      registry,
      {} as any,
      validator,
      indexer,
      config,
    );

    const status = await service.getStatus();
    expect(status.routingEnabled).toBe(true);
    expect(status.registeredToolCount).toBe(2);
    expect(status.indexedToolCount).toBe(5);
    expect(status.semanticPhraseCount).toBe(10);
    expect(status.embeddingDimensions).toBe(768);
    expect(status.indexingRunning).toBe(true);
    expect(status.effectiveSettings).toBeNull();
  });

  test('getStatus includes effective settings when RoutingSettingsService is available', async () => {
    const repository = {
      countEmbeddings: mock(() => Promise.resolve(0)),
      countSemantics: mock(() => Promise.resolve(0)),
    } as any;

    const indexer = { isIndexing: false } as any;
    const registry = { tools: [] } as any;
    const config = { toolRouting: { enabled: true }, rag: {}, dialect: 'pg' } as any;
    const validator = new ChatbotRagValidator();
    const settings = {
      getEffectiveSettings: mock(() =>
        Promise.resolve({
          maxTools: 7,
          similarityThreshold: 0.65,
          source: 'db',
        }),
      ),
    } as any;

    const service = new SemanticPhraseService(
      repository,
      registry,
      {} as any,
      validator,
      indexer,
      config,
    );
    (service as any).settings = settings;

    const status = await service.getStatus();
    expect(status.effectiveSettings).not.toBeNull();
    expect(status.effectiveSettings.maxTools).toBe(7);
    expect(status.effectiveSettings.similarityThreshold).toBe(0.65);
  });

  test('indexTools joins shared in-flight indexer promise', async () => {
    let resolveIndex: (value: { indexed: number; skipped: number }) => void;
    const sharedPromise = new Promise<{ indexed: number; skipped: number }>((resolve) => {
      resolveIndex = resolve;
    });
    const indexer = {
      isIndexing: false,
      indexTools: mock(() => {
        indexer.isIndexing = true;
        return sharedPromise.finally(() => {
          indexer.isIndexing = false;
        });
      }),
    } as any;

    const repository = {
      countEmbeddings: mock(() => Promise.resolve(0)),
      countSemantics: mock(() => Promise.resolve(0)),
    } as any;

    const registry = { tools: [] } as any;
    const config = { toolRouting: { enabled: true }, rag: {}, dialect: 'pg' } as any;
    const validator = new ChatbotRagValidator();

    const service = new SemanticPhraseService(
      repository,
      registry,
      {} as any,
      validator,
      indexer,
      config,
    );

    const first = service.indexTools();
    await Promise.resolve();
    const second = service.indexTools();

    resolveIndex!({ indexed: 1, skipped: 0 });

    await expect(first).resolves.toEqual({ status: 'completed', indexed: 1, skipped: 0 });
    await expect(second).resolves.toEqual({ status: 'already_running', indexed: 1, skipped: 0 });
    expect(indexer.indexTools).toHaveBeenCalledTimes(2);
  });
});
