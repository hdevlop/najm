import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, plugin } from 'najm-core';
import { database } from 'najm-database';
import { mcp } from 'najm-mcp';
import { ChatAgent } from '../src/agent/ChatAgent';
import type { ChatDebugResponse, ChatDebugError } from '../src/agent/ChatAgent';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { AiSettingsRepository } from '../src/ai-settings/AiSettingsRepository';
import { ChatLogRepository } from '../src/chatLogs';
import { ChatDebugController } from '../src/chat/ChatDebugController';
import { ChatSessionRepository } from '../src/sessions/ChatSessionRepository';
import { DbConversationStore, CacheConversationStore } from '../src/sessions/ConversationStore';
import { CHATBOT_CONFIG, CHATBOT_SCHEMA } from '../src/tokens';
import { AUTH_CONFIG, EncryptionService } from 'najm-auth';
import { cache } from 'najm-cache';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { aiSettingsTable, chatSessionsTable, chatbotInteractionLogsTable } from '../src/schema/sqlite';
import { MockLanguageModelV1 } from 'ai/test';

const schema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
  chatbotInteractionLogs: chatbotInteractionLogsTable,
};

process.env.NAJM_ENCRYPTION_KEY = process.env.NAJM_ENCRYPTION_KEY
  ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, session_key TEXT NOT NULL UNIQUE, user_id TEXT, channel TEXT NOT NULL DEFAULT 'web', messages TEXT NOT NULL, title TEXT, message_count INTEGER NOT NULL DEFAULT 0, last_message_at TEXT, expires_at TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_interaction_logs (id TEXT PRIMARY KEY, session_key TEXT, user_query TEXT NOT NULL, query_lang TEXT, routing_enabled INTEGER NOT NULL DEFAULT 0, routing_status TEXT NOT NULL, routed_tools TEXT, actual_tool_names TEXT, model_tool_calls TEXT, model_answer TEXT, steps_count TEXT, success INTEGER, error TEXT, metadata TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_routing_settings (id TEXT PRIMARY KEY, enable_knowledge INTEGER NOT NULL DEFAULT 0, max_tools TEXT, top_semantic_hits TEXT, similarity_threshold TEXT, fallback_on_no_match TEXT, fallback_on_router_error TEXT, allowed_langs TEXT, tools_override TEXT, context_override TEXT, dependencies TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_tool_embeddings (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, content TEXT NOT NULL, embedding TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_tool_semantics (id TEXT PRIMARY KEY, phrase TEXT NOT NULL, tool_name TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'en', source TEXT, source_file TEXT, confirmation TEXT, has_embedding INTEGER NOT NULL DEFAULT 0, embedding_error TEXT, created_at TEXT, updated_at TEXT)`);
}

let server: Server | undefined;
let port = 3600;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

function scriptedModel(text: string) {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      text,
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

const chatbotTestPlugin = (config: Record<string, any>) =>
  plugin('chatbot')
    .version('1.0.0')
    .depends(events())
    .config(CHATBOT_CONFIG, config)
    .set(AUTH_CONFIG, { bcryptRounds: 10 } as any)
    .set(CHATBOT_SCHEMA, schema)
    .set(Symbol.for('najm:auth:encryption-key'), process.env.NAJM_ENCRYPTION_KEY)
    .services(
      ChatAgent,
      AiSettingsService,
      AiSettingsRepository,
      EncryptionService,
      ChatLogRepository,
      ChatSessionRepository,
      DbConversationStore,
      CacheConversationStore,
    )
    .build();

import { events } from 'najm-event';

async function setup(cannedText = 'debug reply') {
  const p = ++port;
  const sqlite = new Database(':memory:');
  createSchema(sqlite);
  const db = drizzle(sqlite, { schema });

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(cache())
    .use(events())
    .use(mcp({ name: 'stub', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbotTestPlugin({ dialect: 'sqlite', maxSteps: 10 }));

  await server.listen(p);

  const container = (server as any).container;
  const settings = container.get(AiSettingsService) as AiSettingsService;
  await settings.upsert({
    provider: 'openai',
    apiKey: 'sk-fake-unused',
    model: 'gpt-test',
    isEnabled: true,
  } as any);

  const agent = container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
  agent.buildModel = () => scriptedModel(cannedText);

  return { port: p, container };
}

describe('ChatAgent.debugRun', () => {
  test('ChatDebugController creates a reusable sessionKey and unique fallback message ids', async () => {
    const seenInputs: any[] = [];
    const controller = new ChatDebugController({
      debugRun: async (input: any) => {
        seenInputs.push(input);
        return { answer: 'ok', sessionKey: input.sessionKey };
      },
    } as any);

    const first = await controller.debug({ message: 'hello my name is hicham' }) as ChatDebugResponse;
    const second = await controller.debug({ message: 'what is my name?', sessionKey: first.sessionKey }) as ChatDebugResponse;

    expect(first.sessionKey).toBeTruthy();
    expect(second.sessionKey).toBe(first.sessionKey);
    expect(seenInputs[0].messages[0].id).not.toBe(seenInputs[1].messages[0].id);
  });

  test('returns answer and latency on success', async () => {
    const { container } = await setup('hello from debug');
    const agent = container.get(ChatAgent) as ChatAgent;

    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'test query' } as any],
    }) as ChatDebugResponse;

    expect(result.answer).toBe('hello from debug');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-test');
  });

  test('returns error when AI is disabled', async () => {
    const { container } = await setup();
    const settings = container.get(AiSettingsService) as AiSettingsService;
    await settings.upsert({ isEnabled: false } as any);

    const agent = container.get(ChatAgent) as ChatAgent;
    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'test' } as any],
    }) as ChatDebugError;

    expect(result.error).toBeDefined();
    expect(result.code).toBe('AI_DISABLED');
  });

  test('includes routing and knowledge trace data', async () => {
    const { container } = await setup('routed reply');
    const agent = container.get(ChatAgent) as ChatAgent;

    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'routed query' } as any],
    }) as ChatDebugResponse;

    expect(result.routing).toBeDefined();
    expect(result.knowledge).toBeDefined();
    expect(typeof result.routing!.status).toBe('string');
    expect(typeof result.knowledge!.used).toBe('boolean');
  });

  test('handles provider errors gracefully', async () => {
    const { container } = await setup('will not run');
    const agent = container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    agent.buildModel = () => {
      throw new Error('Provider connection failed');
    };

    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'test' } as any],
    }) as ChatDebugError;

    expect(result.code).toBe('PROVIDER_ERROR');
    expect(result.error).toContain('Provider connection failed');
  });

  test('handles missing model gracefully', async () => {
    const { container } = await setup();
    const settings = container.get(AiSettingsService) as AiSettingsService;
    await settings.upsert({ provider: 'openai', model: '', isEnabled: true } as any);

    const agent = container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    agent.buildModel = () => null;

    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'test' } as any],
    }) as ChatDebugError;

    expect(result.code).toBe('NO_MODEL');
  });

  test('returns sessionKey when provided', async () => {
    const { container } = await setup('session reply');
    const agent = container.get(ChatAgent) as ChatAgent;

    const result = await agent.debugRun({
      messages: [{ role: 'user', content: 'test' } as any],
      sessionKey: 'test-session-123',
    }) as ChatDebugResponse;

    expect(result.sessionKey).toBe('test-session-123');
  });
});

describe('toolResultMap extraction logic', () => {
  function extractToolCallsFromSteps(steps: any[], traceOptions?: any): any[] {
    const toolResultMap = new Map<string, any>();
    for (const step of steps) {
      for (const tr of step.toolResults ?? []) {
        const id = tr?.toolCallId ?? tr?.id;
        if (id) toolResultMap.set(id, tr);
      }
    }

    const toolCalls: any[] = [];
    for (const step of steps) {
      for (const rawCall of step.toolCalls ?? []) {
        const toolCall = rawCall as any;
        const name = toolCall.toolName ?? toolCall.function?.name ?? toolCall.name;
        const args = toolCall.args ?? toolCall.input ?? {};
        let status = 'success';
        let resultPreview: unknown;
        let error: string | undefined;

        const matchedResult = toolResultMap.get(toolCall.toolCallId ?? toolCall.id);

        if (toolCall.isConfirmationBlocked || toolCall.confirmationRequired) {
          status = 'blocked';
          resultPreview = matchedResult?.result ?? args;
        } else if (matchedResult && matchedResult.isError) {
          status = 'error';
          error = typeof matchedResult.result === 'string'
            ? matchedResult.result
            : matchedResult.result?.message ?? 'Unknown error';
          resultPreview = matchedResult.result;
        } else {
          resultPreview = matchedResult?.result ?? toolCall.result ?? toolCall.output ?? {};
        }

        toolCalls.push({ toolName: name, args, status, resultPreview, error });
      }
    }
    return toolCalls;
  }

  test('reads tool results from step.toolResults matched by toolCallId', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'c1', toolName: 'search', args: { q: 'shoes' } },
        ],
        toolResults: [
          { toolCallId: 'c1', result: { products: ['Nike', 'Adidas'] }, isError: false },
        ],
      },
    ];

    const calls = extractToolCallsFromSteps(steps);
    expect(calls.length).toBe(1);
    expect(calls[0].toolName).toBe('search');
    expect(calls[0].status).toBe('success');
    expect((calls[0].resultPreview as any).products).toEqual(['Nike', 'Adidas']);
  });

  test('captures error status from toolResults with isError=true', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'e1', toolName: 'fail_tool', args: {} },
        ],
        toolResults: [
          { toolCallId: 'e1', result: 'Something went wrong', isError: true },
        ],
      },
    ];

    const calls = extractToolCallsFromSteps(steps);
    expect(calls[0].status).toBe('error');
    expect(calls[0].error).toBe('Something went wrong');
  });

  test('handles blocked tools', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'b1', toolName: 'delete_all', args: {}, isConfirmationBlocked: true },
        ],
        toolResults: [],
      },
    ];

    const calls = extractToolCallsFromSteps(steps);
    expect(calls[0].status).toBe('blocked');
  });

  test('handles multiple steps with different tool calls', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 's1c1', toolName: 'step1_tool', args: { a: 1 } },
        ],
        toolResults: [
          { toolCallId: 's1c1', result: { step: 1 }, isError: false },
        ],
      },
      {
        toolCalls: [
          { toolCallId: 's2c1', toolName: 'step2_tool', args: { b: 2 } },
        ],
        toolResults: [
          { toolCallId: 's2c1', result: { step: 2 }, isError: false },
        ],
      },
    ];

    const calls = extractToolCallsFromSteps(steps);
    expect(calls.length).toBe(2);
    expect(calls[0].toolName).toBe('step1_tool');
    expect(calls[1].toolName).toBe('step2_tool');
    expect((calls[0].resultPreview as any).step).toBe(1);
    expect((calls[1].resultPreview as any).step).toBe(2);
  });

  test('falls back to toolCall.result when no matching toolResult', () => {
    const steps = [
      {
        toolCalls: [
          { toolCallId: 'f1', toolName: 'legacy_tool', args: {}, result: { legacy: true } },
        ],
        toolResults: [],
      },
    ];

    const calls = extractToolCallsFromSteps(steps);
    expect(calls.length).toBe(1);
    expect((calls[0].resultPreview as any).legacy).toBe(true);
  });

  test('handles empty steps gracefully', () => {
    const calls = extractToolCallsFromSteps([]);
    expect(calls).toEqual([]);
  });
});
