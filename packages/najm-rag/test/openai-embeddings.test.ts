import { afterEach, describe, expect, test } from 'bun:test';
import { EmbeddingService, EmbeddingValidator } from '../src/embeddings';
import { chatbotEmbeddingSchema } from '../src/toolRouter/ToolRouterDto';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const vector = (value = 0.1, length = 768) => new Array(length).fill(value);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const service = (embedding = {}) => new EmbeddingService({ rag: {
  embedding: { provider: 'openai-compatible', baseUrl: 'http://localhost:18080/v1/', model: 'embeddinggemma', ...embedding },
} } as any, new EmbeddingValidator());

describe('OpenAI-compatible embeddings', () => {
  test('uses authenticated /embeddings, normalizes the URL and reorders batch results', async () => {
    let url: unknown;
    let init: any;
    globalThis.fetch = (async (u, i) => {
      url = u; init = i;
      return response({ data: [{ index: 1, embedding: vector(2) }, { index: 0, embedding: vector(1) }] });
    }) as typeof fetch;
    const result = await service({ apiKey: 'test-only-key' }).embedBatch(['one', 'two']);
    expect(url).toBe('http://localhost:18080/v1/embeddings');
    expect(init.headers.Authorization).toBe('Bearer test-only-key');
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body)).toEqual({ model: 'embeddinggemma', input: ['one', 'two'], encoding_format: 'float' });
    expect(result.map((row) => row[0])).toEqual([1, 2]);
  });

  test('forwards dimensions only when explicitly configured', async () => {
    let body: any;
    globalThis.fetch = (async (_u, init) => {
      body = JSON.parse(init!.body as string);
      return response({ data: [{ index: 0, embedding: vector(1, 512) }] });
    }) as typeof fetch;
    expect(await service({ dimensions: 512 }).embed('test')).toHaveLength(512);
    expect(body.dimensions).toBe(512);
  });

  test('can shorten and renormalize longer MRL vectors when explicitly enabled', async () => {
    globalThis.fetch = (async () => response({ data: [
      { index: 0, embedding: [...vector(0, 767), 3, 4, ...vector(0, 255)] },
    ] })) as typeof fetch;
    const result = await service({ truncateDimensions: true }).embed('teacher request');
    expect(result).toHaveLength(768);
    expect(result[767]).toBe(1);
    expect(Math.hypot(...result)).toBeCloseTo(1);
  });

  test('rejects longer vectors by default and invalid shortened vectors even when enabled', async () => {
    globalThis.fetch = (async () => response({ data: [
      { index: 0, embedding: vector(1, 1024) },
    ] })) as typeof fetch;
    await expect(service().embed('teacher request')).rejects.toThrow('dimensions');
    globalThis.fetch = (async () => response({ data: [
      { index: 0, embedding: [...vector(0, 768), ...vector(1, 256)] },
    ] })) as typeof fetch;
    await expect(service({ truncateDimensions: true }).embed('teacher request')).rejects.toThrow('normalize');
  });

  test('splits indexing into sequential bounded batches without losing order', async () => {
    const batches: string[][] = [];
    let running = 0;
    globalThis.fetch = (async (_url, init) => {
      expect(++running).toBe(1);
      const { input } = JSON.parse(init!.body as string);
      batches.push(input);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
      return response({ data: input.map((text: string, index: number) => ({ index, embedding: vector(Number(text)) })) });
    }) as typeof fetch;
    const client = service({ batchSize: 2 });
    expect((await client.embedBatch(['1', '2', '3', '4', '5'])).map((row) => row[0])).toEqual([1, 2, 3, 4, 5]);
    expect(batches).toEqual([['1', '2'], ['3', '4'], ['5']]);
    expect(await client.embedBatch([])).toEqual([]);
    expect(batches.length).toBe(3);
  });

  test('keeps query and document prompts and caches separate; local endpoint needs no key', async () => {
    const inputs: string[] = [];
    globalThis.fetch = (async (_url, init) => {
      expect(new Headers(init!.headers).has('Authorization')).toBe(false);
      const { input } = JSON.parse(init!.body as string);
      inputs.push(...input);
      return response({ data: input.map((_text: string, index: number) => ({ index, embedding: vector() })) });
    }) as typeof fetch;
    const client = service({ queryPrefix: 'query: ', documentPrefix: 'document: ' });
    await client.embed('same');
    await client.embed('same');
    await client.embed('same', 'document');
    await client.embedBatch(['batch']);
    expect(inputs).toEqual(['query: same', 'document: same', 'document: batch']);
  });

  test.each([
    ['missing data', {}],
    ['wrong count', { data: [] }],
    ['invalid index', { data: [{ index: -1, embedding: vector() }] }],
    ['noninteger index', { data: [{ index: 0.5, embedding: vector() }] }],
    ['out of bounds', { data: [{ index: 1, embedding: vector() }] }],
    ['wrong dimensions', { data: [{ index: 0, embedding: vector(1, 512) }] }],
    ['invalid values', { data: [{ index: 0, embedding: new Array(768).fill('1') }] }],
    ['null vector', { data: [{ index: 0, embedding: null }] }],
  ])('rejects %s without caching a bad result', async (_name, payload) => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return response(payload); }) as typeof fetch;
    const client = service();
    await expect(client.embed('test')).rejects.toThrow();
    await expect(client.embed('test')).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test('rejects duplicate batch indexes', async () => {
    globalThis.fetch = (async () => response({ data: [
      { index: 0, embedding: vector() }, { index: 0, embedding: vector() },
    ] })) as typeof fetch;
    await expect(service().embedBatch(['a', 'b'])).rejects.toThrow('duplicate');
  });

  test('rejects nonfinite vector numbers', () => {
    const validator = new EmbeddingValidator();
    expect(() => validator.assertResponse({ embeddings: [vector(Infinity)] }, 1)).toThrow('finite');
    expect(() => validator.assertResponse({ embeddings: [vector(NaN)] }, 1)).toThrow('finite');
  });

  test('health checks validate vectors and use the same authenticated endpoint', async () => {
    globalThis.fetch = (async (url, init) => {
      expect(String(url)).toEndWith('/v1/embeddings');
      expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer test-only-key');
      return response({ data: [{ index: 0, embedding: vector(1, 512) }] });
    }) as typeof fetch;
    const result = await service({ apiKey: 'test-only-key' }).health();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('dimensions');
    expect(JSON.stringify(result)).not.toContain('test-only-key');
  });

  test('does not expose upstream error bodies or keys', async () => {
    globalThis.fetch = (async () => response({ error: 'secret-provider-details' }, 401)) as typeof fetch;
    const client = service({ apiKey: 'test-only-key' });
    await expect(client.embed('test')).rejects.toThrow('Embedding request failed: 401');
    const result = await client.health();
    expect(JSON.stringify(result)).not.toContain('secret-provider-details');
    expect(JSON.stringify(result)).not.toContain('test-only-key');
  });

  test('aborts slow requests and permits health retry after a timeout', async () => {
    let calls = 0;
    globalThis.fetch = ((_url, init) => {
      if (++calls > 1) return Promise.resolve(response({ data: [{ index: 0, embedding: vector() }] }));
      return new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as typeof fetch;
    const result = await service({ healthTimeoutMs: 5 }).health(undefined, { retries: 1 });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  test('does not expose malformed response content', async () => {
    globalThis.fetch = (async () => new Response('secret-provider-details')) as typeof fetch;
    await expect(service().embed('test')).rejects.toThrow('Embedding response is not valid JSON');
  });

  test('rejects credential-bearing URLs without exposing credentials', async () => {
    await expect(service({ baseUrl: 'http://user:secret@localhost/v1' }).embed('test'))
      .rejects.toThrow('without credentials');
  });

  test('health reports invalid configuration instead of rejecting', async () => {
    for (const embedding of [{ baseUrl: 'localhost:8080/v1' }, { baseUrl: 'http://user:secret@localhost/v1' }, { batchSize: 0 }]) {
      const result = await service(embedding).health();
      expect(result.ok).toBe(false);
      expect(result.error).toBeString();
      expect(JSON.stringify(result)).not.toContain('secret');
    }
  });

  test('names the transport failure code', async () => {
    globalThis.fetch = (async () => {
      throw Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' });
    }) as unknown as typeof fetch;
    await expect(service().embed('test')).rejects.toThrow('(ConnectionRefused)');
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }) });
    }) as unknown as typeof fetch;
    await expect(service().embed('test')).rejects.toThrow('(ENOTFOUND)');
  });

  test('Ollama retains its native request and response contract', async () => {
    globalThis.fetch = (async (url, init) => {
      expect(String(url)).toBe('http://localhost:11434/api/embed');
      expect(JSON.parse(init!.body as string)).toEqual({ model: 'embeddinggemma', input: ['test'] });
      return response({ embeddings: [vector()] });
    }) as typeof fetch;
    expect((await service({ provider: 'ollama', baseUrl: 'http://localhost:11434' }).embed('test')).length).toBe(768);
  });

  test('Ollama honors truncateDimensions', async () => {
    globalThis.fetch = (async () => response({ embeddings: [[...vector(0, 767), 3, 4, ...vector(0, 255)]] })) as typeof fetch;
    const ollama = (embedding = {}) => service({ provider: 'ollama', baseUrl: 'http://localhost:11434', ...embedding });
    await expect(ollama().embed('test')).rejects.toThrow('dimensions');
    const result = await ollama({ truncateDimensions: true }).embed('test');
    expect(result).toHaveLength(768);
    expect(Math.hypot(...result)).toBeCloseTo(1);
  });

  test('routing JSON accepts provider options and strips secret keys', () => {
    const parsed = chatbotEmbeddingSchema.parse({ provider: 'openai-compatible', batchSize: 4, dimensions: 768,
      truncateDimensions: true,
      queryPrefix: 'q: ', documentPrefix: 'd: ', apiKey: 'not-a-file-setting' });
    expect(parsed.provider).toBe('openai-compatible');
    expect(parsed.batchSize).toBe(4);
    expect(parsed.truncateDimensions).toBe(true);
    expect(parsed).not.toHaveProperty('apiKey');
  });
});
