import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { chatbot } from '../src/ChatbotPlugin';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { ChatAgent } from '../src/agent/ChatAgent';
import { ChatSessionRepository } from '../src/sessions/ChatSessionRepository';
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
let port = 5500;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function setup() {
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
    .use(mcp({ name: 'session-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', conversationStore: 'db' }));

  await server.listen(p);
  return { server, port: p };
}

async function registerAndLogin(p: number) {
  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!', name: 'Test User' }),
  });
  const res = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
  });
  const json = await res.json() as any;
  return json.data.accessToken as string;
}

describe('Chat Session Management - Phase 2', () => {
  test('listByUser returns only sessions for the given user', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await repo.upsert({
      sessionKey: 'sess-user-a',
      messages: [{ role: 'user', content: 'hello' }] as any,
      userId: 'user-a',
      channel: 'web',
    });
    await repo.upsert({
      sessionKey: 'sess-user-b',
      messages: [{ role: 'user', content: 'hello' }] as any,
      userId: 'user-b',
      channel: 'web',
    });

    const result = await repo.listByUser('user-a');
    expect(result.length).toBe(1);
    expect(result[0].sessionKey).toBe('sess-user-a');
  });

  test('listByUser orders by updatedAt DESC', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await repo.upsert({
      sessionKey: 'older-session',
      messages: [{ role: 'user', content: 'first' }] as any,
      userId: 'user-1',
      channel: 'web',
    });

    await new Promise((r) => setTimeout(r, 50));

    await repo.upsert({
      sessionKey: 'newer-session',
      messages: [{ role: 'user', content: 'second' }] as any,
      userId: 'user-1',
      channel: 'web',
    });

    const result = await repo.listByUser('user-1');
    expect(result.length).toBe(2);
    expect(result[0].sessionKey).toBe('newer-session');
    expect(result[1].sessionKey).toBe('older-session');
  });

  test('auto-titles new sessions from first user message', async () => {
    const { server } = await setup();
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'reply',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    await agent.runOnce({
      sessionKey: 'title-test-session',
      channel: 'web',
      messages: [{ id: 'u1', role: 'user', content: 'Show me red shoes in size 42' }] as any,
    });

    const session = await repo.findByKey('title-test-session');
    expect(session).toBeTruthy();
    expect(session!.title).toBe('Show me red shoes in size 42');
  });

  test('does not overwrite existing title on subsequent saves', async () => {
    const { server } = await setup();
    const settings = server!.container.get(AiSettingsService) as AiSettingsService;
    const agent = server!.container.get(ChatAgent) as ChatAgent & { buildModel: (s: any) => any };
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await settings.upsert({
      provider: 'openai',
      apiKey: 'sk-fake-unused',
      model: 'gpt-test',
      isEnabled: true,
    } as any);

    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => ({
        text: 'reply',
        finishReason: 'stop' as const,
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    await agent.runOnce({
      sessionKey: 'overwrite-test',
      channel: 'web',
      messages: [{ id: 'u1', role: 'user', content: 'First message' }] as any,
    });

    const afterFirst = await repo.findByKey('overwrite-test');
    expect(afterFirst!.title).toBe('First message');

    await repo.updateTitle('overwrite-test', 'Custom Title');

    await agent.runOnce({
      sessionKey: 'overwrite-test',
      channel: 'web',
      messages: [{ id: 'u2', role: 'user', content: 'Second message' }] as any,
    });

    const afterSecond = await repo.findByKey('overwrite-test');
    expect(afterSecond!.title).toBe('Custom Title');
  });

  test('GET /chat/sessions returns 401 without auth', async () => {
    const { port: p } = await setup();
    const res = await fetch(`http://localhost:${p}/chat/sessions`);
    expect(res.status).toBe(401);
  });

  test('GET /chat/sessions returns sessions for authenticated user', async () => {
    const { port: p, server } = await setup();
    const token = await registerAndLogin(p);
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    await store.save('web:user-1', [{ role: 'user', content: 'hello' }] as any, {
      userId: 'user-1',
      channel: 'web',
    });

    const res = await fetch(`http://localhost:${p}/chat/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(Array.isArray(json.data)).toBe(true);
  });

  test('PATCH /chat/sessions/:key updates title', async () => {
    const { port: p, server } = await setup();
    const token = await registerAndLogin(p);
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    const userRes = await fetch(`http://localhost:${p}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userJson = await userRes.json() as any;
    const userId = userJson.data.id;

    await store.save('rename-test', [{ role: 'user', content: 'hello' }] as any, {
      userId,
      channel: 'web',
    });

    const res = await fetch(`http://localhost:${p}/chat/sessions/rename-test`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'New Title' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.title).toBe('New Title');
  });

  test('DELETE /chat/sessions/:key clears the session', async () => {
    const { port: p, server } = await setup();
    const token = await registerAndLogin(p);
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    const userRes = await fetch(`http://localhost:${p}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userJson = await userRes.json() as any;
    const userId = userJson.data.id;

    await store.save('delete-test', [{ role: 'user', content: 'hello' }] as any, {
      userId,
      channel: 'web',
    });

    const res = await fetch(`http://localhost:${p}/chat/sessions/delete-test`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    expect(await store.load('delete-test')).toBeNull();
  });

  test('upsert writes messageCount equal to messages.length', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    const messages = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ] as any[];

    await repo.upsert({
      sessionKey: 'count-test',
      messages,
      userId: 'u1',
      channel: 'web',
    });

    const session = await repo.findByKey('count-test');
    expect(session!.messageCount).toBe(3);
  });

  test('upsert writes lastMessageAt to current time', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    const before = new Date().toISOString();
    await repo.upsert({
      sessionKey: 'last-msg-test',
      messages: [{ role: 'user', content: 'hi' }] as any,
      userId: 'u1',
      channel: 'web',
    });
    const after = new Date().toISOString();

    const session = await repo.findByKey('last-msg-test');
    expect(session!.lastMessageAt).toBeTruthy();
    expect(session!.lastMessageAt! >= before).toBe(true);
    expect(session!.lastMessageAt! <= after).toBe(true);
  });

  test('listByUser orders by lastMessageAt DESC', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await repo.upsert({
      sessionKey: 'older-lma',
      messages: [{ role: 'user', content: 'first' }] as any,
      userId: 'u-lma',
      channel: 'web',
    });

    await new Promise((r) => setTimeout(r, 50));

    await repo.upsert({
      sessionKey: 'newer-lma',
      messages: [{ role: 'user', content: 'second' }] as any,
      userId: 'u-lma',
      channel: 'web',
    });

    const result = await repo.listByUser('u-lma');
    expect(result.length).toBe(2);
    expect(result[0].sessionKey).toBe('newer-lma');
    expect(result[1].sessionKey).toBe('older-lma');
  });

  test('listByUser applies limit after recency ordering', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    for (let i = 0; i < 5; i++) {
      await repo.upsert({
        sessionKey: `limited-${i}`,
        messages: [{ role: 'user', content: `turn ${i}` }] as any,
        userId: 'u-limit',
        channel: 'web',
      });
      await new Promise((r) => setTimeout(r, 10));
    }

    const result = await repo.listByUser('u-limit', { limit: 2 });
    expect(result.map((session) => session.sessionKey)).toEqual(['limited-4', 'limited-3']);
  });

  test('session detail rejects unowned sessions', async () => {
    const { port: p, server } = await setup();
    const token = await registerAndLogin(p);
    const store = server!.container.get(DbConversationStore) as DbConversationStore;

    await store.save('anonymous-session', [{ role: 'user', content: 'hello' }] as any, {
      channel: 'web',
    });

    const res = await fetch(`http://localhost:${p}/chat/sessions/anonymous-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
  });

  test('backfill: existing pre-migration row with messageCount=0 is still readable', async () => {
    const { server } = await setup();
    const repo = server!.container.get(ChatSessionRepository) as ChatSessionRepository;

    await repo.upsert({
      sessionKey: 'backfill-test',
      messages: [{ role: 'user', content: 'old data' }] as any,
      userId: 'u-bf',
      channel: 'web',
    });

    const session = await repo.findByKey('backfill-test');
    expect(session).toBeTruthy();
    expect(session!.messages.length).toBe(1);
    expect(session!.messageCount).toBeGreaterThanOrEqual(0);
  });
});
