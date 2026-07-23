import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER } from 'najm-mcp';
import { ChatAgent } from '../../src/agent/ChatAgent';

describe('ChatAgent routing integration', () => {
  function makeAgent(overrides: {
    routerResult?: { status: string; tools: any[]; error?: string };
    registryTools?: any[];
    chatLogging?: boolean;
  } = {}) {
    const settingsService = {
      getInternal: mock(() =>
        Promise.resolve({
          isEnabled: true,
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-test',
          systemPrompt: 'You are a test assistant.',
        }),
      ),
    } as any;

    const router = {
      findRelevantTools: mock(() =>
        Promise.resolve(
          overrides.routerResult ?? { status: 'routed', tools: [] },
        ),
      ),
    } as any;

    const registry = {
      tools: overrides.registryTools ?? [],
    } as any;

    const builder = {
      invokeTool: mock(() => Promise.resolve({ content: [{ text: 'ok' }] })),
    } as any;

    const chatLogRepository = {
      insert: mock(() => Promise.resolve()),
    } as any;

    const config = {
      toolRouting: { enabled: true },
      chatLogging: { enabled: overrides.chatLogging ?? false },
      maxSteps: 10,
      conversationStore: 'cache',
    } as any;

    const agent = new ChatAgent(
      settingsService,
      { load: mock(() => Promise.resolve([])), save: mock(() => Promise.resolve()) } as any,
      { load: mock(() => Promise.resolve([])), save: mock(() => Promise.resolve()) } as any,
      config,
      chatLogRepository,
    );
    (agent as any).container = {
      get: (token: any) => {
        if (token.name === 'McpRegistryService') return registry;
        if (token.name === 'McpBuilderService') return builder;
        if (token.name === 'ToolRouterService') return router;
        if (token === TOOL_PROVIDER) return router;
        throw new Error(`Unknown token: ${token.name ?? String(token)}`);
      },
    };

    return { agent, router, chatLogRepository, builder };
  }

  test('prepare passes empty tool map when router returns fallback_none', async () => {
    const { agent, router } = makeAgent({
      routerResult: { status: 'fallback_none', tools: [] },
    });

    const prepared = await (agent as any).prepare('web', 'hello', {
      isEnabled: true,
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      systemPrompt: 'You are a test assistant.',
    });

    expect(prepared.tools).toEqual({});
    expect(prepared.routingStatus).toBe('fallback_none');
    expect(prepared.routedToolNames).toEqual([]);
    expect(router.findRelevantTools).toHaveBeenCalledTimes(1);
  });

  test('prepare passes all registry tools when router returns fallback_all', async () => {
    const registryTools = [{ name: 'tool_a' }, { name: 'tool_b' }];
    const { agent, router } = makeAgent({
      routerResult: { status: 'fallback_all', tools: registryTools },
      registryTools,
    });

    const prepared = await (agent as any).prepare('web', 'hello', {
      isEnabled: true,
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      systemPrompt: 'You are a test assistant.',
    });

    expect(prepared.routingStatus).toBe('fallback_all');
    expect(Object.keys(prepared.tools)).toContain('tool_a');
    expect(Object.keys(prepared.tools)).toContain('tool_b');
  });

  test('prepare sets routed status and tool names when routing succeeds', async () => {
    const registryTools = [{ name: 'tool_a', description: 'Tool A', validationArgs: [] }];
    const { agent } = makeAgent({
      routerResult: { status: 'routed', tools: registryTools },
      registryTools,
    });

    const prepared = await (agent as any).prepare('web', 'hello', {
      isEnabled: true,
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      systemPrompt: 'You are a test assistant.',
    });

    expect(prepared.routingStatus).toBe('routed');
    expect(prepared.routedToolNames).toEqual(['tool_a']);
    expect(Object.keys(prepared.tools)).toContain('tool_a');
  });

  test('logs router_error status distinctly from routed', async () => {
    const { agent, chatLogRepository } = makeAgent({
      routerResult: { status: 'router_error', tools: [], error: 'ollama down' },
      chatLogging: true,
    });

    await (agent as any).logChat('sess_123', 'hello', 'router_error', [], []);

    expect(chatLogRepository.insert).toHaveBeenCalledTimes(1);
    const logged = chatLogRepository.insert.mock.calls[0][0];
    expect(logged.routingStatus).toBe('router_error');
    expect(logged.sessionKey).toBe('sess_123');
  });

  test('logs sessionKey when provided', async () => {
    const { agent, chatLogRepository } = makeAgent({
      routerResult: { status: 'routed', tools: [{ name: 'tool_a' }] },
      registryTools: [{ name: 'tool_a', description: 'Tool A', validationArgs: [] }],
      chatLogging: true,
    });

    await (agent as any).logChat('session_abc', 'hello', 'routed', ['tool_a'], [
      { toolCalls: [{ toolName: 'tool_a', args: {} }] },
    ]);

    expect(chatLogRepository.insert).toHaveBeenCalledTimes(1);
    const logged = chatLogRepository.insert.mock.calls[0][0];
    expect(logged.sessionKey).toBe('session_abc');
    expect(logged.routingStatus).toBe('routed');
    expect(logged.routedTools).toContain('tool_a');
    expect(logged.actualToolNames).toContain('tool_a');
  });
});
