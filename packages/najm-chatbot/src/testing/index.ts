import 'reflect-metadata';
import { Server, Controller, Get } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { chatbot } from '../ChatbotPlugin';
import { ChatAgent } from '../agent/ChatAgent';
import { AiSettingsService } from '../ai-settings/AiSettingsService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { aiSettingsTable, chatSessionsTable } from '../schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';
import { MockLanguageModelV1 } from 'ai/test';
import { simulateReadableStream } from 'ai';

export interface TestChatbotOptions {
  cannedText?: string | string[];
  toolCalls?: TestToolCallScript[];
  port?: number;
  chatbotConfig?: Record<string, any>;
}

export interface TestToolCallScript {
  toolName: string;
  args?: Record<string, unknown> | string;
  toolCallId?: string;
}

export interface TestChatbotResult {
  server: Server;
  port: number;
  container: any;
  chatAgent: ChatAgent;
  aiSettings: AiSettingsService;
}

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createInMemorySchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, session_key TEXT UNIQUE, user_id TEXT, channel TEXT DEFAULT 'web', messages TEXT, title TEXT, message_count INTEGER NOT NULL DEFAULT 0, last_message_at TEXT, expires_at TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT REFERENCES roles(id), last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
}

function normalizeTexts(cannedText: string | string[] | undefined): string[] {
  const texts = Array.isArray(cannedText) ? cannedText : [cannedText ?? 'test reply'];
  return texts.length ? texts : [''];
}

function normalizeToolCalls(scripts: TestToolCallScript[] | undefined) {
  return (scripts ?? []).map((script, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: script.toolCallId ?? `tool-call-${index + 1}`,
    toolName: script.toolName,
    args: typeof script.args === 'string' ? script.args : JSON.stringify(script.args ?? {}),
  }));
}

export function scriptedModel(input: string | Pick<TestChatbotOptions, 'cannedText' | 'toolCalls'> = 'test reply') {
  const options = typeof input === 'string' ? { cannedText: input } : input;
  const texts = normalizeTexts(options.cannedText);
  const toolCalls = normalizeToolCalls(options.toolCalls);
  let streamCalls = 0;
  let generateCalls = 0;
  let textIndex = 0;

  const nextText = () => texts[Math.min(textIndex++, texts.length - 1)] ?? '';

  return new MockLanguageModelV1({
    doStream: async () => {
      const emitToolCalls = streamCalls++ === 0 && toolCalls.length > 0;
      const chunks: any[] = emitToolCalls
        ? [
            ...toolCalls,
            { type: 'finish' as const, finishReason: 'tool-calls' as const, logprobs: undefined, usage: { completionTokens: 1, promptTokens: 1 } },
          ]
        : [
            { type: 'text-delta' as const, textDelta: nextText() },
            { type: 'finish' as const, finishReason: 'stop' as const, logprobs: undefined, usage: { completionTokens: 1, promptTokens: 1 } },
          ];

      return {
        stream: simulateReadableStream({ chunks }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    doGenerate: async () => {
      const emitToolCalls = generateCalls++ === 0 && toolCalls.length > 0;

      return {
        text: emitToolCalls ? '' : nextText(),
        toolCalls: emitToolCalls ? toolCalls.map(({ type, ...call }) => call) : undefined,
        finishReason: emitToolCalls ? 'tool-calls' as const : 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

export async function createTestChatbot(options: TestChatbotOptions = {}): Promise<TestChatbotResult> {
  const { cannedText = 'test reply', port = 0 } = options;

  const sqlite = new Database(':memory:');
  createInMemorySchema(sqlite);

  const schema = {
    aiSettings: aiSettingsTable,
    chatSessions: chatSessionsTable,
    users: usersTable,
    roles: rolesTable,
    tokens: tokensTable,
    permissions: permissionsTable,
    rolePermissions: rolePermissionsTable,
  };

  const db = drizzle(sqlite, { schema });

  @Controller('/_noop')
  class Noop {
    @Get() ok() { return { ok: true }; }
  }

  const srv = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(mcp({ name: 'test-chatbot', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', ...options.chatbotConfig }))
    .load(Noop);

  const selectedPort = port || (3500 + Math.floor(Math.random() * 500));
  await srv.listen(selectedPort);

  const container = (srv as any).container;
  const aiSettings = container.get(AiSettingsService) as AiSettingsService;
  await aiSettings.upsert({
    provider: 'openai',
    apiKey: 'sk-fake-unused',
    model: 'gpt-test',
    isEnabled: true,
  } as any);

  const chatAgent = container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
  chatAgent.buildModel = () => scriptedModel({ cannedText, toolCalls: options.toolCalls });

  return { server: srv, port: selectedPort, container, chatAgent, aiSettings };
}
