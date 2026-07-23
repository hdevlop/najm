import 'reflect-metadata';
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { Server, Controller, Get } from 'najm-core';
import { database } from 'najm-database';
import { auth, EncryptionService } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { rag, ToolRouterService } from 'najm-rag';
import { chatbot } from '../../src/ChatbotPlugin';
import { ChatAgent } from '../../src/agent/ChatAgent';
import { AiSettingsService } from '../../src/ai-settings/AiSettingsService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { aiSettingsTable } from '../../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';
import { chatbotToolEmbeddingsTable, chatbotToolSemanticsTable } from 'najm-rag/sqlite';
import { MockLanguageModelV1 } from 'ai/test';
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
  chatbotToolEmbeddings: chatbotToolEmbeddingsTable,
  chatbotToolSemantics: chatbotToolSemanticsTable,
};

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT REFERENCES roles(id), last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_tool_embeddings (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL UNIQUE, description TEXT NOT NULL, "group" TEXT, local_name TEXT, arg_names TEXT, annotations TEXT, fingerprint TEXT NOT NULL, embedding BLOB, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'und', source TEXT, embedding BLOB, created_at TEXT, updated_at TEXT)`);
}

let server: Server | undefined;
let port = 3700;

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
  cannedText = 'hello from rag',
): Promise<{ port: number; routerMock: ReturnType<typeof mock> }> {
  const p = ++port;
  const sqlite = new Database(':memory:');
  createSchema(sqlite);
  const db = drizzle(sqlite, { schema });

  @Controller('/_noop')
  class Noop {
    @Get() ok() {
      return { ok: true };
    }
  }

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(
      auth({
        dialect: 'sqlite',
        jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
        encryptionKey: ENCRYPTION_KEY,
      }),
    )
    .use(mcp({ name: 'rag-delegation-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(rag({ dialect: 'sqlite', toolRouting: { enabled: true } }))
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

  const router = container.get(ToolRouterService) as ToolRouterService;
  const routerMock = mock(() => Promise.resolve({ status: 'routed' as const, tools: [] as any[] }));
  router.findRelevantTools = routerMock;

  const { TOOL_PROVIDER } = await import('najm-mcp');
  
  const byToken = container.get(TOOL_PROVIDER);
  if (router !== byToken) {
    throw new Error(`Alias mismatch! router=${router?.constructor?.name}, byToken=${byToken?.constructor?.name}, same=${router === byToken}`);
  }

  return { port: p, routerMock };
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

describe('Chatbot + RAG delegation', () => {
  test('plain chatbot() delegates tool selection to rag() provider', async () => {
    const { port: p, routerMock } = await setup('rag-delegated-reply');
    const token = await registerAndLogin(p);

    const res = await fetch(`http://localhost:${p}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(routerMock).toHaveBeenCalledTimes(1);
  });

  test('chatbot({ tools: none }) bypasses rag provider', async () => {
    const p = ++port;
    const sqlite = new Database(':memory:');
    createSchema(sqlite);
    const db = drizzle(sqlite, { schema });

    @Controller('/_noop')
    class Noop {
      @Get() ok() {
        return { ok: true };
      }
    }

    server = new Server({ isolated: true })
      .use(database({ default: db }))
      .use(
        auth({
          dialect: 'sqlite',
          jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
          encryptionKey: ENCRYPTION_KEY,
        }),
      )
      .use(mcp({ name: 'rag-none-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
      .use(rag({ dialect: 'sqlite', toolRouting: { enabled: true } }))
      .use(chatbot({ dialect: 'sqlite', tools: 'none' }))
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
    agent.buildModel = () => scriptedModel('no-tools-reply');

    const router = container.get(ToolRouterService) as ToolRouterService;
    const routerMock = mock(() => Promise.resolve({ status: 'routed' as const, tools: [] as any[] }));
    router.findRelevantTools = routerMock;

    const token = await registerAndLogin(p);

    const res = await fetch(`http://localhost:${p}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(200);
    expect(routerMock).toHaveBeenCalledTimes(0);
  });
});
