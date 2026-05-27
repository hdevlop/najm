import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp } from 'najm-mcp';
import { chatbot } from '../src/ChatbotPlugin';
import { EncryptionService } from 'najm-auth';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { aiSettingsTable } from '../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';

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

function createSchema(sqlite: Database, options: { legacyAiSettings?: boolean } = {}) {
  sqlite.exec(options.legacyAiSettings
    ? `CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama',
      api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1',
      system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT, updated_at TEXT
    )`
    : `CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama',
      api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1',
      system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1,
      use_memory INTEGER NOT NULL DEFAULT 1,
      max_stored_messages INTEGER,
      max_prompt_messages INTEGER,
      created_at TEXT, updated_at TEXT
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
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL, token_family TEXT, previous_hash TEXT,
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

let server: Server;
let db: any;
let rawSqlite: Database;
let port = 3300;

async function setup(options: { legacyAiSettings?: boolean } = {}): Promise<{ server: Server; db: any; port: number }> {
  const p = ++port;
  rawSqlite = new Database(':memory:');
  createSchema(rawSqlite, options);
  db = drizzle(rawSqlite, { schema });

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(mcp({ name: 'chatbot-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite' }));

  await server.listen(p);
  return { server, db, port: p };
}

async function registerAndLogin(
  p: number,
  email = 'admin@test.com',
  password = 'Password123!',
  opts?: { asAdmin?: boolean },
) {
  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Test User' }),
  });
  if (opts?.asAdmin) {
    rawSqlite.run(`INSERT OR IGNORE INTO roles (id, name) VALUES ('role_admin', 'admin')`);
    rawSqlite.run(`UPDATE users SET role_id = 'role_admin' WHERE email = '${email}'`);
  }
  const loginRes = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();
  return loginBody.data.accessToken as string;
}

afterEach(async () => {
  await server?.stop();
});

describe('najm-chatbot ai-settings', () => {
  test('legacy ai_settings table without memory columns is upgraded before read/write', async () => {
    const { port } = await setup({ legacyAiSettings: true });
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    const getRes = await fetch(`http://localhost:${port}/ai-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok).toBe(true);

    const postRes = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-test-secret-key',
        model: 'gpt-4o',
        useMemory: false,
        maxStoredMessages: 20,
        maxPromptMessages: 7,
      }),
    });
    expect(postRes.ok).toBe(true);
    const body = await postRes.json();
    expect(body.useMemory).toBe(false);
    expect(body.maxStoredMessages).toBe(20);
    expect(body.maxPromptMessages).toBe(7);

    const columns = rawSqlite.query('PRAGMA table_info(ai_settings)').all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === 'use_memory')).toBe(true);
    expect(columns.some((column) => column.name === 'max_stored_messages')).toBe(true);
    expect(columns.some((column) => column.name === 'max_prompt_messages')).toBe(true);
  });

  test('creating ai-settings defaults memory limits to 100 stored and 10 prompt messages', async () => {
    const { port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    const settingsRes = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test-secret-key', model: 'gpt-4o' }),
    });

    expect(settingsRes.ok).toBe(true);
    const data = await settingsRes.json();
    expect(data.maxStoredMessages).toBe(100);
    expect(data.maxPromptMessages).toBe(10);
  });

  test('creating ai-settings stores apiKey encrypted', async () => {
    const { db, port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });
    const encryption = server.container.get(EncryptionService) as EncryptionService;

    const settingsRes = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test-secret-key', model: 'gpt-4o' }),
    });
    expect(settingsRes.ok).toBe(true);
    const data = await settingsRes.json();

    expect(data.hasKey).toBe(true);
    expect(data.apiKey).toBeUndefined();
    expect(data.apiKeyEncrypted).toBeUndefined();

    const rawRows = await db.select().from(aiSettingsTable);
    expect(rawRows.length).toBe(1);
    expect(rawRows[0].apiKeyEncrypted).not.toBe('sk-test-secret-key');
    expect(rawRows[0].apiKeyEncrypted).toBeTruthy();
    expect(JSON.parse(encryption.decrypt(rawRows[0].apiKeyEncrypted))).toEqual({
      openai: 'sk-test-secret-key',
    });
  });

  test('GET returns hasKey boolean, never apiKey', async () => {
    const { port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    const getRes = await fetch(`http://localhost:${port}/ai-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await getRes.json();
    expect(body).toBeNull();

    await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider: 'ollama', apiKey: 'my-key', model: 'llama3.1' }),
    });

    const getRes2 = await fetch(`http://localhost:${port}/ai-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body2 = await getRes2.json();
    expect(body2.hasKey).toBe(true);
    expect(body2.providerKeys).toEqual({ ollama: true });
    expect(body2.providerModels).toEqual({ ollama: 'llama3.1' });
    expect(body2.apiKey).toBeUndefined();
    expect(body2.apiKeyEncrypted).toBeUndefined();
    expect(body2.provider).toBe('ollama');
  });

  test('unauthenticated GET returns 401', async () => {
    const { port } = await setup();
    const res = await fetch(`http://localhost:${port}/ai-settings`);
    expect(res.status).toBe(401);
  });

  test('unauthenticated POST returns 401', async () => {
    const { port } = await setup();
    const res = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama' }),
    });
    expect(res.status).toBe(401);
  });

  test('authenticated non-admin cannot POST or PUT', async () => {
    const { port } = await setup();
    const userToken = await registerAndLogin(port, 'user@test.com', 'Password123!');

    const postRes = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ provider: 'ollama', apiKey: 'k', model: 'llama3.1' }),
    });
    expect([401, 403]).toContain(postRes.status);

    const putRes = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ model: 'other' }),
    });
    expect([401, 403]).toContain(putRes.status);
  });

  test('admin test endpoint resolves provider config and reuses saved key when apiKey is omitted', async () => {
    const { port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-test-secret-key',
        model: 'gpt-5.4-mini',
      }),
    });

    const testRes = await fetch(`http://localhost:${port}/ai-settings/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-5.4',
      }),
    });

    expect(testRes.ok).toBe(true);
    const body = await testRes.json();
    expect(body.ok).toBe(true);
    expect(body.provider).toBe('openai');
    expect(body.resolvedModel).toBe('gpt-5.4');
  });

  test('stores and reuses separate api keys per provider', async () => {
    const { port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openai/gpt-5.4-mini',
      }),
    });

    const saveOpenCode = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'opencode',
        apiKey: 'opencode-key',
        model: 'kimi-k2.5',
        baseUrl: 'https://opencode.ai/zen/go/v1',
      }),
    });

    expect(saveOpenCode.ok).toBe(true);
    const openCodeBody = await saveOpenCode.json();
    expect(openCodeBody.providerKeys).toEqual({ openrouter: true, opencode: true });
    expect(openCodeBody.hasKey).toBe(true);

    const testOpenRouter = await fetch(`http://localhost:${port}/ai-settings/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openrouter',
        model: 'openai/gpt-5.4-mini',
      }),
    });

    expect(testOpenRouter.ok).toBe(true);
    const testOpenRouterBody = await testOpenRouter.json();
    expect(testOpenRouterBody.ok).toBe(true);
    expect(testOpenRouterBody.provider).toBe('openrouter');
  });

  test('stores and reuses separate selected models per provider', async () => {
    const { port } = await setup();
    const token = await registerAndLogin(port, 'admin@test.com', 'Password123!', { asAdmin: true });

    await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'custom/openrouter-model',
      }),
    });

    const saveOpenCode = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'opencode',
        apiKey: 'opencode-key',
        model: 'custom-opencode-model',
        baseUrl: 'https://opencode.ai/zen/go/v1',
      }),
    });

    expect(saveOpenCode.ok).toBe(true);
    const openCodeBody = await saveOpenCode.json();
    expect(openCodeBody.model).toBe('custom-opencode-model');
    expect(openCodeBody.providerModels).toEqual({
      openrouter: 'custom/openrouter-model',
      opencode: 'custom-opencode-model',
    });
    expect(openCodeBody.providerModelOptions).toEqual({
      openrouter: ['custom/openrouter-model'],
      opencode: ['custom-opencode-model'],
    });

    const testOpenRouter = await fetch(`http://localhost:${port}/ai-settings/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openrouter',
      }),
    });

    expect(testOpenRouter.ok).toBe(true);
    const testOpenRouterBody = await testOpenRouter.json();
    expect(testOpenRouterBody.resolvedModel).toBe('custom/openrouter-model');

    const removeOpenRouterCustomModel = await fetch(`http://localhost:${port}/ai-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'openrouter',
        model: 'openrouter/auto',
        modelOptions: [],
      }),
    });

    expect(removeOpenRouterCustomModel.ok).toBe(true);
    const removedBody = await removeOpenRouterCustomModel.json();
    expect(removedBody.providerModelOptions).toEqual({
      openrouter: [],
      opencode: ['custom-opencode-model'],
    });
  });
});
