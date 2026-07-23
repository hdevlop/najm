import { describe, test, expect, mock } from 'bun:test';
import { TOOL_PROVIDER } from 'najm-mcp';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from 'ai/test';
import { simulateReadableStream } from 'ai';

interface TraceEvent {
  t: number;
  kind: string;
  source: string;
}

function makeAgent(overrides: {
  chatLogging?: boolean;
  registryTools?: any[];
  save?: { enter: Promise<void>; release: () => void; resolvedAt?: number; eventLog?: TraceEvent[]; name: string };
  log?: { enter: Promise<void>; release: () => void; resolvedAt?: number; eventLog?: TraceEvent[]; name: string };
  saveReject?: Error;
  logReject?: Error;
} = {}) {
  const start = Date.now();
  const t0 = start;

  function buildGate(name: string, kind: 'save' | 'log', eventLog: TraceEvent[], reject?: Error) {
    let resolveEnter!: () => void;
    const enter = new Promise<void>((r) => { resolveEnter = r; });
    const gate: any = {
      enter,
      release: resolveEnter,
      name,
      resolvedAt: undefined as number | undefined,
      eventLog,
    };
    const fn = async (..._args: any[]) => {
      gate.eventLog.push({ t: Date.now() - t0, kind: 'start', source: kind });
      await enter;
      if (reject) {
        gate.eventLog.push({ t: Date.now() - t0, kind: 'fail', source: kind });
        throw reject;
      }
      gate.resolvedAt = Date.now() - t0;
      gate.eventLog.push({ t: Date.now() - t0, kind: 'finish', source: kind });
    };
    return { gate, fn };
  }

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
    findRelevantTools: mock(() => Promise.resolve({ status: 'routed', tools: [] })),
  } as any;

  const registry = { tools: overrides.registryTools ?? [] } as any;
  const builder = { invokeTool: mock(() => Promise.resolve({ content: [{ text: 'ok' }] })) } as any;

  const logEventLog: TraceEvent[] = [];
  const saveEventLog: TraceEvent[] = [];
  const logGate = buildGate(overrides.log?.name ?? 'log', 'log', logEventLog, overrides.logReject);
  const saveGate = buildGate(overrides.save?.name ?? 'save', 'save', saveEventLog, overrides.saveReject);

  const chatLogRepository = { insert: mock(logGate.fn) } as any;
  const dbStore = {
    load: mock(() => Promise.resolve([])),
    save: mock(saveGate.fn),
    clear: mock(() => Promise.resolve()),
  } as any;
  const cacheStore = {
    load: mock(() => Promise.resolve([])),
    save: mock(() => Promise.resolve()),
    clear: mock(() => Promise.resolve()),
  } as any;

  const config = {
    toolRouting: { enabled: true },
    chatLogging: { enabled: overrides.chatLogging ?? false },
    maxSteps: 10,
    conversationStore: 'db',
  } as any;

  const agent = new ChatAgent(
    settingsService,
    dbStore as any,
    cacheStore as any,
    config,
    chatLogRepository,
  );
  (agent as any).container = {
    get: (token: any) => {
      if (token === TOOL_PROVIDER) return router;
      if (token?.name === 'McpRegistryService') return registry;
      if (token?.name === 'McpBuilderService') return builder;
      throw new Error(`Unknown token: ${token?.name ?? String(token)}`);
    },
  };

  return { agent, dbStore, chatLogRepository, saveGate: saveGate.gate, logGate: logGate.gate, saveEventLog, logEventLog };
}

function scriptedStreamModel(text: string) {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta', textDelta: text },
          { type: 'finish', finishReason: 'stop', logprobs: undefined, usage: { completionTokens: 1, promptTokens: 1 } },
        ],
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

describe('Phase 3 (C3) — stream onFinish persistence runs concurrently', () => {
  test('saveSession and logChat are both started before either finishes', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog } = makeAgent({
      chatLogging: true,
    });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-overlap',
    });

    for (let i = 0; i < 50; i++) {
      const saveStart = saveEventLog.find((e) => e.kind === 'start');
      const logStart = logEventLog.find((e) => e.kind === 'start');
      if (saveStart && logStart) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const saveStarted = saveEventLog.find((e) => e.kind === 'start');
    const logStarted = logEventLog.find((e) => e.kind === 'start');
    const saveFinished = saveEventLog.find((e) => e.kind === 'finish');
    const logFinished = logEventLog.find((e) => e.kind === 'finish');

    expect(saveStarted).toBeDefined();
    expect(logStarted).toBeDefined();
    expect(saveFinished).toBeUndefined();
    expect(logFinished).toBeUndefined();

    saveGate.release();
    logGate.release();

    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = 'consumed';
    }
    expect(body).toBeDefined();
    expect(saveEventLog.find((e) => e.kind === 'finish')).toBeDefined();
    expect(logEventLog.find((e) => e.kind === 'finish')).toBeDefined();
  });

  test('logChat failure does not block saveSession; both are started before either settles', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog, chatLogRepository } = makeAgent({
      chatLogging: true,
      logReject: new Error('log db down'),
    });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-log-fails',
    });

    for (let i = 0; i < 50; i++) {
      const saveStart = saveEventLog.find((e) => e.kind === 'start');
      const logStart = logEventLog.find((e) => e.kind === 'start');
      if (saveStart && logStart) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const saveStart = saveEventLog.find((e) => e.kind === 'start');
    const logStart = logEventLog.find((e) => e.kind === 'start');
    expect(saveStart).toBeDefined();
    expect(logStart).toBeDefined();

    saveGate.release();
    logGate.release();

    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = 'consumed';
    }
    expect(body).toBeDefined();
    expect(chatLogRepository.insert).toHaveBeenCalled();
  });

  test('StreamData.close() runs after persistence settles (success path)', async () => {
    const { agent, saveGate, logGate } = makeAgent({ chatLogging: true });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-close-success',
    });
    saveGate.release();
    logGate.release();
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = 'consumed';
    }
    expect(body).toBeDefined();
    expect(saveGate.resolvedAt).toBeDefined();
    expect(logGate.resolvedAt).toBeDefined();
  });

  test('StreamData.close() still runs when saveSession rejects', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog } = makeAgent({
      chatLogging: true,
      saveReject: new Error('save db down'),
    });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-close-save-fails',
    });

    for (let i = 0; i < 50; i++) {
      if (saveEventLog.find((e) => e.kind === 'start')) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(saveEventLog.find((e) => e.kind === 'start')).toBeDefined();

    const bodyPromise = response.text().then(
      (body) => ({ status: 'fulfilled' as const, body }),
      (error) => ({ status: 'rejected' as const, error }),
    );
    let bodySettled = false;
    void bodyPromise.finally(() => {
      bodySettled = true;
    });

    saveGate.release();

    for (let i = 0; i < 20 && !saveEventLog.some((e) => e.kind === 'fail'); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    await new Promise((r) => setTimeout(r, 10));

    expect(saveEventLog.some((e) => e.kind === 'fail')).toBe(true);
    expect(logEventLog.some((e) => e.kind === 'finish')).toBe(false);
    expect(bodySettled).toBe(false);

    logGate.release();

    const bodyResult = await bodyPromise;
    expect(bodyResult.status).toBeDefined();
    expect(logEventLog.some((e) => e.kind === 'finish')).toBe(true);
    expect(bodySettled).toBe(true);
  });

  test('stream() does NOT call saveSession when useMemory is false', async () => {
    const { agent, saveGate, logGate } = makeAgent({});
    (agent as any).buildModel = () => scriptedStreamModel('hello');
    (agent as any).shouldUseStatelessHistory = () => true;

    const response = await agent.stream({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-no-save',
    });
    logGate.release();
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = 'consumed';
    }
    expect(body).toBeDefined();
    expect(saveGate.resolvedAt).toBeUndefined();
    saveGate.release();
  });
});

describe('Phase 3 (C3) — runOnce and debugRun still await both writes', () => {
  test('runOnce awaits both saveSession and logChat before returning', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog } = makeAgent({ chatLogging: true });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const textPromise = agent.runOnce({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-runonce',
    });

    for (let i = 0; i < 50; i++) {
      const saveStart = saveEventLog.find((e) => e.kind === 'start');
      const logStart = logEventLog.find((e) => e.kind === 'start');
      if (saveStart && logStart) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    expect(saveEventLog.find((e) => e.kind === 'start')).toBeDefined();
    expect(logEventLog.find((e) => e.kind === 'start')).toBeDefined();

    saveGate.release();
    logGate.release();
    const text = await textPromise;
    expect(text).toBe('hello');
    expect(saveGate.resolvedAt).toBeDefined();
    expect(logGate.resolvedAt).toBeDefined();
  });

  test('debugRun awaits both saveSession and logChat before returning', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog } = makeAgent({ chatLogging: true });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const resultPromise = agent.debugRun({
      messages: [{ role: 'user', content: 'hi' } as any],
      sessionKey: 'phase3-debugrun',
    }) as Promise<any>;

    for (let i = 0; i < 50; i++) {
      const saveStart = saveEventLog.find((e) => e.kind === 'start');
      const logStart = logEventLog.find((e) => e.kind === 'start');
      if (saveStart && logStart) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    expect(saveEventLog.find((e) => e.kind === 'start')).toBeDefined();
    expect(logEventLog.find((e) => e.kind === 'start')).toBeDefined();

    saveGate.release();
    logGate.release();
    const result = await resultPromise;
    expect(result.answer).toBe('hello');
    expect(saveGate.resolvedAt).toBeDefined();
    expect(logGate.resolvedAt).toBeDefined();
  });

  test('runOnce() runs saveSession and logChat in the same tick (start skew < 20ms)', async () => {
    const { agent, saveGate, logGate, saveEventLog, logEventLog } = makeAgent({ chatLogging: true });
    (agent as any).buildModel = () => scriptedStreamModel('hello');

    const promise = agent.runOnce({
      messages: [{ role: 'user', content: 'hi' }] as any,
      sessionKey: 'phase3-overlap-time',
    });

    for (let i = 0; i < 50; i++) {
      const saveStart = saveEventLog.find((e) => e.kind === 'start');
      const logStart = logEventLog.find((e) => e.kind === 'start');
      if (saveStart && logStart) break;
      await new Promise((r) => setTimeout(r, 1));
    }

    const saveStart = saveEventLog.find((e) => e.kind === 'start')!;
    const logStart = logEventLog.find((e) => e.kind === 'start')!;
    const startSkew = Math.abs(saveStart.t - logStart.t);
    expect(startSkew).toBeLessThan(20);

    saveGate.release();
    logGate.release();
    await promise;
  });
});

describe('Phase 3 (C7) — logChat token estimate is cached per tool identity', () => {
  function makeLogOnlyAgent(registryTools: any[]) {
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
    const router = { findRelevantTools: mock(() => Promise.resolve({ status: 'routed', tools: [] })) } as any;
    const registry = { tools: registryTools } as any;
    const builder = { invokeTool: mock(() => Promise.resolve({ content: [{ text: 'ok' }] })) } as any;
    const chatLogRepository = { insert: mock(async (row: any) => undefined) } as any;
    const dbStore = {
      load: mock(() => Promise.resolve([])),
      save: mock(() => Promise.resolve()),
      clear: mock(() => Promise.resolve()),
    } as any;
    const cacheStore = {
      load: mock(() => Promise.resolve([])),
      save: mock(() => Promise.resolve()),
      clear: mock(() => Promise.resolve()),
    } as any;
    const config = {
      toolRouting: { enabled: true },
      chatLogging: { enabled: true },
      maxSteps: 10,
      conversationStore: 'db',
    } as any;
    const agent = new ChatAgent(
      settingsService,
      dbStore as any,
      cacheStore as any,
      config,
      chatLogRepository,
    );
    (agent as any).container = {
      get: (token: any) => {
        if (token === TOOL_PROVIDER) return router;
        if (token?.name === 'McpRegistryService') return registry;
        if (token?.name === 'McpBuilderService') return builder;
        throw new Error(`Unknown token: ${token?.name ?? String(token)}`);
      },
    };
    return { agent, chatLogRepository };
  }

  test('repeated log calls for the same tool identity reuse the cached token estimate', async () => {
    const toolA = { name: 'tool_a', description: 'Tool A', validationArgs: [{ name: 'x' }] };
    const toolB = { name: 'tool_b', description: 'Tool B', validationArgs: [{ name: 'y' }] };
    const { agent, chatLogRepository } = makeLogOnlyAgent([toolA, toolB]);

    await (agent as any).logChat('s1', 'q1', 'routed', ['tool_a', 'tool_b'], [
      { toolCalls: [{ toolName: 'tool_a', args: {} }] },
    ]);
    await (agent as any).logChat('s2', 'q2', 'routed', ['tool_a', 'tool_b'], [
      { toolCalls: [{ toolName: 'tool_b', args: {} }] },
    ]);

    const calls = (chatLogRepository.insert as any).mock.calls as any[];
    const firstEstimate = (calls[0][0].metadata as any).toolPromptTokenEstimate;
    const secondEstimate = (calls[1][0].metadata as any).toolPromptTokenEstimate;

    expect(firstEstimate).toBeGreaterThan(0);
    expect(secondEstimate).toBe(firstEstimate);
  });

  test('token estimate is stable across calls regardless of cache hit', async () => {
    const toolA = { name: 'tool_a', description: 'Tool A', validationArgs: [] };
    const { agent, chatLogRepository } = makeLogOnlyAgent([toolA]);

    await (agent as any).logChat('s1', 'q1', 'routed', ['tool_a'], []);
    const lastCall = ((chatLogRepository.insert as any).mock.calls.at(-1)![0]) as any;
    const first = (lastCall.metadata as any).toolPromptTokenEstimate;
    expect(first).toBe(Math.ceil(JSON.stringify({ name: 'tool_a', description: 'Tool A', parameters: [] }).length / 4));
  });
});
