import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Controller, Get } from 'najm-core';
import { database } from 'najm-database';
import { auth, EncryptionService } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { chatbot } from '../src/ChatbotPlugin';
import { ChatAgent, type ChatAgentInput } from '../src/agent/ChatAgent';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { aiSettingsTable } from '../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { simulateReadableStream } from 'ai';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const schema = {
  aiSettings: aiSettingsTable,
  users: usersTable,
  roles: rolesTable,
  tokens: tokensTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable,
};

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT REFERENCES roles(id), last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
}

let server: Server | undefined;
let port = 3500;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

function scriptedModel(text: string) {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta', textDelta: text },
          { type: 'finish', finishReason: 'stop', logprobs: undefined, usage: { completionTokens: 1, promptTokens: 1 } },
        ],
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doGenerate: async () => ({
      text,
      finishReason: 'stop' as const,
      usage: { promptTokens: 1, completionTokens: 1 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

async function setup(
  cannedText = 'hello from the stub',
  options: { includeMcp?: boolean } = {},
): Promise<{ port: number }> {
  const p = ++port;
  const sqlite = new Database(':memory:');
  createSchema(sqlite);
  const db = drizzle(sqlite, { schema });

  @Controller('/_noop')
  class Noop {
    @Get() ok() { return { ok: true }; }
  }

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }));

  if (options.includeMcp !== false) {
    server.use(mcp({ name: 'stub', version: '1.0.0', path: '/mcp', transports: ['http'] }));
  }

  server
    .use(chatbot({ dialect: 'sqlite' }))
    .load(Noop);

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

  return { port: p };
}

async function registerAndLogin(p: number) {
  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!', name: 'U' }),
  });
  const res = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
  });
  return (await res.json()).data.accessToken as string;
}

describe('ChatAgent with stubbed model', () => {
  test('POST /chat streams back the scripted response body', async () => {
    const { port: p } = await setup('scripted-reply-xyz');
    const token = await registerAndLogin(p);

    const res = await fetch(`http://localhost:${p}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      full += decoder.decode(value);
    }
    expect(full).toContain('scripted-reply-xyz');
  });

  test('runOnce returns the scripted text', async () => {
    const { port: p } = await setup('once-reply-abc');
    const container = (server as any).container;
    const agent = container.get(ChatAgent) as ChatAgent;

    const text = await agent.runOnce({
      messages: [{ role: 'user', content: 'hi' } as any],
      channel: 'whatsapp',
    });
    expect(text).toBe('once-reply-abc');
  });

  test('works as chat-only when najm-mcp is not registered', async () => {
    const { port: p } = await setup('chat-only-reply', { includeMcp: false });
    const token = await registerAndLogin(p);

    const res = await fetch(`http://localhost:${p}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      full += decoder.decode(value);
    }
    expect(full).toContain('chat-only-reply');
  });

  test('channel arg selects the matching systemPromptByChannel entry', async () => {
    const { port: p } = await setup('ok');
    const container = (server as any).container;
    const agent = container.get(ChatAgent) as ChatAgent & { config: any };

    agent.config.systemPromptByChannel = { web: 'WEB-PROMPT', whatsapp: 'WA-PROMPT' };

    let capturedSystem: string | undefined;
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async ({ prompt }: any) => {
        capturedSystem = prompt.find((m: any) => m.role === 'system')?.content?.[0]?.text
          ?? prompt.find((m: any) => m.role === 'system')?.content;
        return {
          text: 'ok',
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    await agent.runOnce({ messages: [{ role: 'user', content: 'hi' } as any], channel: 'whatsapp' });
    expect(String(capturedSystem)).toContain('WA-PROMPT');

    await agent.runOnce({ messages: [{ role: 'user', content: 'hi' } as any], channel: 'web' });
    expect(String(capturedSystem)).toContain('WEB-PROMPT');
  });
});
