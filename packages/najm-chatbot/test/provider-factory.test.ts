import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { buildModel, PROVIDERS, PROVIDER_OPTIONS, type LlmProvider } from '../src/agent/LlmProviderFactory';

const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async () => {
    throw new Error('network call forbidden in unit tests');
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('LlmProviderFactory', () => {
  test('PROVIDERS catalog has every supported provider', () => {
    const keys: LlmProvider[] = ['anthropic', 'openai', 'google', 'zai', 'opencode', 'openrouter', 'minimax', 'qwen', 'ollama', 'custom'];
    for (const k of keys) expect(PROVIDERS[k]).toBeDefined();
    expect(PROVIDER_OPTIONS.length).toBe(keys.length);
  });

  test.each(
    (['anthropic', 'openai', 'google', 'zai', 'opencode', 'openrouter', 'minimax', 'qwen', 'ollama', 'custom'] as LlmProvider[]).map((p) => [p]),
  )('buildModel(%s) returns a model without throwing or hitting the network', (provider) => {
    const meta = PROVIDERS[provider];
    const model = buildModel({
      provider,
      apiKey: meta.needsKey ? 'sk-test-placeholder' : null,
      baseUrl: meta.needsUrl ? meta.defaultBaseUrl || 'http://localhost:9999' : null,
      model: meta.defaultModel,
    });
    expect(model).toBeTruthy();
    expect(typeof model).toMatch(/object|function/);
  });

  test('buildModel(openrouter) adds host routing and reasoning to the request body', async () => {
    let sent: Record<string, any> | undefined;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'r1', object: 'chat.completion', created: 0, model: 'openai/gpt-oss-120b',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }), { headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    try {
      const model = buildModel(
        { provider: 'openrouter', apiKey: 'sk-test-placeholder', baseUrl: null, model: 'openai/gpt-oss-120b' },
        { openrouter: { provider: { order: ['cerebras'], allow_fallbacks: true }, reasoning: { effort: 'low' } } },
      );
      await (model as any).doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
    } finally {
      globalThis.fetch = (async () => {
        throw new Error('network call forbidden in unit tests');
      }) as unknown as typeof fetch;
    }
    expect(sent?.model).toBe('openai/gpt-oss-120b');
    expect(sent?.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(sent?.provider).toEqual({ order: ['cerebras'], allow_fallbacks: true });
    expect(sent?.reasoning).toEqual({ effort: 'low' });
  });

  test('buildModel(openrouter) sends no extra fields without options', async () => {
    let sent: Record<string, any> | undefined;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'r1', object: 'chat.completion', created: 0, model: 'm',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }), { headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    try {
      const model = buildModel({ provider: 'openrouter', apiKey: 'k', baseUrl: null, model: 'm' }, { openrouter: {} });
      await (model as any).doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] });
    } finally {
      globalThis.fetch = (async () => {
        throw new Error('network call forbidden in unit tests');
      }) as unknown as typeof fetch;
    }
    expect(sent && 'provider' in sent).toBe(false);
    expect(sent && 'reasoning' in sent).toBe(false);
  });

  test('buildModel(opencode) routes MiniMax models through the same provider', () => {
    const model = buildModel({
      provider: 'opencode',
      apiKey: 'sk-test-placeholder',
      baseUrl: PROVIDERS.opencode.defaultBaseUrl,
      model: 'minimax-m2.7',
    });
    expect(model).toBeTruthy();
    expect(typeof model).toMatch(/object|function/);
  });
});
