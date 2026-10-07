import 'reflect-metadata';
import { describe, expect, test, mock } from 'bun:test';
import { McpBuilderService, McpRegistryService, TOOL_PROVIDER } from 'najm-mcp';
import { ChatAgent } from '../src/agent/ChatAgent';
import { CHATBOT_CONTEXT_PROVIDER } from '../src/tokens';
import { detectMoroccanReplyLanguage, replyLanguageInstruction } from '../src/agent/replyPolicy';
import { executeReplyTemplate } from '../src/agent/replyTemplate';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

describe('Moroccan reply language', () => {
  test.each([
    ['شْحال من تلميذ فهاد العام؟', 'ary'], ['بغيت نعرف الثمن', 'ary'],
    ['وريني النقط ديال Salma Idrissi', 'ary'], ['ch7al mn tilmid kayn?', 'ary'],
    ['كم عدد التلاميذ؟', 'ar'], ['اعرض أقسام Cours Préparatoire', 'ar'],
    ['Crée une annonce «المدرسة غادي تسد»', 'fr'], ['Affiche les notes de سلمى', 'fr'],
    ['Bonjour!', 'fr'], ['Show invoices', null], ['Hola', null],
    ['اعرض وصف المنتج «بغيت هاد المنتج»', 'ar'],
  ])('%s → %s', (text, language) => expect(detectMoroccanReplyLanguage(text)).toBe(language));
  test('sends only the selected instruction', () => {
    expect(replyLanguageInstruction('fr')).toContain('français');
    expect(replyLanguageInstruction('fr')).not.toContain('الدارجة');
    expect(replyLanguageInstruction(null)).toBeNull();
  });
});

describe('reply template tool boundary', () => {
  const read = { name: 'counts', annotations: { readOnlyHint: true } } as any;
  const plan = { calls: [{ name: 'counts', input: {} }], render: ([result]: any[]) => `${result.count}` };
  test('passes inputs to MCP and renders its actual result', async () => {
    const invokeTool = mock(async () => ({ content: [{ type: 'text', text: '{"count":7}' }] }));
    const events: any[] = [];
    const result = await executeReplyTemplate(plan, [read], { invokeTool } as any, event => events.push(event));
    expect(result.text).toBe('7');
    expect(invokeTool).toHaveBeenCalledWith('counts', {});
    expect(events[0].outcome).toBe('executed');
  });
  test.each([
    [], [{ name: 'counts' }], [{ ...read, confirmation: {} }],
    [{ ...read, annotations: { readOnlyHint: true, destructiveHint: true } }],
  ])('rejects unsafe/unavailable tools before invocation', async tools => {
    const invokeTool = mock(async () => ({}));
    await expect(executeReplyTemplate(plan, tools as any, { invokeTool } as any, () => {})).rejects.toThrow();
    expect(invokeTool).not.toHaveBeenCalled();
  });
  test.each([{ isError: true, content: [{ type: 'text', text: '{"count":7}' }] },
    { content: [{ type: 'text', text: 'not JSON' }] }])('never renders an error as a fact', async result => {
    const render = mock(() => 'invented');
    await expect(executeReplyTemplate({ ...plan, render }, [read],
      { invokeTool: async () => result } as any, () => {})).rejects.toThrow();
    expect(render).not.toHaveBeenCalled();
  });
});

function agent(options: { provider?: string; template?: any; result?: any; preparation?: any; router?: any; tools?: any; context?: any } = {}) {
  const read = { name: 'counts', annotations: { readOnlyHint: true } };
  const settings = { isEnabled: true, provider: options.provider ?? 'openrouter', model: 'selected-model', useMemory: true };
  const store = { load: async () => [], save: mock(async () => {}) };
  const diagnostics: any[] = [];
  const context = { getContext: mock(options.context ?? (async () => 'knowledge')) };
  const instance = new ChatAgent({ getInternal: async () => settings } as any, store as any, store as any,
    { tools: options.tools, reply: { detectLanguage: detectMoroccanReplyLanguage, template: options.template, preparation: options.preparation },
      chatLogging: { enabled: false, onDiagnostics: data => { diagnostics.push(data); } } },
    { insert: async () => {} } as any);
  (instance as any).container = { get: (token: any) => {
    if (token === TOOL_PROVIDER) return { findRelevantTools: options.router ?? (async () => ({ status: 'routed', tools: [read] })) };
    if (token === McpRegistryService) return { tools: [read] };
    if (token === McpBuilderService) return { invokeTool: mock(async () => options.result ?? { content: [{ type: 'text', text: '{"count":7}' }] }) };
    if (token === CHATBOT_CONTEXT_PROVIDER) return context;
    throw new Error('no token');
  } };
  const generate = mock(async () => ({ text: 'model answer', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } }));
  const model = new MockLanguageModelV1({ doGenerate: generate });
  (instance as any).buildModel = () => model;
  return { instance, diagnostics, generate, context, store };
}

describe('provider-independent reply integration', () => {
  test.each(['openrouter', 'openai', 'anthropic', 'google', 'ollama'])('templates skip %s generation and preserve memory/diagnostics', async provider => {
    const { instance, diagnostics, generate, store } = agent({ provider, template: () => ({ text: 'ما نقدرش ندير هاد التغيير هنا.' }) });
    expect(await instance.runOnce({ sessionKey: 'session', messages: [{ role: 'user', parts: [{ type: 'text', text: 'دير هاد التغيير' }] }] as any })).toContain('ما نقدرش');
    expect(generate).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(diagnostics[0].reply).toEqual({ source: 'template', language: 'ary' });
    expect(diagnostics[0].cost.totalCost).toBe(0);
  });
  test('stream contains actual tool outputs, selected-language text and zero model cost', async () => {
    const { instance, diagnostics, generate } = agent({ template: () => ({
      calls: [{ name: 'counts', input: {} }], render: ([result]: any[]) => `كاينين ${result.count} تلاميذ.`,
    }) });
    const response = await instance.stream({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'شحال من تلميذ؟' }] }] as any });
    const stream = await response.text();
    expect(stream).toContain('tool-output-available');
    expect(stream).toContain('كاينين 7');
    expect(stream).toContain('[DONE]');
    expect(diagnostics[0].tools[0].outcome).toBe('executed');
    expect(generate).not.toHaveBeenCalled();
  });
  test('latest Darija turn chooses language while routing/knowledge retain French history', async () => {
    const { instance, context, generate } = agent();
    await instance.runOnce({ messages: [
      { role: 'user', parts: [{ type: 'text', text: 'Combien de produits?' }] },
      { role: 'user', parts: [{ type: 'text', text: 'واش كاين تخفيض؟' }] },
    ] } as any);
    expect(context.getContext.mock.calls[0]).toEqual(['Combien de produits?\n---\nواش كاين تخفيض؟', { latestUserText: 'واش كاين تخفيض؟', channel: 'web' }]);
    const prompt = JSON.stringify(generate.mock.calls[0]);
    expect(prompt).toContain('الدارجة المغربية');
    expect(prompt).not.toContain('Répondez en français');
  });
  test('failed authorized read produces localized unavailability, never a model guess', async () => {
    const { instance, generate, diagnostics } = agent({ result: { isError: true }, template: () => ({ calls: [{ name: 'counts', input: {} }], render: () => '100' }) });
    expect(await instance.runOnce({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'كم عدد التلاميذ؟' }] }] as any })).toContain('لا يمكنني الوصول');
    expect(diagnostics[0].reply.error).toBe(true);
    expect(generate).not.toHaveBeenCalled();
  });
});

const firstMessage = { messages: [{ role: 'user', parts: [{ type: 'text', text: 'Bonjour!' }] }] } as any;
const pendingRouter = () => new Promise<any>(() => {});
const fastPolicy = (extra: any = {}) => ({ enabled: true, eligible: () => true,
  prepare: async () => ({ text: 'prepared answer' }), ...extra });

describe('async reply integration', () => {
  test.each(['runOnce', 'stream', 'debugRun'])('%s uses the winning candidate without waiting for routing', async method => {
    const { instance, generate, store } = agent({ provider: 'openai', router: pendingRouter, preparation: fastPolicy() });
    const input = { ...firstMessage, sessionKey: 'session' };
    const result = await (instance as any)[method](input);
    const text = result instanceof Response ? await result.text() : typeof result === 'string' ? result : result.answer;
    expect(text).toContain('prepared answer');
    expect(generate).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledTimes(1);
  });
  test('synchronous template has precedence and starts neither classifier nor router', async () => {
    const prepare = mock(async () => ({ text: 'classifier' }));
    const router = mock(pendingRouter);
    const { instance } = agent({ router, template: () => ({ text: 'early' }), preparation: fastPolicy({ prepare }) });
    expect(await instance.runOnce(firstMessage)).toBe('early');
    expect(prepare).not.toHaveBeenCalled();
    expect(router).not.toHaveBeenCalled();
  });
  test('unknown history cannot be asserted from client messages or empty store', async () => {
    const eligible = mock((req: any) => req.historyComplete === true && req.priorUserTurns === 0);
    const prepare = mock(async () => ({ text: 'unsafe' }));
    const { instance } = agent({ preparation: fastPolicy({ eligible, prepare }) });
    expect(await instance.runOnce({ ...firstMessage, historyComplete: true, priorUserTurns: 0 })).toBe('model answer');
    expect(eligible.mock.calls[0][0]).toMatchObject({ historyComplete: false, priorUserTurns: null, userId: null });
    expect(prepare).not.toHaveBeenCalled();
  });
  test.each([-1, 1.5, Infinity, NaN])('invalid server history count %s defaults to unknown', async count => {
    const eligible = mock((req: any) => req.historyComplete);
    const { instance } = agent({ preparation: fastPolicy({ eligible, resolveContext: () => ({ historyComplete: true, priorUserTurns: count }) }) });
    expect(await instance.runOnce(firstMessage)).toBe('model answer');
    expect(eligible.mock.calls[0][0].priorUserTurns).toBeNull();
  });
  test('server-owned complete history can enable a first-turn candidate', async () => {
    const { instance } = agent({ router: pendingRouter, preparation: fastPolicy({
      resolveContext: () => ({ historyComplete: true, priorUserTurns: 0 }),
      eligible: (req: any) => req.historyComplete && req.priorUserTurns === 0,
    }) });
    expect(await instance.runOnce(firstMessage)).toBe('prepared answer');
  });
  test('disabled hook leaves existing model preparation intact', async () => {
    const prepare = mock(async () => ({ text: 'unexpected' }));
    const { instance } = agent({ preparation: fastPolicy({ enabled: false, prepare }) });
    expect(await instance.runOnce(firstMessage)).toBe('model answer');
    expect(prepare).not.toHaveBeenCalled();
  });
  test('winning read uses registered MCP tool even when routing has not finished', async () => {
    const { instance, generate, diagnostics } = agent({ router: pendingRouter, preparation: fastPolicy({
      prepare: async () => ({ calls: [{ name: 'counts', input: {} }], render: ([data]: any[]) => `count ${data.count}` }),
    }) });
    expect(await instance.runOnce(firstMessage)).toBe('count 7');
    expect(diagnostics[0].tools).toHaveLength(1);
    expect(generate).not.toHaveBeenCalled();
  });
  test('tools none declines an async read plan and makes no MCP call', async () => {
    const { instance, diagnostics } = agent({ tools: 'none', preparation: fastPolicy({
      prepare: async () => ({ calls: [{ name: 'counts', input: {} }], render: () => 'fake' }),
    }) });
    expect(await instance.runOnce(firstMessage)).toBe('model answer');
    expect(diagnostics[0].tools).toHaveLength(0);
  });
  test('failed winning MCP read returns unavailability without generation', async () => {
    const { instance, generate } = agent({ router: pendingRouter, result: { isError: true }, preparation: fastPolicy({
      prepare: async () => ({ calls: [{ name: 'counts', input: {} }], render: () => 'fake' }),
    }) });
    expect(await instance.runOnce(firstMessage)).toContain('Je ne peux pas');
    expect(generate).not.toHaveBeenCalled();
  });
  test('late ordinary preparation cannot overwrite template diagnostics or persist again', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const { instance, diagnostics, store } = agent({ provider: 'openai', router: async () => {
      await pending; return { status: 'routed', tools: [] };
    }, preparation: fastPolicy() });
    await instance.runOnce({ ...firstMessage, sessionKey: 'session' });
    const saved = JSON.stringify(diagnostics[0]);
    release();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(JSON.stringify(diagnostics[0])).toBe(saved);
    expect(store.save).toHaveBeenCalledTimes(1);
  });
});


test.each([null, {}, { text: 42 }, { text: 'answer', calls: [] },
  { calls: [{ name: 'counts', input: {} }] },
  { calls: [{ name: 'counts', input: [] }], render: () => 'fake' },
  { calls: [{ name: 'missing', input: {} }], render: () => 'fake' },
])('malformed async plans decline before executing any read', async candidate => {
  const { instance, diagnostics } = agent({ preparation: fastPolicy({ prepare: async () => candidate }) });
  expect(await instance.runOnce(firstMessage)).toBe('model answer');
  expect(diagnostics[0].tools).toHaveLength(0);
});
test('disconnect during preparation suppresses generation and persistence', async () => {
  const controller = new AbortController();
  let signal!: AbortSignal;
  const { instance, generate, store, diagnostics } = agent({ router: pendingRouter, preparation: fastPolicy({
    prepare: (request: any) => { signal = request.signal; return new Promise(() => {}); },
  }) });
  const result = instance.runOnce({ ...firstMessage, sessionKey: 'session', signal: controller.signal });
  for (let i = 0; !signal && i < 20; i++) await Promise.resolve();
  controller.abort(new Error('disconnect'));
  await expect(result).rejects.toThrow('disconnect');
  expect(signal.aborted).toBe(true);
  expect(generate).not.toHaveBeenCalled();
  expect(store.save).not.toHaveBeenCalled();
  expect(diagnostics[0].outcome).toBe('aborted');
});
test('disconnect after one read prevents a second read and rendering', async () => {
  const controller = new AbortController();
  const invokeTool = mock(async () => { controller.abort(); return { content: [{ type: 'text', text: '{}' }] }; });
  const render = mock(() => 'fake');
  await expect(executeReplyTemplate({ calls: [{ name: 'counts', input: {} }, { name: 'counts', input: {} }], render },
    [{ name: 'counts', annotations: { readOnlyHint: true } }] as any,
    { invokeTool } as any, () => {}, controller.signal)).rejects.toThrow();
  expect(invokeTool).toHaveBeenCalledTimes(1);
  expect(render).not.toHaveBeenCalled();
});
