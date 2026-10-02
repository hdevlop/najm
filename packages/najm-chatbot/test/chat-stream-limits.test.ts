import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Controller, Get } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { chatbot, type ChatbotConfig } from '../src/ChatbotPlugin';
import { ChatAgent } from '../src/agent/ChatAgent';
import { normalizeUsage } from '../src/agent/modelPricing';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createCredentialSetupTables } from './auth-test-schema';
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
  createCredentialSetupTables(sqlite);
}

let server: Server | undefined;
let port = 3640;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function setup(model: MockLanguageModelV1, config: ChatbotConfig = {}) {
  const p = ++port;
  const sqlite = new Database(':memory:');
  createSchema(sqlite);

  @Controller('/_noop')
  class Noop {
    @Get() ok() { return { ok: true }; }
  }

  server = new Server({ isolated: true })
    .use(database({ default: drizzle(sqlite, { schema }) }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(chatbot({ dialect: 'sqlite', ...config }))
    .load(Noop);
  await server.listen(p);

  const container = (server as any).container;
  await (container.get(AiSettingsService) as AiSettingsService).upsert({
    provider: 'openrouter',
    apiKey: 'sk-fake-unused',
    model: 'openai/gpt-oss-120b',
    isEnabled: true,
  } as any);
  (container.get(ChatAgent) as any).buildModel = () => model;

  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!', name: 'U' }),
  });
  const login = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
  });
  return { p, token: (await login.json()).data.accessToken as string };
}

async function chat(p: number, token: string) {
  const started = performance.now();
  const res = await fetch(`http://localhost:${p}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });
  const body = await res.text();
  const events = body.split('\n\n')
    .map((event) => event.replace(/^data: /, '').trim())
    .filter((data) => data && data !== '[DONE]')
    .map((data) => JSON.parse(data));
  return { status: res.status, body, events, elapsedMs: performance.now() - started };
}

describe('streamed answer limits', () => {
  test('ends a provider stream that goes silent mid-answer', async () => {
    const stalled = new MockLanguageModelV1({
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        // One delta, then nothing: never finishes or closes on its own. Like a
        // fetch body, it errors when the request's signal aborts.
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'partial answer' });
            abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const { p, token } = await setup(stalled, { streamTimeout: { chunkMs: 200 } });

    const result = await chat(p, token);

    expect(result.status).toBe(200);
    expect(result.elapsedMs).toBeLessThan(5_000);
    expect(result.body).toContain('partial answer');
    expect(result.events.some((event) => event.type === 'error' || event.type === 'abort')).toBe(true);
    expect(result.events.some((event) => event.type === 'finish' && event.finishReason === 'stop')).toBe(false);
  });

  test('defaults the stall limit to 60 seconds', async () => {
    const { p } = await setup(new MockLanguageModelV1());
    void p;
    const agent = (server as any).container.get(ChatAgent) as { config: ChatbotConfig };
    expect(agent.config.streamTimeout).toEqual({ chunkMs: 60_000 });
  });

  test('reports aggregate token usage and cost on the finish event', async () => {
    const answer = new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'done' },
            { type: 'finish', finishReason: 'stop', logprobs: undefined, usage: { promptTokens: 1_000, completionTokens: 200 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const { p, token } = await setup(answer);

    const { events } = await chat(p, token);
    const finish = events.find((event) => event.type === 'finish');

    expect(finish?.messageMetadata).toMatchObject({
      promptTokens: 1_000,
      completionTokens: 200,
      totalTokens: 1_200,
      pricingFound: true,
      provider: 'openrouter',
      model: 'openai/gpt-oss-120b',
      currency: 'USD',
    });
    expect(finish.messageMetadata.totalCost).toBeCloseTo((1_000 * 0.039 + 200 * 0.19) / 1_000_000, 12);
  });
});

describe('normalizeUsage', () => {
  test('reads AI SDK v5+ names', () => {
    expect(normalizeUsage({ inputTokens: 12, outputTokens: 3 })).toEqual({ promptTokens: 12, completionTokens: 3 });
  });

  test('still accepts legacy names', () => {
    expect(normalizeUsage({ promptTokens: 5, completionTokens: 1 })).toEqual({ promptTokens: 5, completionTokens: 1 });
  });

  test('prefers v5+ names when both are present', () => {
    expect(normalizeUsage({ inputTokens: 9, outputTokens: 2, promptTokens: 1, completionTokens: 1 }))
      .toEqual({ promptTokens: 9, completionTokens: 2 });
  });

  test('returns null when nothing usable was reported', () => {
    expect(normalizeUsage(undefined)).toBeNull();
    expect(normalizeUsage({})).toBeNull();
    expect(normalizeUsage({ inputTokens: 0, outputTokens: 0 })).toBeNull();
    expect(normalizeUsage({ inputTokens: Number.NaN, outputTokens: 1 })).toBeNull();
  });
});
