import { describe, test, expect, afterEach } from 'bun:test';
import { generateText } from 'ai';
import { buildModel, type LlmSettings } from '../src/agent/LlmProviderFactory';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Runs one request through the real provider client and returns the URL it called. */
async function requestedUrl(settings: LlmSettings): Promise<string> {
  let url = '';
  globalThis.fetch = (async (input: any) => {
    url = typeof input === 'string' ? input : input.url ?? String(input);
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: settings.model,
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  await generateText({ model: buildModel(settings), prompt: 'hi' }).catch(() => {});
  return url;
}

describe('C7: OpenAI-compatible providers call chat completions', () => {
  test('ollama', async () => {
    expect(await requestedUrl({ provider: 'ollama', model: 'llama3.1', baseUrl: 'http://localhost:11434' }))
      .toBe('http://localhost:11434/v1/chat/completions');
  });

  test('custom', async () => {
    expect(await requestedUrl({ provider: 'custom', model: 'local', baseUrl: 'http://localhost:8080/v1' }))
      .toBe('http://localhost:8080/v1/chat/completions');
  });

  test('an ollama base URL with a trailing slash or /v1 is not doubled', async () => {
    expect(await requestedUrl({ provider: 'ollama', model: 'llama3.1', baseUrl: 'http://localhost:11434/' }))
      .toBe('http://localhost:11434/v1/chat/completions');
    expect(await requestedUrl({ provider: 'ollama', model: 'llama3.1', baseUrl: 'http://localhost:11434/v1/' }))
      .toBe('http://localhost:11434/v1/chat/completions');
  });
});
