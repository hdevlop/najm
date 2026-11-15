import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Server, Controller, Get } from 'najm-core';
import { database } from 'najm-database';
import { auth, isAuth } from 'najm-auth';
import { storage } from 'najm-storage';
import { rag, EmbeddingService, KnowledgeContextProvider, KnowledgeDocumentService } from 'najm-rag';
import { ragSchema } from 'najm-rag/sqlite';
import { chatbot } from '../../src/ChatbotPlugin';
import { ChatAgent } from '../../src/agent/ChatAgent';
import { AiSettingsService } from '../../src/ai-settings/AiSettingsService';
import { ChatSessionCleanupService } from '../../src/sessions/ChatSessionCleanupService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createCredentialSetupTables } from '../auth-test-schema';
import { aiSettingsTable } from '../../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';
import { MockLanguageModelV1 } from '../../src/testing/MockLanguageModel';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT REFERENCES roles(id), last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE chatbot_document_sources (id TEXT PRIMARY KEY, namespace TEXT NOT NULL DEFAULT 'rag', source_type TEXT NOT NULL, original_path TEXT NOT NULL, ext TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', error TEXT, ingested_at TEXT, metadata TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE chatbot_document_chunks (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ordinal INTEGER NOT NULL, page INTEGER, text TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, metadata TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE chatbot_document_embeddings (id TEXT PRIMARY KEY, chunk_id TEXT NOT NULL UNIQUE, embedding BLOB, model TEXT NOT NULL DEFAULT '', dimensions INTEGER NOT NULL DEFAULT 768, created_at TEXT)`);
  createCredentialSetupTables(sqlite);
}

let server: Server | undefined;
let storageDir: string | undefined;
afterEach(async () => {
  await server?.stop();
  server = undefined;
  if (storageDir) rmSync(storageDir, { recursive: true, force: true });
  storageDir = undefined;
});

describe('knowledge without tool routing, through the real plugins', () => {
  test('ingested text reaches the chat prompt, and deleting the document removes it', async () => {
    const sqlite = new Database(':memory:');
    createSchema(sqlite);
    const db = drizzle(sqlite, { schema: { ...ragSchema, aiSettings: aiSettingsTable, users: usersTable, roles: rolesTable, tokens: tokensTable, permissions: permissionsTable, rolePermissions: rolePermissionsTable } });
    storageDir = mkdtempSync(join(tmpdir(), 'najm-rag-wiring-'));

    @Controller('/_noop')
    class Noop { @Get() ok() { return { ok: true }; } }

    server = new Server({ isolated: true })
      .use(database({ default: db }))
      .use(auth({ dialect: 'sqlite', jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET }, encryptionKey: ENCRYPTION_KEY }))
      .use(storage({ provider: 'local', basePath: storageDir, guards: [isAuth()] }))
      .use(rag({ dialect: 'sqlite', knowledge: true, embedding: { indexOnBoot: false } as any }))
      .use(chatbot({ dialect: 'sqlite', tools: 'none', conversationStore: 'db' }))
      .load(Noop);
    await server.listen(4977);
    const container = (server as any).container;

    // The embedding provider is not running in tests: answer with fixed vectors.
    const embedding = container.get(EmbeddingService) as any;
    embedding.embed = async () => new Array(768).fill(0.1);
    embedding.embedBatch = async (texts: string[]) => texts.map(() => new Array(768).fill(0.1));

    expect(container.get(KnowledgeContextProvider)).toBeInstanceOf(KnowledgeContextProvider);
    expect(container.get(ChatSessionCleanupService)).toBeInstanceOf(ChatSessionCleanupService);

    await (container.get(AiSettingsService) as AiSettingsService).upsert({ provider: 'openai', apiKey: 'sk', model: 'gpt-test', isEnabled: true } as any);
    const docs = await container.resolve(KnowledgeDocumentService) as KnowledgeDocumentService;
    const { documentId } = await docs.ingestTextDocument({ sourceType: 'text', text: 'The office opens at 9 and closes at 5.', originalPath: 'hours.txt' } as any);

    const agent = container.get(ChatAgent) as ChatAgent;
    const prompts: any[] = [];
    (agent as any).buildModel = () => new MockLanguageModelV1({
      doGenerate: async (options: any) => { prompts.push(options.prompt); return { text: 'ok', finishReason: 'stop', usage: {} }; },
    });
    const ask = () => agent.runOnce({ messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: 'when do you open?' }] } as any] });
    const systemOf = (prompt: any[]) => prompt.find((message) => message.role === 'system').content as string;

    await ask();
    expect(systemOf(prompts[0])).toContain('The office opens at 9');

    await docs.deleteDocument(documentId);
    await ask();
    expect(systemOf(prompts[1])).not.toContain('The office opens at 9');
  });
});
