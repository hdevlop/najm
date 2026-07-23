import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { simulateReadableStream } from 'ai';
import { chatbot, type ChatbotConfig } from '../src/ChatbotPlugin';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { ChatAgent } from '../src/agent/ChatAgent';
import { ChatSessionCleanupService } from '../src/sessions/ChatSessionCleanupService';
import {
  CacheConversationStore,
  DbConversationStore,
} from '../src/sessions/ConversationStore';
import { aiSettingsTable, chatSessionsTable } from '../src/schema/sqlite';
import {
  usersTable,
  rolesTable,
  tokensTable,
  permissionsTable,
  rolePermissionsTable,
} from 'najm-auth/sqlite';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const schema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
  users: usersTable,
  roles: rolesTable,
  tokens: tokensTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable,
};

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama',
    api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1',
    system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1,
    use_memory INTEGER NOT NULL DEFAULT 1,
    max_stored_messages INTEGER,
    max_prompt_messages INTEGER,
    created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, session_key TEXT NOT NULL UNIQUE,
    user_id TEXT, channel TEXT NOT NULL DEFAULT 'web',
    messages TEXT NOT NULL, title TEXT, message_count INTEGER NOT NULL DEFAULT 0, last_message_at TEXT,
    expires_at TEXT, created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0, password TEXT NOT NULL,
    image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active',
    role_id TEXT REFERENCES roles(id), last_login TEXT,
    failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT,
    previous_valid_until TEXT, previous_used_at TEXT,
    type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active',
    expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
    resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TEXT, updated_at TEXT
  )`);
}

let server: Server | undefined;
let port = 3600;

async function setup(config: Partial<ChatbotConfig> = {}) {
  const p = ++port;
  const sqlite = new Database(':memory:');
  createSchema(sqlite);
  const db = drizzle(sqlite, { schema });

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(mcp({ name: 'conversation-store-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', ...config }));

  await server.listen(p);
  return { server, db, sqlite, port: p };
}

function message(id: string, content: string) {
  return {
    id,
    role: 'user' as const,
    content,
    parts: [{ type: 'text' as const, text: content }],
  };
}

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('ConversationStore', () => {
  test('DbConversationStore saves, loads, and clears messages', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const store = server.container.get(DbConversationStore) as DbConversationStore;
    const messages = [message('m1', 'hello db')];

    await store.save('db-session', messages as any, { userId: 'user-1', channel: 'web' });

    const loaded = await store.load('db-session');
    expect(loaded).toEqual(messages);

    await store.clear('db-session');
    expect(await store.load('db-session')).toBeNull();
  });

  test('CacheConversationStore saves, loads, and clears messages', async () => {
    const { server } = await setup({ conversationStore: 'cache', sessionTtl: 10_000 });
    const store = server.container.get(CacheConversationStore) as CacheConversationStore;
    const messages = [message('m1', 'hello cache')];

    await store.save('cache-session', messages as any, { userId: 'user-2', channel: 'whatsapp' });

    const loaded = await store.load('cache-session');
    expect(loaded).toEqual(messages);

    await store.clear('cache-session');
    expect(await store.load('cache-session')).toBeNull();
  });

  test('cleanup removes expired database sessions', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const store = server.container.get(DbConversationStore) as DbConversationStore;
    const cleanup = server.container.get(ChatSessionCleanupService) as ChatSessionCleanupService;

    await store.save('expired-session', [message('m1', 'old')] as any, {
      channel: 'web',
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await store.load('expired-session')).toBeNull();

    await store.save('expired-session-2', [message('m2', 'old too')] as any, {
      channel: 'web',
      expiresAt: new Date(Date.now() - 1000),
    });

    const deleted = await cleanup.cleanup();
    expect(deleted).toBe(1);
    expect(await store.load('expired-session-2')).toBeNull();
  });

  test('ChatAgent persists and reloads a session when sessionKey is provided', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const settings = server.container.get(AiSettingsService) as AiSettingsService;
    const agent = server.container.get(ChatAgent) as ChatAgent & { buildModel: (settings: any) => any };
    const store = server.container.get(DbConversationStore) as DbConversationStore;
    const prompts: unknown[] = [];

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          text: prompts.length === 1 ? 'first reply' : 'second reply',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({
      sessionKey: 'agent-session',
      channel: 'web',
      messages: [message('u1', 'first turn') as any],
    });

    const savedAfterFirst = await store.load('agent-session');
    expect(JSON.stringify(savedAfterFirst)).toContain('first turn');
    expect(JSON.stringify(savedAfterFirst)).toContain('first reply');

    await agent.runOnce({
      sessionKey: 'agent-session',
      channel: 'web',
      messages: [message('u2', 'second turn') as any],
    });

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).toContain('first turn');
    expect(secondPrompt).toContain('first reply');
    expect(secondPrompt).toContain('second turn');
  });

  test('ChatAgent keeps DeepSeek-compatible providers stateless to avoid reasoning_content replay errors', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const settings = server.container.get(AiSettingsService) as AiSettingsService;
    const agent = server.container.get(ChatAgent) as ChatAgent & { buildModel: (settings: any) => any };
    const store = server.container.get(DbConversationStore) as DbConversationStore;
    const prompts: unknown[] = [];

    await settings.upsert({
      provider: 'opencode',
      apiKey: 'sk-fake-unused',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-flash',
      isEnabled: true,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          text: prompts.length === 1 ? 'first reply' : 'second reply',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({
      sessionKey: 'deepseek-session',
      channel: 'web',
      messages: [message('u1', 'first turn') as any],
    });

    expect(await store.load('deepseek-session')).toBeNull();

    await agent.runOnce({
      sessionKey: 'deepseek-session',
      channel: 'web',
      messages: [message('u2', 'second turn') as any],
    });

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).not.toContain('first turn');
    expect(secondPrompt).not.toContain('first reply');
    expect(secondPrompt).toContain('second turn');
  });

  test('ChatAgent skips session memory when settings disable it', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const settings = server.container.get(AiSettingsService) as AiSettingsService;
    const agent = server.container.get(ChatAgent) as ChatAgent & { buildModel: (settings: any) => any };
    const store = server.container.get(DbConversationStore) as DbConversationStore;
    const prompts: unknown[] = [];

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
      useMemory: false,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          text: prompts.length === 1 ? 'first reply' : 'second reply',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({
      sessionKey: 'memory-off-session',
      channel: 'web',
      messages: [message('u1', 'first turn') as any],
    });

    expect(await store.load('memory-off-session')).toBeNull();

    await agent.runOnce({
      sessionKey: 'memory-off-session',
      channel: 'web',
      messages: [message('u2', 'second turn') as any],
    });

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).not.toContain('first turn');
    expect(secondPrompt).not.toContain('first reply');
    expect(secondPrompt).toContain('second turn');
  });

  test('ChatAgent stream persists the completed response on finish', async () => {
    const { server } = await setup({ conversationStore: 'db' });
    const settings = server.container.get(AiSettingsService) as AiSettingsService;
    const agent = server.container.get(ChatAgent) as ChatAgent & { buildModel: (settings: any) => any };
    const store = server.container.get(DbConversationStore) as DbConversationStore;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'stream reply' },
            {
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
              usage: { completionTokens: 1, promptTokens: 1 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const response = await agent.stream({
      sessionKey: 'stream-session',
      channel: 'web',
      messages: [message('u1', 'stream turn') as any],
    });
    expect(response.status).toBe(200);
    await response.text();

    const saved = await store.load('stream-session');
    expect(JSON.stringify(saved)).toContain('stream turn');
    expect(JSON.stringify(saved)).toContain('stream reply');
  });
});
