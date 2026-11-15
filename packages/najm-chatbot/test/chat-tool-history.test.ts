import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

const TOOL = { name: 'count_orders', description: 'Count orders' };

function makeAgent(config: Record<string, unknown> = {}, toolText = '{"count":3}') {
  const sessions = new Map<string, any[]>();
  const store = {
    load: async (key: string) => sessions.get(key) ?? null,
    loadSession: async (key: string) => {
      const messages = sessions.get(key);
      return messages ? { messages, userId: null } : null;
    },
    save: async (key: string, messages: any[]) => { sessions.set(key, JSON.parse(JSON.stringify(messages))); },
    clear: async (key: string) => { sessions.delete(key); },
  } as any;
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test', systemPrompt: 'x' }) } as any,
    store,
    store,
    { toolRouting: { enabled: true }, chatLogging: { enabled: false }, maxSteps: 10, conversationStore: 'db', ...config } as any,
    { insert: mock(() => Promise.resolve()) } as any,
  );
  const registry = { tools: [TOOL] };
  const builder = { invokeTool: mock(() => Promise.resolve({ content: [{ type: 'text', text: toolText }] })) };
  const router = { findRelevantTools: async () => ({ status: 'routed', tools: [TOOL] }) };
  (agent as any).container = {
    get: (token: any) => {
      if (token === McpRegistryService) return registry;
      if (token === McpBuilderService) return builder;
      if (token === TOOL_PROVIDER) return router;
      throw new Error('unknown token');
    },
  };
  return { agent, sessions };
}

function userMessage(id: string, text: string) {
  return { id, role: 'user', parts: [{ type: 'text', text }] } as any;
}

/** First call asks for the tool, later calls answer with text. Records each provider prompt. */
function toolThenTextGenerate(prompts: any[]) {
  let call = 0;
  return new MockLanguageModelV1({
    doGenerate: async (options: any) => {
      prompts.push(options.prompt);
      call += 1;
      return call === 1
        ? { toolCalls: [{ toolCallId: 'call-1', toolName: 'count_orders', args: '{}' }], finishReason: 'tool-calls', usage: {} }
        : { text: 'There are 3 orders.', finishReason: 'stop', usage: {} };
    },
  });
}

function textGenerate(prompts: any[], text = 'fine') {
  return new MockLanguageModelV1({
    doGenerate: async (options: any) => {
      prompts.push(options.prompt);
      return { text, finishReason: 'stop', usage: {} };
    },
  });
}

function streamOf(chunks: any[]) {
  return {
    stream: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  };
}

function toolThenTextStream(prompts: any[]) {
  let call = 0;
  return new MockLanguageModelV1({
    doStream: async (options: any) => {
      prompts.push(options.prompt);
      call += 1;
      return call === 1
        ? streamOf([
          { type: 'tool-call', toolCallType: 'function', toolCallId: 'call-1', toolName: 'count_orders', args: '{}' },
          { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 1, completionTokens: 1 } },
        ])
        : streamOf([
          { type: 'text-delta', textDelta: 'There are 3 orders.' },
          { type: 'finish', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } },
        ]);
    },
  });
}

function promptHasToolResult(prompt: any[], value: string): boolean {
  return prompt.some((message) => message.role === 'tool'
    && message.content.some((part: any) => part.type === 'tool-result' && JSON.stringify(part.output).includes(value)));
}

describe('C1: stored tool calls keep their results', () => {
  test('runOnce: the turn after a tool call succeeds and the model sees the earlier result', async () => {
    const { agent } = makeAgent();
    const prompts: any[] = [];
    (agent as any).buildModel = () => toolThenTextGenerate(prompts);
    await agent.runOnce({ sessionKey: 's1', messages: [userMessage('u1', 'how many orders?')] });

    const second: any[] = [];
    (agent as any).buildModel = () => textGenerate(second);
    const answer = await agent.runOnce({ sessionKey: 's1', messages: [userMessage('u2', 'and yesterday?')] });

    expect(answer).toBe('fine');
    expect(promptHasToolResult(second[0], 'count')).toBe(true);
  });

  test('stream: the turn after a streamed tool call succeeds', async () => {
    const { agent, sessions } = makeAgent();
    const prompts: any[] = [];
    (agent as any).buildModel = () => toolThenTextStream(prompts);
    const response = await agent.stream({ sessionKey: 's2', messages: [userMessage('u1', 'how many orders?')] });
    await response.text();
    // onFinish persists after the body is drained.
    for (let i = 0; i < 50 && !sessions.get('s2'); i++) await new Promise((resolve) => setTimeout(resolve, 10));

    const second: any[] = [];
    (agent as any).buildModel = () => textGenerate(second);
    const answer = await agent.runOnce({ sessionKey: 's2', messages: [userMessage('u2', 'and yesterday?')] });

    expect(answer).toBe('fine');
    expect(promptHasToolResult(second[0], 'count')).toBe(true);
  });

  test('a session saved in the old shape (tool call without output) still answers', async () => {
    const { agent, sessions } = makeAgent();
    sessions.set('old', [
      userMessage('u1', 'how many orders?'),
      { id: 'a1', role: 'assistant', parts: [{ type: 'tool-count_orders', toolCallId: 'call-1', state: 'input-available', input: {} }] },
      { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'There are 3 orders.' }] },
    ]);
    const prompts: any[] = [];
    (agent as any).buildModel = () => textGenerate(prompts);

    const answer = await agent.runOnce({ sessionKey: 'old', messages: [userMessage('u2', 'and yesterday?')] });

    expect(answer).toBe('fine');
  });

  test('a tool output longer than the cap is stored truncated', async () => {
    const { agent, sessions } = makeAgent({ maxStoredToolResultChars: 100 }, 'x'.repeat(5000));
    (agent as any).buildModel = () => toolThenTextGenerate([]);
    await agent.runOnce({ sessionKey: 's3', messages: [userMessage('u1', 'how many orders?')] });

    const toolPart = sessions.get('s3')!.flatMap((message: any) => message.parts).find((part: any) => part.type === 'tool-count_orders');
    expect(toolPart.state).toBe('output-available');
    expect(String(toolPart.output).length).toBeLessThan(200);
    expect(String(toolPart.output)).toContain('truncated');
  });
});
