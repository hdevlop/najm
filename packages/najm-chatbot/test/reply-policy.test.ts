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

function agent(options: { provider?: string; template?: any; result?: any } = {}) {
  const read = { name: 'counts', annotations: { readOnlyHint: true } };
  const settings = { isEnabled: true, provider: options.provider ?? 'openrouter', model: 'selected-model', useMemory: true };
  const store = { load: async () => [], save: mock(async () => {}) };
  const diagnostics: any[] = [];
  const context = { getContext: mock(async () => 'knowledge') };
  const instance = new ChatAgent({ getInternal: async () => settings } as any, store as any, store as any,
    { reply: { detectLanguage: detectMoroccanReplyLanguage, template: options.template },
      chatLogging: { enabled: false, onDiagnostics: data => { diagnostics.push(data); } } },
    { insert: async () => {} } as any);
  (instance as any).container = { get: (token: any) => {
    if (token === TOOL_PROVIDER) return { findRelevantTools: async () => ({ status: 'routed', tools: [read] }) };
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
