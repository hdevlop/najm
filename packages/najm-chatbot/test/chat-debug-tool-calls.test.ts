import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

const TOOLS = [
  { name: 'search', description: 'Search' },
  { name: 'failing', description: 'Fails' },
  { name: 'delete_order', description: 'Delete an order', confirmation: { level: 'danger', message: 'Delete?' } },
];

function makeAgent(results: Record<string, { content: Array<{ type: 'text'; text: string }>; isError?: boolean }>) {
  const store = {
    load: async () => null,
    loadSession: async () => null,
    save: async () => {},
    clear: async () => {},
  } as any;
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test', systemPrompt: 'x' }) } as any,
    store,
    store,
    { toolRouting: { enabled: true }, chatLogging: { enabled: false }, maxSteps: 10, conversationStore: 'db' } as any,
    { insert: mock(() => Promise.resolve()) } as any,
  );
  const builder = { invokeTool: mock((name: string) => Promise.resolve(results[name])) };
  (agent as any).container = {
    get: (token: any) => {
      if (token === McpRegistryService) return { tools: TOOLS };
      if (token === McpBuilderService) return builder;
      if (token === TOOL_PROVIDER) return { findRelevantTools: async () => ({ status: 'routed', tools: TOOLS }) };
      throw new Error('unknown token');
    },
  };
  return { agent, builder };
}

function callsThenAnswer(calls: Array<{ toolCallId: string; toolName: string; args: string }>) {
  let step = 0;
  return new MockLanguageModelV1({
    doGenerate: async () => (++step === 1
      ? { toolCalls: calls, finishReason: 'tool-calls', usage: {} }
      : { text: 'answer', finishReason: 'stop', usage: {} }),
  });
}

const ask = { messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'go' }] } as any] };

describe('C4: debugRun reports each tool call from the real run', () => {
  test('a normal call shows its arguments and result', async () => {
    const { agent } = makeAgent({ search: { content: [{ type: 'text', text: '{"products":["Nike","Adidas"]}' }] } });
    (agent as any).buildModel = () => callsThenAnswer([{ toolCallId: 'c1', toolName: 'search', args: '{"q":"shoes"}' }]);

    const result: any = await agent.debugRun(ask);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({ toolName: 'search', args: { q: 'shoes' }, status: 'success' });
    expect(JSON.stringify(result.toolCalls[0].resultPreview)).toContain('Nike');
  });

  test('a tool that returns an MCP error is reported as error with its message', async () => {
    const { agent } = makeAgent({ failing: { content: [{ type: 'text', text: 'Access denied' }], isError: true } });
    (agent as any).buildModel = () => callsThenAnswer([{ toolCallId: 'c1', toolName: 'failing', args: '{}' }]);

    const result: any = await agent.debugRun(ask);

    expect(result.toolCalls[0].status).toBe('error');
    expect(result.toolCalls[0].error).toBe('Access denied');
  });

  test('a tool that needs confirmation is reported as blocked and never runs', async () => {
    const { agent, builder } = makeAgent({});
    (agent as any).buildModel = () => callsThenAnswer([{ toolCallId: 'c1', toolName: 'delete_order', args: '{"id":"o1"}' }]);

    const result: any = await agent.debugRun(ask);

    expect(result.toolCalls[0].status).toBe('blocked');
    expect(builder.invokeTool).not.toHaveBeenCalled();
    expect(result.warnings.map((warning: any) => warning.code)).toContain('MUTATING_TOOL_BLOCKED');
  });

  test('calls across steps keep their order', async () => {
    const { agent } = makeAgent({
      search: { content: [{ type: 'text', text: '"first"' }] },
      failing: { content: [{ type: 'text', text: 'no' }], isError: true },
    });
    (agent as any).buildModel = () => callsThenAnswer([
      { toolCallId: 'c1', toolName: 'search', args: '{}' },
      { toolCallId: 'c2', toolName: 'failing', args: '{}' },
    ]);

    const result: any = await agent.debugRun(ask);

    expect(result.toolCalls.map((call: any) => [call.toolName, call.status])).toEqual([['search', 'success'], ['failing', 'error']]);
  });
});
