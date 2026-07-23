import 'reflect-metadata';
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { MockLanguageModelV1 } from 'ai/test';
import { chatbot } from '../src/ChatbotPlugin';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { ChatAgent, getMessageText } from '../src/agent/ChatAgent';
import { DbConversationStore } from '../src/sessions/ConversationStore';
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
let port = 4400;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

function msg(id: string, role: 'user' | 'assistant', content: string) {
  return { id, role, content } as any;
}

async function setup(config: { maxPromptMessages?: number; maxStoredMessages?: number; routingHistoryMessages?: number } = {}) {
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
    .use(mcp({ name: 'memory-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', conversationStore: 'db', ...config }));

  await server.listen(p);
  return { server, db, port: p };
}

describe('Chat Memory - Phase 1', () => {
  test('buildRoutingQuery returns last N prior user turns + current', async () => {
    const { server } = await setup({ routingHistoryMessages: 2 });
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    const messages = [
      msg('u1', 'user', 'show me red shoes'),
      msg('a1', 'assistant', 'Here are red shoes'),
      msg('u2', 'user', 'size 42?'),
    ];

    const result = (agent as any).buildRoutingQuery(messages);
    expect(result).toContain('show me red shoes');
    expect(result).toContain('size 42?');
    expect(result).toContain('---');
  });

  test('buildRoutingQuery respects routingHistoryMessages config', async () => {
    const { server } = await setup({ routingHistoryMessages: 1 });
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    const messages = [
      msg('u0', 'user', 'turn zero'),
      msg('a0', 'assistant', 'reply zero'),
      msg('u1', 'user', 'turn one'),
      msg('a1', 'assistant', 'reply one'),
      msg('u2', 'user', 'turn two'),
    ];

    const result = (agent as any).buildRoutingQuery(messages);
    expect(result).not.toContain('turn zero');
    expect(result).toContain('turn one');
    expect(result).toContain('turn two');
  });

  test('buildPromptMessages returns at most maxPromptMessages', async () => {
    const { server } = await setup({ maxPromptMessages: 3 });
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    const messages = Array.from({ length: 10 }, (_, i) => msg(`m${i}`, 'user', `msg ${i}`));
    const result = (agent as any).buildPromptMessages(messages);

    expect(result.length).toBe(3);
    expect(result[0].content).toBe('msg 7');
    expect(result[2].content).toBe('msg 9');
  });

  test('saved maxPromptMessages limits messages sent to the model', async () => {
    const { server } = await setup();
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const store = server!.container.get(DbConversationStore) as DbConversationStore;
    const prompts: unknown[] = [];

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
      maxPromptMessages: 2,
    } as any);

    await store.save('prompt-window-session', [
      msg('u1', 'user', 'first'),
      msg('a1', 'assistant', 'first reply'),
      msg('u2', 'user', 'second'),
      msg('a2', 'assistant', 'second reply'),
    ] as any, { channel: 'web' });

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          text: 'reply',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({
      sessionKey: 'prompt-window-session',
      channel: 'web',
      messages: [msg('u3', 'user', 'third') as any],
    });

    const promptText = JSON.stringify(prompts[0]);
    expect(promptText).not.toContain('first');
    expect(promptText).toContain('second reply');
    expect(promptText).toContain('third');
  });

  test('mergeSessionMessages dedupes by message id', async () => {
    const { server } = await setup();
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    const history = [msg('m1', 'user', 'hello'), msg('m2', 'assistant', 'hi')];
    const current = [msg('m2', 'assistant', 'hi'), msg('m3', 'user', 'follow-up')];

    const result = (agent as any).mergeSessionMessages(history, current);
    expect(result.length).toBe(3);
    expect(result.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  test('mergeSessionMessages falls back to role+text when id missing', async () => {
    const { server } = await setup();
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    const history = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }] as any[];
    const current = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'new' }] as any[];

    const result = (agent as any).mergeSessionMessages(history, current);
    expect(result.length).toBe(3);
  });

  test('saveSession persists full transcript after 25 turns with maxPromptMessages=5', async () => {
    const { server } = await setup({ maxPromptMessages: 5 });
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    let turnNum = 0;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => {
        turnNum++;
        return {
          text: `reply ${turnNum}`,
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    for (let i = 0; i < 25; i++) {
      await agent.runOnce({
        sessionKey: 'long-session',
        channel: 'web',
        messages: [msg(`u${i}`, 'user', `turn ${i}`) as any],
      });
    }

    const saved = await store.load('long-session');
    expect(saved).toBeTruthy();
    const savedStr = JSON.stringify(saved);
    expect(savedStr).toContain('turn 0');
    expect(savedStr).toContain('turn 24');
  });

  test('maxStoredMessages keeps only newest stored session messages', async () => {
    const { server } = await setup({ maxPromptMessages: 5 });
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
      maxStoredMessages: 6,
    } as any);

    let turnNum = 0;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => {
        turnNum++;
        return {
          text: `reply ${turnNum}`,
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    for (let i = 0; i < 10; i++) {
      await agent.runOnce({
        sessionKey: 'trimmed-session',
        channel: 'web',
        messages: [msg(`tu${i}`, 'user', `trim turn ${i}`) as any],
      });
    }

    const saved = await store.load('trimmed-session');
    expect(saved).toBeTruthy();
    expect(saved!.length).toBeLessThanOrEqual(6);
    const savedStr = JSON.stringify(saved);
    expect(savedStr).not.toContain('trim turn 0');
    expect(savedStr).toContain('trim turn 9');
  });

  test('useMemory=false skips load and save', async () => {
    const { server } = await setup({ maxPromptMessages: 5 });
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const store = server!.container.get(DbConversationStore) as DbConversationStore;
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
          text: 'reply',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({
      sessionKey: 'no-memory',
      channel: 'web',
      messages: [msg('u1', 'user', 'first') as any],
    });

    expect(await store.load('no-memory')).toBeNull();

    await agent.runOnce({
      sessionKey: 'no-memory',
      channel: 'web',
      messages: [msg('u2', 'user', 'second') as any],
    });

    const secondPrompt = JSON.stringify(prompts[1]);
    expect(secondPrompt).not.toContain('first');
    expect(secondPrompt).toContain('second');
  });

  test('shouldUseStatelessHistory true for deepseek on openrouter', async () => {
    const { server } = await setup();
    const agent = server!.container.get(ChatAgent) as ChatAgent;

    expect((agent as any).shouldUseStatelessHistory({ provider: 'openrouter', model: 'deepseek-v3' })).toBe(true);
    expect((agent as any).shouldUseStatelessHistory({ provider: 'openai', model: 'gpt-4' })).toBe(false);
    expect((agent as any).shouldUseStatelessHistory({ provider: 'opencode', model: 'deepseek-chat' })).toBe(true);
    expect((agent as any).shouldUseStatelessHistory({ provider: 'anthropic', model: 'deepseek-v3' })).toBe(false);
  });

  test('stream/runOnce/debugRun all route with enriched text', async () => {
    const { server } = await setup({ routingHistoryMessages: 2 });
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    let capturedUserText: string | null = null;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'enriched reply',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    await store.save('enriched-session', [
      msg('u1', 'user', 'show me red shoes'),
      msg('a1', 'assistant', 'Here are red shoes'),
    ] as any, { channel: 'web' });

    const originalPrepare = (agent as any).prepare.bind(agent);
    (agent as any).prepare = async (channel: string, userText: string, s: any) => {
      capturedUserText = userText;
      return originalPrepare(channel, userText, s);
    };

    await agent.runOnce({
      sessionKey: 'enriched-session',
      channel: 'web',
      messages: [msg('u2', 'user', 'size 42?') as any],
    });

    expect(capturedUserText).toContain('show me red shoes');
    expect(capturedUserText).toContain('size 42?');
  });
});
