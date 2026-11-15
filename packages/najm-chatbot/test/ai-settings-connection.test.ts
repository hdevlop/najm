import { describe, test, expect } from 'bun:test';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

function makeService(doGenerate: (options: any) => Promise<any>) {
  const repo = {
    setEncryption() {},
    get: async () => null,
    decryptApiKey: (row: any) => row,
  } as any;
  const service = new AiSettingsService(repo, {} as any);
  const built: any[] = [];
  (service as any).buildModel = (settings: any) => {
    built.push(settings);
    return new MockLanguageModelV1({ doGenerate });
  };
  return { service, built };
}

describe('C6: Test connection makes a real request', () => {
  test('a model that answers returns ok', async () => {
    let called = 0;
    const { service, built } = makeService(async () => { called += 1; return { text: 'pong', finishReason: 'stop', usage: {} }; });

    const result = await service.testConnection({ provider: 'openai', apiKey: 'sk-good', model: 'gpt-test' });

    expect(result.ok).toBe(true);
    expect(called).toBe(1);
    expect(built[0]).toMatchObject({ provider: 'openai', apiKey: 'sk-good', model: 'gpt-test' });
  });

  test('a provider error returns ok: false with the message and without the key', async () => {
    const { service } = makeService(async () => { throw new Error('Incorrect API key provided: sk-bad-12345'); });

    const result: any = await service.testConnection({ provider: 'openai', apiKey: 'sk-bad-12345', model: 'gpt-test' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Incorrect API key provided');
    expect(result.error).not.toContain('sk-bad-12345');
  });

  test('a provider that never answers fails within the time limit', async () => {
    const { service } = makeService((options: any) => new Promise((_, reject) => {
      options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal.reason ?? new Error('aborted')));
    }));
    (service as any).connectionTestTimeoutMs = 50;

    const started = Date.now();
    const result: any = await service.testConnection({ provider: 'openai', apiKey: 'sk', model: 'gpt-test' });

    expect(result.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
