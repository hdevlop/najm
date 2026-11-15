import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { CHATBOT_CONTEXT_PROVIDER } from '../src/tokens';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

function makeAgent(router: any, contextProvider: any) {
  const store = { load: async () => null, loadSession: async () => null, save: async () => {}, clear: async () => {} } as any;
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test', systemPrompt: 'base' }) } as any,
    store,
    store,
    { toolRouting: { enabled: true }, chatLogging: { enabled: false }, maxSteps: 10, conversationStore: 'db' } as any,
    { insert: mock(() => Promise.resolve()) } as any,
  );
  const tool = { name: 'orders_list', description: 'List orders' };
  (agent as any).container = {
    get: (token: any) => {
      if (token === McpRegistryService) return { tools: [tool] };
      if (token === McpBuilderService) return { invokeTool: async () => ({ content: [{ type: 'text', text: '[]' }] }) };
      if (token === TOOL_PROVIDER) return router;
      if (token === CHATBOT_CONTEXT_PROVIDER) return contextProvider;
      throw new Error('unknown token');
    },
  };
  const prompts: any[] = [];
  (agent as any).buildModel = () => new MockLanguageModelV1({
    doGenerate: async (options: any) => { prompts.push(options.prompt); return { text: 'ok', finishReason: 'stop', usage: {} }; },
  });
  return { agent, prompts, tool };
}

const ask = { messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'my orders' }] } as any] };

describe('T4: routing and knowledge lookup run together', () => {
  test('the context lookup starts before routing finishes', async () => {
    let contextStarted!: () => void;
    const started = new Promise<void>((resolve) => { contextStarted = resolve; });
    let sawContextFirst = false;
    const router = {
      findRelevantTools: async () => {
        // Finishes only once the context lookup has begun, or gives up after 300 ms.
        sawContextFirst = await Promise.race([started.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 300))]);
        return { status: 'routed', tools: [] };
      },
    };
    const contextProvider = { getContext: async () => { contextStarted(); return 'Knowledge: hours are 9 to 5.'; } };
    const { agent, prompts } = makeAgent(router, contextProvider);

    await agent.runOnce(ask);

    expect(sawContextFirst).toBe(true);
    const system = prompts[0].find((message: any) => message.role === 'system').content;
    expect(system).toContain('Knowledge: hours are 9 to 5.');
    expect(system).toContain('base');
  });

  test('a routing failure does not leave a context rejection unhandled', async () => {
    const router = { findRelevantTools: async () => { throw new Error('router down'); } };
    const contextProvider = { getContext: async () => { throw new Error('search down'); } };
    const { agent } = makeAgent(router, contextProvider);

    await expect(agent.runOnce(ask)).rejects.toThrow('router down');
  });
});
