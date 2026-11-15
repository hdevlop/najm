import { describe, test, expect, mock } from 'bun:test';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

function makeAgent(streamTimeout: Record<string, number> | undefined, outcomes: string[]) {
  const store = { load: async () => null, loadSession: async () => null, save: async () => {}, clear: async () => {} } as any;
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test', systemPrompt: 'x' }) } as any,
    store,
    store,
    {
      tools: 'none', maxSteps: 10, conversationStore: 'db', streamTimeout,
      chatLogging: { enabled: false, onDiagnostics: (data: any) => { outcomes.push(data.outcome); } },
    } as any,
    { insert: mock(() => Promise.resolve()) } as any,
  );
  (agent as any).container = { get: () => { throw new Error('none'); } };
  // A provider that never answers until the request is aborted.
  (agent as any).buildModel = () => new MockLanguageModelV1({
    doGenerate: (options: any) => new Promise((_, reject) => {
      options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal.reason ?? new Error('aborted')));
    }),
  });
  return agent;
}

const ask = { messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] } as any] };

describe('C8: non-streaming answers have a time limit', () => {
  test('runOnce rejects when totalMs passes and records an error outcome', async () => {
    const outcomes: string[] = [];
    const agent = makeAgent({ chunkMs: 60_000, totalMs: 100 }, outcomes);

    const started = Date.now();
    await expect(agent.runOnce(ask)).rejects.toBeDefined();

    expect(Date.now() - started).toBeLessThan(2000);
    expect(outcomes).toEqual(['error']);
  });

  test('debugRun returns a provider error when totalMs passes', async () => {
    const agent = makeAgent({ totalMs: 100 }, []);

    const result: any = await agent.debugRun(ask);

    expect(result.code).toBe('PROVIDER_ERROR');
  });

  test('without a configured total, a default limit applies', () => {
    const agent = makeAgent(undefined, []);
    expect((agent as any).generateTimeout()).toEqual({ totalMs: 120_000 });
  });
});
