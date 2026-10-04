import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';
import { withEmbeddingDiagnostics, type EmbeddingDiagnostic } from '../src/diagnostics';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const service = (extra = {}) => new EmbeddingService({ rag: { queryEmbeddingCacheSize: 8,
  embedding: { provider: 'ollama', model: 'test', dimensions: 2, batchSize: 2,
    queryTimeoutMs: 8, queryFailureCooldownMs: 1000, ...extra } } } as any, new EmbeddingValidator());
const response = (n = 1) => new Response(JSON.stringify({ embeddings: Array.from({ length: n }, () => [0.1, 0.2]) }));
const collect = (correlationId = 'request-a') => {
  const events: EmbeddingDiagnostic[] = [];
  return { events, options: { correlationId, onEmbedding: (event: EmbeddingDiagnostic) => { events.push(event); } } };
};
const hang = () => {
  globalThis.fetch = ((_url: any, init: any) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('private text', 'AbortError')));
  })) as any;
};

describe('request-scoped embedding diagnostics', () => {
  test('records one miss and one cross-purpose cache hit without duplicate batch spans', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return response(); }) as any;
    const embedding = service();
    const sink = collect();
    await withEmbeddingDiagnostics(sink.options, async () => {
      await embedding.embed('private query', 'query', 'tool-routing');
      await embedding.embed('private query', 'query', 'knowledge-search');
    });
    expect(calls).toBe(1);
    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]).toMatchObject({ version: 1, correlationId: 'request-a',
      operation: 'tool-routing', cache: 'miss', inputCount: 1, outcome: 'completed',
      provider: 'ollama', model: 'test', timeoutMs: 8 });
    expect(sink.events[0]!.attempts).toHaveLength(1);
    expect(sink.events[1]).toMatchObject({ operation: 'knowledge-search', cache: 'hit', attempts: [] });
    expect(JSON.stringify(sink.events)).not.toContain('private query');
    for (const event of sink.events) {
      expect(event.startMs).toBeGreaterThanOrEqual(0);
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
      for (const attempt of event.attempts) expect(attempt.startMs).toBeGreaterThanOrEqual(event.startMs);
    }
  });

  test('records each actual batch request and the batch failure', async () => {
    let calls = 0;
    globalThis.fetch = (async () => ++calls === 1 ? response(2) : new Response('private body', { status: 500 })) as any;
    const sink = collect();
    await expect(withEmbeddingDiagnostics(sink.options, () =>
      service().embedBatch(['a', 'b', 'c'], 'document', 'tool-index'))).rejects.toThrow('500');
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({ cache: 'bypass', purpose: 'document', inputCount: 3, outcome: 'error' });
    expect(sink.events[0]!.attempts.map(a => [a.inputCount, a.outcome])).toEqual([[2, 'completed'], [1, 'error']]);
    expect(JSON.stringify(sink.events)).not.toContain('private body');
  });

  test('distinguishes timeout from cooldown with no second network attempt', async () => {
    hang();
    const embedding = service();
    const sink = collect();
    await withEmbeddingDiagnostics(sink.options, async () => {
      await expect(embedding.embed('first')).rejects.toThrow('timed out');
      await expect(embedding.embed('second')).rejects.toThrow('skipped');
    });
    expect(sink.events.map(e => [e.outcome, e.attempts.length])).toEqual([['timeout', 1], ['cooldown', 0]]);
    expect(sink.events[0]!.attempts[0]!.outcome).toBe('timeout');
  });

  test('reports transport, invalid response and invalid config without error text or secrets', async () => {
    const sink = collect();
    await withEmbeddingDiagnostics(sink.options, async () => {
      globalThis.fetch = (async () => { throw new TypeError('secret query endpoint token'); }) as any;
      await expect(service().embed('private')).rejects.toThrow();
      globalThis.fetch = (async () => new Response('not JSON private body')) as any;
      await expect(service().embed('private')).rejects.toThrow();
      await expect(service({ baseUrl: 'http://user:secret@localhost' }).embed('private')).rejects.toThrow();
    });
    expect(sink.events.map(e => [e.outcome, e.attempts.length])).toEqual([['unavailable', 1], ['error', 1], ['error', 0]]);
    const json = JSON.stringify(sink.events);
    for (const secret of ['secret', 'private', 'localhost', 'http://', 'baseUrl', 'apiKey']) expect(json).not.toContain(secret);
  });

  test('health retries are real attempts, and eventual success remains completed', async () => {
    let calls = 0;
    globalThis.fetch = ((_url: any, init: any) => {
      if (++calls === 2) return Promise.resolve(response());
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))));
    }) as any;
    const sink = collect();
    const result = await withEmbeddingDiagnostics(sink.options, () => service().health(5, { retries: 1 }));
    expect(result.ok).toBe(true);
    expect(sink.events[0]).toMatchObject({ purpose: 'health', cache: 'bypass', outcome: 'completed', timeoutMs: 5 });
    expect(sink.events[0]!.attempts.map(a => a.outcome)).toEqual(['timeout', 'completed']);
  });

  test('isolates overlapping requests using the same service', async () => {
    globalThis.fetch = (async (_url: any, init: any) => {
      const text = JSON.parse(init.body).input[0];
      await new Promise(resolve => setTimeout(resolve, text === 'slow' ? 10 : 1));
      return response();
    }) as any;
    const embedding = service({ queryTimeoutMs: 100 });
    const slow = collect('slow-id');
    const fast = collect('fast-id');
    await Promise.all([
      withEmbeddingDiagnostics(slow.options, () => embedding.embed('slow', 'query', 'tool-routing')),
      withEmbeddingDiagnostics(fast.options, () => embedding.embed('fast', 'query', 'knowledge-search')),
    ]);
    expect(slow.events.map(e => [e.correlationId, e.operation])).toEqual([['slow-id', 'tool-routing']]);
    expect(fast.events.map(e => [e.correlationId, e.operation])).toEqual([['fast-id', 'knowledge-search']]);
  });

  test('sink throws or rejected promises never change returned vectors', async () => {
    globalThis.fetch = (async () => response()) as any;
    for (const onEmbedding of [() => { throw new Error('sink'); }, async () => { throw new Error('sink'); }]) {
      expect(await withEmbeddingDiagnostics({ onEmbedding }, () => service().embed('q'))).toEqual([0.1, 0.2]);
    }
    await new Promise(resolve => setTimeout(resolve, 1));
  });

  test('nested scopes restore the parent, and detached work cannot append after scope completion', async () => {
    globalThis.fetch = (async () => response()) as any;
    const parent = collect('parent');
    const child = collect('child');
    const embedding = service();
    let detached: Promise<unknown>;
    await withEmbeddingDiagnostics(parent.options, async () => {
      await withEmbeddingDiagnostics(child.options, () => embedding.embed('child'));
      await embedding.embed('parent');
      detached = new Promise(resolve => setTimeout(resolve, 5)).then(() => embedding.embed('detached'));
    });
    await detached!;
    expect(parent.events.map(e => e.correlationId)).toEqual(['parent']);
    expect(child.events.map(e => e.correlationId)).toEqual(['child']);
  });

  test('cache controls are scoped to one service instance', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return response(); }) as any;
    const a = service(); const b = service();
    await a.embed('q'); await b.embed('q');
    a.clearQueryCache();
    const sink = collect();
    await withEmbeddingDiagnostics(sink.options, async () => { await a.embed('q'); await b.embed('q'); });
    expect(calls).toBe(3);
    expect(sink.events.map(e => e.cache)).toEqual(['miss', 'hit']);
  });
});
