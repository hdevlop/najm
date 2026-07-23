import { describe, expect, test } from 'bun:test';
import { chatbotRoutingJsonSchema } from '../src/toolRouter/ToolRouterDto';

describe('chatbotRoutingJsonSchema', () => {
  test('accepts simplified flat config', () => {
    const result = chatbotRoutingJsonSchema.safeParse({
      mode: 'routing',
      embedding: {
        baseUrl: 'http://localhost:11434',
        model: 'embeddinggemma',
      },
      maxTools: 10,
      similarityThreshold: 0.45,
      indexOnBoot: true,
      chatLogging: true,
    });

    expect(result.success).toBe(true);
  });

  test('accepts mode values', () => {
    expect(chatbotRoutingJsonSchema.safeParse({ mode: 'off' }).success).toBe(true);
    expect(chatbotRoutingJsonSchema.safeParse({ mode: 'rag' }).success).toBe(true);
    expect(chatbotRoutingJsonSchema.safeParse({ mode: 'routing' }).success).toBe(true);
  });

  test('rejects invalid mode', () => {
    const result = chatbotRoutingJsonSchema.safeParse({ mode: 'invalid' });
    expect(result.success).toBe(false);
  });

  test('accepts empty config', () => {
    const result = chatbotRoutingJsonSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
