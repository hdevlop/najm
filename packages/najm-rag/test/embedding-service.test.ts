import { describe, test, expect, mock } from 'bun:test';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';

describe('EmbeddingService', () => {
  test('embed validates 768 dimensions', async () => {
    const service = new EmbeddingService({
      toolRouting: {
        embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );

    const result = await service.embed('hello');
    expect(result.length).toBe(768);

    globalThis.fetch = originalFetch;
  });

  test('embed throws on wrong dimensions', async () => {
    const service = new EmbeddingService({
      toolRouting: {
        embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(512).fill(0.1)] }),
      } as any),
    );

    await expect(service.embed('hello')).rejects.toThrow('Invalid embedding dimensions');

    globalThis.fetch = originalFetch;
  });

  test('embed throws on HTTP failure', async () => {
    const service = new EmbeddingService({
      toolRouting: {
        embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any),
    );

    await expect(service.embed('hello')).rejects.toThrow('Embedding request failed: 500');

    globalThis.fetch = originalFetch;
  });

  test('embedBatch validates count match', async () => {
    const service = new EmbeddingService({
      toolRouting: {
        embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
      } as any),
    );

    await expect(service.embedBatch(['a', 'b'])).rejects.toThrow('Embedding count mismatch');

    globalThis.fetch = originalFetch;
  });

  test('toVector formats embedding correctly', () => {
    expect(EmbeddingService.toVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });
});
