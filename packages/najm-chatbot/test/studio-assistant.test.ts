import { describe, test, expect, mock } from 'bun:test';
import { StudioAssistantProviderService } from '../src/studio-assistant/StudioAssistantProviderService';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

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

function makeService(toolResult: { content: Array<{ type: 'text'; text: string }>; isError?: boolean }) {
  const settings = { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test' }) } as any;
  const tools = [
    { name: 'rag_studio_create_semantic', description: 'Create a semantic' },
    { name: 'rag_studio_list_semantics', description: 'List semantics' },
  ];
  const builder = { invokeTool: mock(() => Promise.resolve(toolResult)) } as any;
  const service = new StudioAssistantProviderService(settings, { tools } as any, builder);
  let call = 0;
  (service as any).buildModel = () => new MockLanguageModelV1({
    doStream: async () => {
      call += 1;
      return call === 1
        ? streamOf([
          { type: 'text-delta', textDelta: 'Creating it.' },
          { type: 'tool-call', toolCallType: 'function', toolCallId: 'call-1', toolName: 'rag_studio_create_semantic', args: '{"toolName":"orders_list","phrase":"show orders","lang":"en"}' },
          { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 1, completionTokens: 1 } },
        ])
        : streamOf([
          { type: 'text-delta', textDelta: 'Done.' },
          { type: 'finish', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } },
        ]);
    },
  });
  return { service, builder };
}

async function events(response: Response): Promise<any[]> {
  const body = await response.text();
  return body
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('data: '))
    .map((block) => JSON.parse(block.slice('data: '.length)));
}

const input = {
  workspace: 'routing-semantics',
  view: 'routing-semantics',
  message: 'add a phrase',
  allowedTools: ['rag_studio_create_semantic', 'rag_studio_list_semantics'],
} as any;

describe('C3: studio assistant stream', () => {
  test('text deltas are strings and tool calls carry the model input', async () => {
    const { service, builder } = makeService({ content: [{ type: 'text', text: '{"id":"s1"}' }] });
    const sent = await events(await service.run(input));

    const text = sent.filter((event) => event.type === 'text').map((event) => event.delta);
    expect(text).toEqual(['Creating it.', 'Done.']);

    const call = sent.find((event) => event.type === 'tool_call');
    expect(call.args).toEqual({ toolName: 'orders_list', phrase: 'show orders', lang: 'en' });
    expect(call.requiresConfirmation).toBe(true);
    expect(builder.invokeTool).toHaveBeenCalledTimes(1);

    const result = sent.find((event) => event.type === 'tool_result');
    expect(result.ok).toBe(true);
    expect(result.result).toBe('{"id":"s1"}');
    expect(sent.at(-1).type).toBe('done');
  });

  test('a tool that returns an MCP error is reported as failed', async () => {
    const { service } = makeService({ content: [{ type: 'text', text: 'Validation failed: phrase' }], isError: true });
    const sent = await events(await service.run(input));

    const result = sent.find((event) => event.type === 'tool_result');
    expect(result.ok).toBe(false);
    expect(result.result).toBe('Validation failed: phrase');
  });
});
