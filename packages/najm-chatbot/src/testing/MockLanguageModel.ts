import { MockLanguageModelV3 } from 'ai/test';

type LegacyUsage = {
  promptTokens?: number;
  completionTokens?: number;
};

type LegacyGenerateResult = {
  text?: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args?: string;
  }>;
  finishReason?: string;
  usage?: LegacyUsage;
  rawCall?: { rawPrompt?: unknown; rawSettings?: unknown };
};

type LegacyStreamResult = {
  stream: ReadableStream<any>;
  rawCall?: { rawPrompt?: unknown; rawSettings?: unknown };
};

interface LegacyMockOptions {
  provider?: string;
  modelId?: string;
  doGenerate?: (options: any) => Promise<LegacyGenerateResult>;
  doStream?: (options: any) => Promise<LegacyStreamResult>;
}

function usage(input: LegacyUsage = {}) {
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;

  return {
    inputTokens: {
      total: promptTokens,
      noCache: promptTokens,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: {
      total: completionTokens,
      text: completionTokens,
      reasoning: 0,
    },
  };
}

function finishReason(value: string | undefined) {
  const unified = value === 'stop'
    || value === 'length'
    || value === 'content-filter'
    || value === 'tool-calls'
    || value === 'error'
    ? value
    : 'other';

  return { unified, raw: value };
}

function legacyStreamToV3(stream: ReadableStream<any>): ReadableStream<any> {
  const textId = 'mock-text';
  let textStarted = false;

  return stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (chunk?.type === 'text-delta' && 'textDelta' in chunk) {
        if (!textStarted) {
          controller.enqueue({ type: 'text-start', id: textId });
          textStarted = true;
        }
        controller.enqueue({ type: 'text-delta', id: textId, delta: chunk.textDelta });
        return;
      }

      if (chunk?.type === 'tool-call' && 'args' in chunk) {
        controller.enqueue({
          type: 'tool-call',
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.args,
        });
        return;
      }

      if (chunk?.type === 'finish' && typeof chunk.finishReason === 'string') {
        if (textStarted) {
          controller.enqueue({ type: 'text-end', id: textId });
          textStarted = false;
        }
        controller.enqueue({
          type: 'finish',
          finishReason: finishReason(chunk.finishReason),
          usage: usage(chunk.usage),
        });
        return;
      }

      controller.enqueue(chunk);
    },
    flush(controller) {
      if (textStarted) {
        controller.enqueue({ type: 'text-end', id: textId });
      }
    },
  }));
}

/**
 * Compatibility fixture for Najm's AI SDK v4-style tests.
 *
 * It deliberately accepts the old MockLanguageModelV1 result shape while
 * presenting an AI SDK v6 LanguageModelV3 to production code.
 */
export class MockLanguageModelV1 extends MockLanguageModelV3 {
  constructor(options: LegacyMockOptions = {}) {
    super({
      provider: options.provider,
      modelId: options.modelId,
      doGenerate: options.doGenerate
        ? async (callOptions: any) => {
            const result = await options.doGenerate!(callOptions);
            return {
              content: [
                ...(result.text ? [{ type: 'text' as const, text: result.text }] : []),
                ...(result.toolCalls ?? []).map((call) => ({
                  type: 'tool-call' as const,
                  toolCallId: call.toolCallId,
                  toolName: call.toolName,
                  input: call.args ?? '{}',
                })),
              ],
              finishReason: finishReason(result.finishReason),
              usage: usage(result.usage),
              request: result.rawCall ? { body: result.rawCall.rawPrompt } : undefined,
              warnings: [],
            };
          }
        : undefined,
      doStream: options.doStream
        ? async (callOptions: any) => {
            const result = await options.doStream!(callOptions);
            return {
              stream: legacyStreamToV3(result.stream),
              request: result.rawCall ? { body: result.rawCall.rawPrompt } : undefined,
            };
          }
        : undefined,
    } as any);
  }
}
