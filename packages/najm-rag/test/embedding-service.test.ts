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
        json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }),
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

  function hangingFetch(calls: { signal: AbortSignal; at: number }[]) {
    return mock((_url: any, init: any) => {
      calls.push({ signal: init.signal, at: Date.now() });
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted') as Error & { name: string };
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as any;
  }

  test('query embeddings use queryTimeoutMs; indexing keeps timeoutMs', async () => {
    const service = new EmbeddingService({
      rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', timeoutMs: 400, queryTimeoutMs: 5 } },
    } as any, new EmbeddingValidator());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = hangingFetch([]);
    try {
      await expect(service.embed('how many students')).rejects.toThrow('timed out after 5ms');
      await expect(service.embedBatch(['Tool: students_count'])).rejects.toThrow('timed out after 400ms');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('queryTimeoutMs defaults to timeoutMs', async () => {
    const service = new EmbeddingService({
      rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', timeoutMs: 7 } },
    } as any, new EmbeddingValidator());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = hangingFetch([]);
    try {
      await expect(service.embed('q')).rejects.toThrow('timed out after 7ms');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('after a query failure, queries fail fast for queryFailureCooldownMs; indexing and health still call', async () => {
    const service = new EmbeddingService({
      rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', queryTimeoutMs: 5, queryFailureCooldownMs: 60_000 } },
    } as any, new EmbeddingValidator());
    const originalFetch = globalThis.fetch;
    let reachable = false;
    let calls = 0;
    globalThis.fetch = mock((_url: any, init: any) => {
      calls++;
      if (reachable) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ embeddings: [new Array(768).fill(0.1)] }) } as any);
      }
      return Promise.reject(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
    }) as any;
    try {
      await expect(service.embed('route this')).rejects.toThrow('could not reach');
      expect(calls).toBe(1);
      // The knowledge search for the same message does not try again.
      await expect(service.embed('search this')).rejects.toThrow('skipped after a recent failure');
      expect(calls).toBe(1);
      // Indexing is not held back by the query window.
      await expect(service.embedBatch(['doc'])).rejects.toThrow('could not reach');
      expect(calls).toBe(2);
      // A healthy check ends the window.
      reachable = true;
      expect((await service.health()).ok).toBe(true);
      expect((await service.embed('route this')).length).toBe(768);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('a bad provider answer does not open the failure window', async () => {
    const service = new EmbeddingService({
      rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', queryFailureCooldownMs: 60_000 } },
    } as any, new EmbeddingValidator());
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = mock(() => { calls++; return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) } as any); }) as any;
    try {
      await expect(service.embed('a')).rejects.toThrow('400');
      await expect(service.embed('b')).rejects.toThrow('400');
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('without a cooldown every query tries the provider', async () => {
    const service = new EmbeddingService({
      rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' } },
    } as any, new EmbeddingValidator());
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = mock(() => { calls++; return Promise.reject(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })); }) as any;
    try {
      await expect(service.embed('a')).rejects.toThrow('could not reach');
      await expect(service.embed('b')).rejects.toThrow('could not reach');
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects a non-positive query timeout or a negative cooldown', async () => {
    for (const embedding of [{ queryTimeoutMs: 0 }, { queryFailureCooldownMs: -1 }]) {
      const service = new EmbeddingService({
        rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', ...embedding } },
      } as any, new EmbeddingValidator());
      await expect(service.embed('q')).rejects.toThrow('query timeout must be positive');
    }
  });
});
