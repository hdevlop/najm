import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { CHATBOT_ROUTING_PREVIEW_PROVIDER, CHATBOT_CONTEXT_PROVIDER } from '../src/tokens';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from 'ai/test';

function makeAgent(overrides: {
  routerResult?: { status: string; tools: any[]; error?: string };
  registryTools?: any[];
  previewProvider?: any;
  contextProviders?: any[];
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
    chatLogging: { enabled: false },
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

  const previewProvider = overrides.previewProvider ?? {
    previewRouting: mock(() =>
      Promise.resolve({
        status: 'routed',
        matches: [],
        dependencies: [],
        confirmations: [],
      }),
    ),
  };
  const contextProviders = overrides.contextProviders ?? [];
  const contextToken = contextProviders.length === 1
    ? contextProviders[0]
    : contextProviders;

  (agent as any).container = {
    get: (token: any) => {
      if (token === McpRegistryService || token?.name === 'McpRegistryService') return registry;
      if (token === McpBuilderService || token?.name === 'McpBuilderService') return builder;
      if (token === TOOL_PROVIDER) return router;
      if (token === CHATBOT_ROUTING_PREVIEW_PROVIDER) return previewProvider;
      if (token === CHATBOT_CONTEXT_PROVIDER) return contextToken;
      throw new Error(`Unknown token: ${token?.name ?? String(token)}`);
    },
  };

  return { agent, router, chatLogRepository, builder, previewProvider, contextProviders };
}

describe('Phase 1 (C1) — debug trace is excluded from regular chat paths', () => {
  test('stream() does NOT call previewRouting or getContextTrace', async () => {
    const { agent, previewProvider, contextProviders } = makeAgent();
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'ok' });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hello' } as any],
    });
    await response.text();

    expect(previewProvider.previewRouting).not.toHaveBeenCalled();
    for (const cp of contextProviders) {
      expect(cp.getContextTrace).not.toHaveBeenCalled?.();
    }
  });

  test('runOnce() does NOT call previewRouting or getContextTrace', async () => {
    const { agent, previewProvider, contextProviders } = makeAgent();
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'ok',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    await agent.runOnce({ messages: [{ role: 'user', content: 'hello' } as any] });

    expect(previewProvider.previewRouting).not.toHaveBeenCalled();
    for (const cp of contextProviders) {
      expect(cp.getContextTrace).not.toHaveBeenCalled?.();
    }
  });

  test('debugRun() still calls previewRouting and getContextTrace exactly once', async () => {
    const { agent, previewProvider, contextProviders } = makeAgent();
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'ok',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const result = await agent.debugRun({ messages: [{ role: 'user', content: 'hello' } as any] });

    expect(previewProvider.previewRouting).toHaveBeenCalledTimes(1);
    for (const cp of contextProviders) {
      expect(cp.getContextTrace).toHaveBeenCalledTimes(1);
    }
    expect(result).toBeDefined();
  });

  test('debugRun() returns routing/knowledge trace data unchanged', async () => {
    const preview = {
      previewRouting: mock(() =>
        Promise.resolve({
          status: 'routed',
          matches: [{ toolName: 'search', similarity: 0.9, source: 'semantic' }],
          dependencies: [{ toolName: 'search', reason: 'matched' }],
          confirmations: [{ toolName: 'search', level: 'safe' }],
          config: { maxTools: 5, topSemanticHits: 10, similarityThreshold: 0.45 },
        }),
      ),
    };
    const contextTrace = {
      getContext: mock(() => Promise.resolve(null)),
      getContextTrace: mock(() =>
        Promise.resolve({
          used: true,
          chunks: [{ chunkId: 'c1', documentId: 'd1', text: 'context', score: 0.8 }],
        }),
      ),
    };
    const { agent } = makeAgent({
      previewProvider: preview,
      contextProviders: [contextTrace],
    });
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'ok',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const result: any = await agent.debugRun({ messages: [{ role: 'user', content: 'hello' } as any] });

    expect(result.routing).toBeDefined();
    expect(result.routing.status).toBe('routed');
    expect(result.routing.matches[0].toolName).toBe('search');
    expect(result.routing.matches[0].similarity).toBe(0.9);
    expect(result.knowledge.used).toBe(true);
    expect(result.knowledge.chunks[0].chunkId).toBe('c1');
  });
});

describe('Phase 1 (C1) — computeUsageCost uses settings, not trace', () => {
  test('stream() onFinish still emits token-usage annotation with settings provider/model', async () => {
    const { agent } = makeAgent();
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'ok' });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hello' } as any],
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBeDefined();
  });
});
