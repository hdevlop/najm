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

  test('health uses configured health timeout', async () => {
    const service = new EmbeddingService({
      rag: {
        embedding: {
          provider: 'ollama',
          baseUrl: 'http://localhost:11434',
          model: 'test',
          healthTimeoutMs: 5,
        },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted') as Error & { name: string };
          error.name = 'AbortError';
          reject(error);
        });
      }),
    ) as any;

    try {
      const result = await service.health();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('5ms');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('health retries once after a timeout when requested', async () => {
    const service = new EmbeddingService({
      rag: {
        embedding: {
          provider: 'ollama',
          baseUrl: 'http://localhost:11434',
          model: 'test',
          healthTimeoutMs: 5,
        },
      },
    } as any, new EmbeddingValidator());

    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = mock((_url: any, init: any) => {
      calls++;
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted') as Error & { name: string };
            error.name = 'AbortError';
            reject(error);
          });
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as any);
    }) as any;

    try {
      const result = await service.health(undefined, { retries: 1 });
      expect(result.ok).toBe(true);
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
