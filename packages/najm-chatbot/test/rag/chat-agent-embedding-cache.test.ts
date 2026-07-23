import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { CHATBOT_CONTEXT_PROVIDER, CHATBOT_ROUTING_PREVIEW_PROVIDER } from '../../src/tokens';
import { ChatAgent } from '../../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../../src/testing/MockLanguageModel';

/**
 * Phase 5 (C6) — chatbot-side acceptance harness ONLY.
 *
 * IMPORTANT: C6 implementation is owned by `RAG_REVIEW_PLAN.md` Phase 5 / P1
 * ("Move query-embedding LRU into EmbeddingService" + "Delete private router/preview
 *  LRUs after shared-cache tests pass"). The chatbot package does not implement
 *  a shared cache and the cross-package work is intentionally deferred to the RAG plan.
 *
 *  This file only asserts the chatbot-side conditions the RAG P1 work will rely on:
 *    - Regular `stream()` and `runOnce()` paths make exactly one routing call
 *      (`router.findRelevantTools`) and one context call (`contextProvider.getContext`)
 *      per message. They must NOT call `previewRouting` or `getContextTrace` on the
 *      regular path.
 *    - `debugRun()` may call `getContextTrace` to populate trace detail, while
 *      `findRelevantTools` is still invoked exactly once by the chatbot.
 *    - The chatbot has no local query-embedding cache, so once RAG P1 lands there is
 *      no second cache to evict or coordinate.
 *
 *  The actual cache dedup behavior is asserted by najm-rag's own tests; this file
 *  does not mock `EmbeddingService` because doing so would only verify the mock.
 */

function makeAgent(overrides: {
  routerResult?: { status: string; tools: any[]; error?: string };
  contextChunks?: Array<{ chunkId: string; documentId: string; text: string; score: number; source?: string | null }>;
  contextTrace?: { used: boolean; chunks: any[] };
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

  const findCalls: string[] = [];
  const router = {
    findRelevantTools: mock((text: string) => {
      findCalls.push(text);
      return Promise.resolve(overrides.routerResult ?? { status: 'routed', tools: [] });
    }),
  } as any;

  const registry = { tools: [] } as any;
  const builder = { invokeTool: mock(() => Promise.resolve({ content: [{ text: 'ok' }] })) } as any;

  const chatLogRepository = { insert: mock(() => Promise.resolve()) } as any;
  const config = {
    toolRouting: { enabled: true },
    chatLogging: { enabled: false },
    maxSteps: 10,
    conversationStore: 'cache',
  } as any;

  const contextChunks = overrides.contextChunks ?? [];
  const contextTrace = overrides.contextTrace ?? { used: true, chunks: contextChunks };
  const contextCalls: string[] = [];
  const contextProvider: any = {
    getContext: mock((text: string) => {
      contextCalls.push(text);
      return Promise.resolve(null);
    }),
    getContextTrace: mock((text: string) => {
      contextCalls.push(`trace:${text}`);
      return Promise.resolve(contextTrace);
    }),
  };

  const agent = new ChatAgent(
    settingsService,
    { load: mock(() => Promise.resolve([])), save: mock(() => Promise.resolve()) } as any,
    { load: mock(() => Promise.resolve([])), save: mock(() => Promise.resolve()) } as any,
    config,
    chatLogRepository,
  );

  (agent as any).container = {
    get: (token: any) => {
      if (token === McpRegistryService || token?.name === 'McpRegistryService') return registry;
      if (token === McpBuilderService || token?.name === 'McpBuilderService') return builder;
      if (token === TOOL_PROVIDER) return router;
      if (token === CHATBOT_CONTEXT_PROVIDER) return contextProvider;
      if (token === CHATBOT_ROUTING_PREVIEW_PROVIDER) return null;
      throw new Error(`Unknown token: ${token?.name ?? String(token)}`);
    },
  };

  return { agent, findCalls, contextCalls, router, contextProvider };
}

function scriptedModel(text: string) {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-delta', textDelta: text });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => ({
      text,
      finishReason: 'stop' as const,
      usage: { promptTokens: 1, completionTokens: 1 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('Phase 5 (C6) — chatbot-side acceptance criteria for shared query-embedding cache', () => {
  test('regular stream() issues exactly one router.findRelevantTools() per message', async () => {
    const { agent, findCalls } = makeAgent();
    (agent as any).buildModel = () => scriptedModel('hello');

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'find me shoes' } as any],
    });
    await response.text();
    expect(findCalls).toEqual(['find me shoes']);
  });

  test('regular runOnce() issues exactly one router.findRelevantTools() per message', async () => {
    const { agent, findCalls } = makeAgent();
    (agent as any).buildModel = () => scriptedModel('hello');

    await agent.runOnce({ messages: [{ role: 'user', content: 'find me shoes' } as any] });
    expect(findCalls).toEqual(['find me shoes']);
  });

  test('regular runOnce() does not call context.getContextTrace() — only getContext()', async () => {
    const { agent, contextCalls } = makeAgent();
    (agent as any).buildModel = () => scriptedModel('hello');

    await agent.runOnce({ messages: [{ role: 'user', content: 'q' } as any] });
    expect(contextCalls).toEqual(['q']);
    expect(contextCalls.some((c) => c.startsWith('trace:'))).toBe(false);
  });

  test('debugRun() may call context.getContextTrace() while routing exactly once', async () => {
    const { agent, findCalls, contextCalls } = makeAgent({
      contextChunks: [{ chunkId: 'c1', documentId: 'd1', text: 'ctx', score: 0.8 }],
      contextTrace: { used: true, chunks: [{ chunkId: 'c1', documentId: 'd1', text: 'ctx', score: 0.8, source: null }] },
    });
    (agent as any).buildModel = () => scriptedModel('hello');

    await agent.debugRun({ messages: [{ role: 'user', content: 'q' } as any] });
    expect(findCalls).toEqual(['q']);
    expect(contextCalls).toContain('q');
    expect(contextCalls).toContain('trace:q');
  });

  test('chatbot has no local query-embedding cache to evict', () => {
    const { agent } = makeAgent();
    const internalKeys = Object.keys(agent as any).filter((k) => /embedding|querycache|queryCache/i.test(k));
    expect(internalKeys).toEqual([]);
  });
});
