import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { CORRELATION_ID } from 'najm-core';
import { TOOL_PROVIDER, McpRegistryService, McpBuilderService } from 'najm-mcp';
import { EmbeddingService, EmbeddingValidator, RagDiagnosticsService } from 'najm-rag';
import { ChatAgent } from '../../src/agent/ChatAgent';
import { ChatDiagnosticsRecorder, type ChatDiagnostics } from '../../src/agent/ChatDiagnostics';
import { CHATBOT_CONTEXT_PROVIDER } from '../../src/tokens';
import { MockLanguageModelV1 } from '../../src/testing/MockLanguageModel';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function makeAgent(id: string, embedding: EmbeddingService, events: ChatDiagnostics[], bridge = true, contextFailure = false) {
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', model: 'test', useMemory: false }) } as any,
    {} as any, {} as any,
    { chatLogging: { enabled: false, onDiagnostics: (event: ChatDiagnostics) => { events.push(event); } } } as any,
    {} as any,
  );
  const runner = new RagDiagnosticsService();
  (agent as any).container = { get(token: any) {
    if (token === CORRELATION_ID) return id;
    if (token === Symbol.for('najm:rag:diagnostics') && bridge) return runner;
    if (token === TOOL_PROVIDER) return { findRelevantTools: async (text: string) => {
      await embedding.embed(text, 'query', 'tool-routing');
      return { status: 'routed', tools: [] };
    } };
    if (token === CHATBOT_CONTEXT_PROVIDER) return { getContext: async (text: string) => {
      await embedding.embed(text, 'query', 'knowledge-search');
      if (contextFailure) throw new Error('context failure');
      return null;
    } };
    throw new Error('not registered');
  } };
  (agent as any).buildModel = () => new MockLanguageModelV1({
    doGenerate: async () => ({ text: 'answer', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 }, rawCall: { rawPrompt: null, rawSettings: {} } }),
    doStream: async () => ({ stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: 'text-delta', textDelta: 'answer' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } });
      controller.close();
    } }), rawCall: { rawPrompt: null, rawSettings: {} } }),
  });
  return agent;
}
const embedder = () => new EmbeddingService({ rag: { embedding: { model: 'test', dimensions: 2 } } } as any, new EmbeddingValidator());
const input = (text: string) => ({ messages: [{ role: 'user', content: text } as any] });
const success = () => { globalThis.fetch = (async () => new Response(JSON.stringify({ embeddings: [[0.1, 0.2]] }))) as any; };

describe('embedding spans in chat diagnostics', () => {
  test.each(['stream', 'runOnce'] as const)('captures embeddings from a tool during %s without losing preparation spans', async mode => {
    success();
    const events: ChatDiagnostics[] = [];
    const embedding = embedder();
    const agent = makeAgent('tool-id', embedding, events);
    const previousGet = (agent as any).container.get;
    (agent as any).container.get = (token: any) => {
      if (token === McpRegistryService) return { tools: [{ name: 'lookup', description: 'Lookup' }] };
      if (token === McpBuilderService) return { invokeTool: async () => {
        await embedding.embed('tool detail', 'query', 'knowledge-search');
        return { content: [{ text: 'result' }] };
      } };
      return previousGet(token);
    };
    (agent as any).config.tools = 'all';
    let step = 0;
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ++step === 1
        ? { toolCalls: [{ toolCallId: 'call', toolName: 'lookup', args: '{}' }], finishReason: 'tool-calls' }
        : { text: 'answer', finishReason: 'stop' },
      doStream: async () => ({ stream: new ReadableStream({ start(controller) {
        if (++step === 1) {
          controller.enqueue({ type: 'tool-call', toolCallId: 'call', toolName: 'lookup', args: '{}' });
          controller.enqueue({ type: 'finish', finishReason: 'tool-calls' });
        } else {
          controller.enqueue({ type: 'text-delta', textDelta: 'answer' });
          controller.enqueue({ type: 'finish', finishReason: 'stop' });
        }
        controller.close();
      } }), rawCall: { rawPrompt: null, rawSettings: {} } }),
    });
    const result = mode === 'stream'
      ? await (await agent.stream(input('preparation query'))).text()
      : await agent.runOnce(input('preparation query'));
    expect(result).toContain('answer');
    for (let n = 0; !events.length && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
    expect(events[0]!.embeddings).toHaveLength(2);
    expect(events[0]!.embeddings!.every(e => e.correlationId === 'tool-id')).toBe(true);
    expect(events[0]!.tools[0]!.outcome).toBe('executed');
    // Both scope conversion and tool offsets round to tenths of a millisecond.
    expect(events[0]!.embeddings![1]!.startMs + 0.2).toBeGreaterThanOrEqual(events[0]!.tools[0]!.startMs);
  });

  test('abort marks unfinished capture as partial and late completions cannot mutate the terminal record', async () => {
    let finish!: (response: Response) => void;
    globalThis.fetch = (() => new Promise<Response>(resolve => { finish = resolve; })) as any;
    const recorder = new ChatDiagnosticsRecorder({ channel: 'web', correlationId: 'aborted' });
    const pending = recorder.rag(new RagDiagnosticsService(), () => embedder().embed('pending'));
    recorder.settle('aborted');
    const snapshot = JSON.stringify(recorder.data);
    expect(recorder.data.embeddingsIncomplete).toBe(true);
    finish(new Response(JSON.stringify({ embeddings: [[0.1, 0.2]] })));
    await pending;
    recorder.textDelta('late text');
    recorder.step({ finishReason: 'stop', toolCalls: [{ toolName: 'late' }] });
    recorder.tool({ name: 'late', toolCallId: null, outcome: 'executed', inputChars: 0,
      resultChars: 0, start: performance.now(), end: performance.now() });
    expect(JSON.stringify(recorder.data)).toBe(snapshot);
  });

  test('available capture with no calls is an explicit empty array', async () => {
    globalThis.fetch = (async () => { throw new Error('no embedding expected'); }) as any;
    const events: ChatDiagnostics[] = [];
    const agent = makeAgent('empty', embedder(), events);
    (agent as any).config.tools = 'none';
    (agent as any).config.context = 'none';
    expect(await agent.runOnce(input('q'))).toBe('answer');
    expect(events[0]!.embeddings).toEqual([]);
  });

  test('runOnce records shared-cache miss/hit with chat-relative offsets and no input text', async () => {
    success();
    const events: ChatDiagnostics[] = [];
    const agent = makeAgent('chat-id', embedder(), events);
    expect(await agent.runOnce(input('private query'))).toBe('answer');
    expect(events).toHaveLength(1);
    expect(events[0]!.embeddings!.map(e => [e.correlationId, e.operation, e.cache, e.attempts.length]))
      .toEqual([['chat-id', 'tool-routing', 'miss', 1], ['chat-id', 'knowledge-search', 'hit', 0]]);
    for (const event of events[0]!.embeddings!) {
      expect(event.startMs).toBeGreaterThanOrEqual(0);
      expect(event.startMs + event.durationMs).toBeLessThanOrEqual(events[0]!.marks.finishMs! + 1);
      for (const attempt of event.attempts) expect(attempt.startMs).toBeGreaterThanOrEqual(event.startMs);
    }
    expect(JSON.stringify(events)).not.toContain('private query');
  });

  test('stream includes spans without consuming the stream twice', async () => {
    success();
    const events: ChatDiagnostics[] = [];
    const response = await makeAgent('stream-id', embedder(), events).stream(input('q'));
    expect(await response.text()).toContain('answer');
    for (let n = 0; !events.length && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 5));
    expect(events).toHaveLength(1);
    expect(events[0]!.embeddings).toHaveLength(2);
    expect(events[0]!.embeddings![0]!.correlationId).toBe('stream-id');
  });

  test('concurrent chats retain their own correlation and operations', async () => {
    globalThis.fetch = (async () => {
      await new Promise(resolve => setTimeout(resolve, 3));
      return new Response(JSON.stringify({ embeddings: [[0.1, 0.2]] }));
    }) as any;
    const events: ChatDiagnostics[] = [];
    const embedding = embedder();
    await Promise.all(['a', 'b'].map(id => makeAgent(id, embedding, events).runOnce(input(id))));
    expect(events).toHaveLength(2);
    for (const chat of events) {
      expect(chat.embeddings).toHaveLength(2);
      expect(chat.embeddings!.every(event => event.correlationId === chat.correlationId)).toBe(true);
    }
  });

  test('setup failure preserves completed embeddings and the terminal outcome', async () => {
    success();
    const events: ChatDiagnostics[] = [];
    await expect(makeAgent('failed', embedder(), events, true, true).runOnce(input('q'))).rejects.toThrow('context failure');
    expect(events).toHaveLength(1);
    expect(events[0]!.outcome).toBe('setup_error');
    expect(events[0]!.embeddings).toHaveLength(2);
  });

  test('embedding failure remains visible when preparation throws', async () => {
    globalThis.fetch = (async () => new Response('private error body', { status: 500 })) as any;
    const events: ChatDiagnostics[] = [];
    await expect(makeAgent('embedding-failed', embedder(), events).runOnce(input('q'))).rejects.toThrow('500');
    expect(events[0]!.embeddings![0]).toMatchObject({ outcome: 'error', cache: 'miss' });
    expect(events[0]!.embeddings![0]!.attempts).toHaveLength(1);
    expect(JSON.stringify(events[0]!.embeddings)).not.toContain('private error body');
  });

  test('unavailable bridge keeps old behavior and leaves capture explicitly unknown', async () => {
    success();
    const events: ChatDiagnostics[] = [];
    expect(await makeAgent('old-rag', embedder(), events, false).runOnce(input('q'))).toBe('answer');
    expect(events[0]!.embeddings).toBeUndefined();
  });
});
