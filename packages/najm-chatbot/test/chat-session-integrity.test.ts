import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { jsonSchema, tool } from 'ai';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth, runAsUser } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createCredentialSetupTables } from './auth-test-schema';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { chatbot, type ChatbotConfig } from '../src/ChatbotPlugin';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { ChatAgent } from '../src/agent/ChatAgent';
import { CacheConversationStore, DbConversationStore } from '../src/sessions/ConversationStore';
import { ChatSessionRepository } from '../src/sessions/ChatSessionRepository';
import { aiSettingsTable, chatSessionsTable } from '../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';

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
  createCredentialSetupTables(sqlite);
}

let server: Server | undefined;
let port = 4700;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

// buildModel and prepare are not public, so they are re-declared rather than intersected.
type Agent = Pick<ChatAgent, 'runOnce' | 'stream'> & { buildModel: (s: any) => any; prepare: (...args: any[]) => Promise<any> };

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
    .use(mcp({ name: 'session-integrity-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', conversationStore: 'db', ...config }));

  await server.listen(p);

  const settings = server.container.get(AiSettingsService) as AiSettingsService;
  await settings.upsert({ provider: 'openai', apiKey: 'sk-fake-unused', model: 'gpt-test', isEnabled: true } as any);

  const agent = server.container.get(ChatAgent) as unknown as Agent;
  return { server, agent };
}

/** Gives the agent one real tool, keeping the rest of preparation as it is. */
function withTool(agent: Agent, name: string, execute: () => Promise<unknown>) {
  const original = agent.prepare.bind(agent);
  agent.prepare = async (...args: any[]) => ({
    ...(await original(...args)),
    tools: { [name]: tool({ inputSchema: jsonSchema({ type: 'object', properties: {} }), execute }) },
  });
}

function userMessage(id: string, text: string) {
  return { id, role: 'user' as const, parts: [{ type: 'text' as const, text }] };
}

function reply(text: string) {
  return { text, finishReason: 'stop' as const, usage: { promptTokens: 1, completionTokens: 1 } };
}

function callTool(toolName: string, id = 'call-1') {
  return {
    toolCalls: [{ toolCallId: id, toolName, args: '{}' }],
    finishReason: 'tool-calls' as const,
    usage: { promptTokens: 1, completionTokens: 1 },
  };
}

describe('chat memory after a tool call', () => {
  test('the next turn sends the stored call together with its result', async () => {
    const { server, agent } = await setup();
    withTool(agent, 'count_teachers', async () => ({ total: 42 }));
    const prompts: any[] = [];
    let call = 0;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        call++;
        if (call === 1) return callTool('count_teachers');
        if (call === 2) return reply('There are 42 teachers.');
        return reply('Yes, 42.');
      },
    });

    await agent.runOnce({ sessionKey: 'tool-memory', channel: 'web', messages: [userMessage('u1', 'How many teachers?')] });
    const second = await agent.runOnce({ sessionKey: 'tool-memory', channel: 'web', messages: [userMessage('u2', 'Sure?')] });

    expect(second).toBe('Yes, 42.');
    const followUp = prompts[2];
    const toolMessage = followUp.find((m: any) => m.role === 'tool');
    expect(toolMessage?.content[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'count_teachers',
      output: { type: 'json', value: { total: 42 } },
    });
    // The call comes before its result, and the final answer comes after both.
    const roles = followUp.filter((m: any) => m.role !== 'system').map((m: any) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant', 'user']);

    const stored = await (server!.container.get(DbConversationStore) as DbConversationStore).load('tool-memory');
    // One assistant message per turn, not one per model step.
    expect(stored!.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    const toolPart = (stored![1].parts as any[]).find((p) => p.type === 'tool-count_teachers');
    expect(toolPart).toMatchObject({ toolCallId: 'call-1', state: 'output-available', output: { total: 42 } });
  });

  test('a failed tool call is stored as an error and replayed as one', async () => {
    const { server, agent } = await setup();
    withTool(agent, 'count_teachers', async () => { throw new Error('database offline'); });
    const prompts: any[] = [];
    let call = 0;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        call++;
        if (call === 1) return callTool('count_teachers');
        return reply('Could not count them.');
      },
    });

    await agent.runOnce({ sessionKey: 'tool-error', channel: 'web', messages: [userMessage('u1', 'How many teachers?')] });
    await agent.runOnce({ sessionKey: 'tool-error', channel: 'web', messages: [userMessage('u2', 'Try again?')] });

    const stored = await (server!.container.get(DbConversationStore) as DbConversationStore).load('tool-error');
    const toolPart = (stored![1].parts as any[]).find((p) => p.type === 'tool-count_teachers');
    expect(toolPart).toMatchObject({ state: 'output-error', errorText: 'database offline' });
    const toolMessage = prompts[2].find((m: any) => m.role === 'tool');
    expect(toolMessage?.content[0].output).toEqual({ type: 'error-text', value: 'database offline' });
  });

  test('a session stored with an unanswered tool call still gets a reply', async () => {
    const { server, agent } = await setup();
    const store = server!.container.get(DbConversationStore) as DbConversationStore;
    // The shape earlier releases saved: the call without its result.
    await store.save('legacy-broken', [
      userMessage('u1', 'How many teachers?'),
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'tool-count_teachers', toolCallId: 'call-1', state: 'input-available', input: {} }],
      },
      { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'There are 42 teachers.' }] },
    ] as any, { channel: 'web' });
    const prompts: any[] = [];
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return reply('Yes.');
      },
    });

    const answer = await agent.runOnce({ sessionKey: 'legacy-broken', channel: 'web', messages: [userMessage('u2', 'Sure?')] });

    expect(answer).toBe('Yes.');
    const text = JSON.stringify(prompts[0]);
    expect(text).not.toContain('call-1');
    expect(text).toContain('There are 42 teachers.');
  });
});

describe('chat session ownership', () => {
  const alice = { id: 'user-alice', role: 'user' };
  const mallory = { id: 'user-mallory', role: 'user' };

  for (const conversationStore of ['db', 'cache'] as const) {
    test(`another user cannot load or take over a session (${conversationStore} store)`, async () => {
      const { server, agent } = await setup({ conversationStore });
      const container = server!.container;
      const prompts: string[] = [];
      agent.buildModel = () => new MockLanguageModelV1({
        doGenerate: async ({ prompt }: any) => {
          prompts.push(JSON.stringify(prompt));
          return reply('ok');
        },
      });

      await runAsUser(container, alice, () => agent.runOnce({
        sessionKey: 'wa:+15550001', channel: 'whatsapp', messages: [userMessage('u1', 'my secret order 991')],
      }));

      const attempt = runAsUser(container, mallory, () => agent.runOnce({
        sessionKey: 'wa:+15550001', channel: 'web', messages: [userMessage('m1', 'what did I say?')],
      }));
      await expect(attempt).rejects.toMatchObject({ status: 403 });

      // The model never saw Alice's history on Mallory's behalf.
      expect(prompts).toHaveLength(1);
      // Alice still owns the session and can continue it.
      const store = (conversationStore === 'db'
        ? container.get(DbConversationStore)
        : container.get(CacheConversationStore)) as DbConversationStore | CacheConversationStore;
      const session = await store.loadSession('wa:+15550001');
      expect(session?.userId).toBe('user-alice');
      expect(JSON.stringify(session?.messages)).not.toContain('what did I say?');

      const answer = await runAsUser(container, alice, () => agent.runOnce({
        sessionKey: 'wa:+15550001', channel: 'whatsapp', messages: [userMessage('u2', 'thanks')],
      }));
      expect(answer).toBe('ok');
      expect(prompts[1]).toContain('my secret order 991');
    });
  }

  test('a signed-in user cannot load a session saved without an owner', async () => {
    const { server, agent } = await setup();
    const container = server!.container;
    agent.buildModel = () => new MockLanguageModelV1({ doGenerate: async () => reply('ok') });

    await agent.runOnce({ sessionKey: 'anonymous', channel: 'whatsapp', messages: [userMessage('u1', 'hello')] });

    const attempt = runAsUser(container, mallory, () => agent.runOnce({
      sessionKey: 'anonymous', channel: 'web', messages: [userMessage('m1', 'hi')],
    }));
    await expect(attempt).rejects.toMatchObject({ status: 403 });
  });

  test('the stream endpoint path rejects before the model runs', async () => {
    const { server, agent } = await setup();
    const container = server!.container;
    let modelCalls = 0;
    agent.buildModel = () => new MockLanguageModelV1({
      doGenerate: async () => { modelCalls++; return reply('ok'); },
    });
    await runAsUser(container, alice, () => agent.runOnce({
      sessionKey: 'web-session', channel: 'web', messages: [userMessage('u1', 'hello')],
    }));

    const attempt = runAsUser(container, mallory, () => agent.stream({
      sessionKey: 'web-session', channel: 'web', messages: [userMessage('m1', 'hi')],
    }));
    await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(modelCalls).toBe(1);
  });

  test('saving never reassigns the owner of an existing row', async () => {
    const { server } = await setup();
    const repository = server!.container.get(ChatSessionRepository) as ChatSessionRepository;
    await repository.save({ sessionKey: 'owned', messages: [], userId: 'user-alice', channel: 'web' });
    await repository.save({ sessionKey: 'owned', messages: [userMessage('m1', 'x') as any], userId: 'user-mallory', channel: 'web' });

    const row = await repository.findByKey('owned');
    expect(row?.userId).toBe('user-alice');
  });
});
