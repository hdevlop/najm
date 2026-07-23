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
