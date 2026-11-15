import { describe, test, expect, mock, afterEach } from 'bun:test';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function service(embedding: Record<string, unknown> = {}) {
  return new EmbeddingService({
    rag: { embedding: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', ...embedding } },
  } as any, new EmbeddingValidator());
}

describe('T1: query embedding defaults', () => {
  test('queries wait 4 s by default; indexing keeps 8 s', () => {
    const config = (service() as any).embeddingConfig;
    expect(config.queryTimeoutMs).toBe(4000);
    expect(config.timeoutMs).toBe(8000);
    expect(config.queryFailureCooldownMs).toBe(15_000);
  });

  test('an explicit query timeout or cooldown still wins', () => {
    const config = (service({ queryTimeoutMs: 9000, queryFailureCooldownMs: 0 }) as any).embeddingConfig;
    expect(config.queryTimeoutMs).toBe(9000);
    expect(config.queryFailureCooldownMs).toBe(0);
  });

  test('after an unreachable provider, the next query in the window does not call it', async () => {
    let calls = 0;
    globalThis.fetch = mock(() => { calls++; return Promise.reject(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })); }) as any;
    const embedder = service();

    await expect(embedder.embed('route this')).rejects.toThrow('could not reach');
    await expect(embedder.embed('search this')).rejects.toThrow('skipped after a recent failure');
    expect(calls).toBe(1);
  });
});
