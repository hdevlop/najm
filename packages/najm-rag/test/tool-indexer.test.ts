import { describe, test, expect, mock } from 'bun:test';
import { ToolIndexerService } from '../src/toolIndex';

describe('ToolIndexerService', () => {
  test('skips unchanged fingerprints', async () => {
    const registry = { tools: [{ name: 'a', description: 'A' }] } as any;
    const embedding = { embedBatch: mock(() => Promise.resolve([new Array(768).fill(0.1)])) } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry,
      embedding,
      repository,
      { info: mock(() => {}), error: mock(() => {}) } as any,
    );

    // First index to get the fingerprint
    await service.indexTools();
    expect(repository.upsertEmbedding).toHaveBeenCalledTimes(1);
    const fingerprint = repository.upsertEmbedding.mock.calls[0][0].fingerprint;
    expect(fingerprint).toMatch(/^[a-f0-9]{40}$/);

    // Reset mocks
    repository.upsertEmbedding.mockClear();
    embedding.embedBatch.mockClear();
    repository.listEmbeddings = mock(() =>
      Promise.resolve([{ toolName: 'a', fingerprint }]),
    );

    // Re-index — should skip because fingerprint matches
    const result = await service.indexTools();
    expect(result.indexed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(embedding.embedBatch).not.toHaveBeenCalled();
  });

  test('indexes changed tools', async () => {
    const registry = {
      tools: [{ name: 'a', description: 'Changed' }],
    } as any;
    const embedding = {
      embedBatch: mock(() => Promise.resolve([new Array(768).fill(0.1)])),
    } as any;
    const repository = {
      listEmbeddings: mock(() =>
        Promise.resolve([{ toolName: 'a', fingerprint: 'old_fp' }]),
      ),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry,
      embedding,
      repository,
      { info: mock(() => {}), error: mock(() => {}) } as any,
    );

    const result = await service.indexTools();
    expect(result.indexed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(embedding.embedBatch).toHaveBeenCalledTimes(1);
  });

  test('onReady does nothing when routing disabled', () => {
    const registry = { tools: [] } as any;
    const embedding = { embedBatch: mock(() => Promise.resolve([])) } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;
    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: false } } as any,
      registry,
      embedding,
      repository,
      log,
    );

    service.onReady();
    expect(embedding.embedBatch).not.toHaveBeenCalled();
  });

  test('onReady does nothing when indexOnBoot false', () => {
    const registry = { tools: [] } as any;
    const embedding = { embedBatch: mock(() => Promise.resolve([])) } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;
    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: true, indexOnBoot: false } } as any,
      registry,
      embedding,
      repository,
      log,
    );

    service.onReady();
    expect(embedding.embedBatch).not.toHaveBeenCalled();
  });

  test('onReady starts indexing in background without blocking', async () => {
    const registry = { tools: [{ name: 'a', description: 'A' }] } as any;
    let resolveBatch: (v: number[][]) => void;
    const batchPromise = new Promise<number[][]>((r) => { resolveBatch = r; });
    const embedding = {
      health: mock(() => Promise.resolve({
        ok: true,
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        latencyMs: 1,
      })),
      embedBatch: mock(() => batchPromise),
    } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;
    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: true, indexOnBoot: true } } as any,
      registry,
      embedding,
      repository,
      log,
    );

    // onReady returns immediately (void)
    service.onReady();
    await Promise.resolve();
    expect(embedding.health).toHaveBeenCalledWith(undefined, { retries: 1 });
    expect(log.info).toHaveBeenCalledWith(
      '[chatbot-rag] Starting tool indexing on boot (background)...',
    );
    expect(service.isIndexing).toBe(true);

    // Resolve the background promise
    resolveBatch!([[...Array(768)].map(() => 0.1)]);
    await new Promise((r) => setTimeout(r, 10));
    expect(embedding.embedBatch).toHaveBeenCalledTimes(1);
    expect(service.isIndexing).toBe(false);
  });

  test('indexTools shares one in-flight run across callers', async () => {
    const registry = { tools: [{ name: 'a', description: 'A' }] } as any;
    let resolveBatch: (v: number[][]) => void;
    const batchPromise = new Promise<number[][]>((r) => { resolveBatch = r; });
    const embedding = { embedBatch: mock(() => batchPromise) } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;
    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const service = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry,
      embedding,
      repository,
      log,
    );

    const first = service.indexTools();
    const second = service.indexTools();
    expect(service.isIndexing).toBe(true);
    expect(repository.listEmbeddings).toHaveBeenCalledTimes(1);

    resolveBatch!([new Array(768).fill(0.1)]);
    const results = await Promise.all([first, second]);

    expect(results).toEqual([
      { indexed: 1, skipped: 0 },
      { indexed: 1, skipped: 0 },
    ]);
    expect(embedding.embedBatch).toHaveBeenCalledTimes(1);
    expect(repository.upsertEmbedding).toHaveBeenCalledTimes(1);
    expect(service.isIndexing).toBe(false);
  });

  test('fingerprint is deterministic and changes when metadata changes', async () => {
    const registry = { tools: [{ name: 'a', description: 'A' }] } as any;
    const embedding = { embedBatch: mock(() => Promise.resolve([new Array(768).fill(0.1)])) } as any;
    const repository = {
      listEmbeddings: mock(() => Promise.resolve([])),
      upsertEmbedding: mock(() => Promise.resolve()),
    } as any;
    const log = { info: mock(() => {}), error: mock(() => {}) } as any;

    const service1 = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry,
      embedding,
      repository,
      log,
    );

    await service1.indexTools();
    const fp1 = repository.upsertEmbedding.mock.calls[0][0].fingerprint;
    expect(fp1).toMatch(/^[a-f0-9]{40}$/);

    // Same metadata => same fingerprint
    repository.upsertEmbedding.mockClear();
    repository.listEmbeddings = mock(() =>
      Promise.resolve([{ toolName: 'a', fingerprint: fp1 }]),
    );
    await service1.indexTools();
    const fp2 = repository.upsertEmbedding.mock.calls[0]?.[0]?.fingerprint;
    expect(fp2).toBeUndefined(); // skipped because fingerprint matches

    // Different description => different fingerprint
    const registry2 = { tools: [{ name: 'a', description: 'B' }] } as any;
    const service2 = new ToolIndexerService(
      { toolRouting: { enabled: true } } as any,
      registry2,
      embedding,
      repository,
      log,
    );
    repository.listEmbeddings = mock(() => Promise.resolve([{ toolName: 'a', fingerprint: fp1 }]));
    await service2.indexTools();
    const fp3 = repository.upsertEmbedding.mock.calls[0][0].fingerprint;
    expect(fp3).not.toBe(fp1);
  });
});
