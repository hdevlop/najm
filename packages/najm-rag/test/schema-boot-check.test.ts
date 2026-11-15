import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ToolIndexRepository } from '../src/toolIndex/ToolIndexRepository';
import { ToolIndexValidator } from '../src/toolIndex/ToolIndexValidator';
import { RoutingSettingsRepository } from '../src/routingSettings/RoutingSettingsRepository';
import { RoutingSettingsService } from '../src/routingSettings/RoutingSettingsService';
import { UnmatchedQueryRepository } from '../src/unmatched/UnmatchedQueryRepository';
import { RoutingTestsRepository } from '../src/routingTests/RoutingTestsRepository';
import { SemanticPhraseService } from '../src/chatbotRag/SemanticPhraseService';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { RagSchemaService } from '../src/schema/RagSchemaService';
import { SqliteVecStrategy } from '../src/vectorStore';
import { ragSchema } from '../src/schema/sqlite';

/**
 * Tables as an early najm-rag release created them: semantics without
 * source_file/fingerprint, settings without enable_knowledge/allowed_langs,
 * unmatched without nearest_tool, no routing-tests table.
 */
function oldDatabase() {
  const raw = new Database(':memory:');
  raw.exec(`
    CREATE TABLE chatbot_tool_embeddings (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      "group" TEXT, local_name TEXT, arg_names TEXT, annotations TEXT, fingerprint TEXT NOT NULL, embedding BLOB, created_at TEXT, updated_at TEXT);
    CREATE TABLE chatbot_tool_semantics (id TEXT PRIMARY KEY, tool_name TEXT NOT NULL, phrase TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'und', source TEXT, embedding BLOB, created_at TEXT, updated_at TEXT);
    CREATE TABLE chatbot_routing_settings (id TEXT PRIMARY KEY, max_tools INTEGER, top_semantic_hits INTEGER, similarity_threshold TEXT,
      fallback_on_router_error TEXT, fallback_on_no_match TEXT, dependencies TEXT, dangerous_intent_keywords TEXT,
      tools_override TEXT, context_override TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE chatbot_unmatched_queries (id TEXT PRIMARY KEY, query TEXT NOT NULL, normalized TEXT NOT NULL UNIQUE, score TEXT NOT NULL,
      threshold TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'router', occurrence_count INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT);
  `);
  return { raw, db: drizzle(raw, { schema: ragSchema }) };
}

function columns(raw: Database, table: string): string[] {
  return (raw.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

function setup(ensureSchema: boolean) {
  const { raw, db } = oldDatabase();
  const config = { dialect: 'sqlite', ensureSchema, toolRouting: { enabled: true }, rag: { embedding: { model: 'm' } } } as any;
  const validator = new ToolIndexValidator();
  (validator as any).schema = ragSchema;
  const toolIndex = Object.assign(new ToolIndexRepository(), { db, vectors: new SqliteVecStrategy(), validator, config });
  const settingsRepo = Object.assign(new RoutingSettingsRepository(), { db, schema: ragSchema, config });
  const unmatched = Object.assign(new UnmatchedQueryRepository(), { db, schema: ragSchema, config });
  const routingTests = Object.assign(new RoutingTestsRepository(), { db, schema: ragSchema, config });
  const instances = new Map<any, any>([
    [ToolIndexRepository, toolIndex],
    [RoutingSettingsRepository, settingsRepo],
    [UnmatchedQueryRepository, unmatched],
    [RoutingTestsRepository, routingTests],
  ]);
  const errors: string[] = [];
  const log = { error: (m: string) => errors.push(m) } as any;
  const schemaService = new RagSchemaService(config, ragSchema, { get: () => db } as any, log);
  instances.set(RagSchemaService, schemaService);
  const container = { has: (t: any) => instances.has(t), get: (t: any) => instances.get(t), resolve: async (t: any) => instances.get(t) };
  Object.assign(schemaService as any, { container });
  return { raw, db, config, toolIndex, settingsRepo, schemaService, container, errors };
}

describe('schema checks run at boot, not on the first read that happens to call them', () => {
  test('activate() adds every column newer than the tables, before any read', async () => {
    const { raw, schemaService } = setup(true);
    await schemaService.activate();

    expect(columns(raw, 'chatbot_tool_semantics')).toEqual(expect.arrayContaining(['source_file', 'fingerprint']));
    expect(columns(raw, 'chatbot_routing_settings')).toEqual(expect.arrayContaining(['enable_knowledge', 'allowed_langs']));
    expect(columns(raw, 'chatbot_unmatched_queries')).toContain('nearest_tool');
    expect(columns(raw, 'chatbot_routing_tests')).toContain('lang');
    const status = await schemaService.status();
    expect(status.missing).toEqual([]);
    expect(status.message).toBeUndefined();
  });

  test('the missing list is derived from the drizzle schema, so it covers every column the code reads', async () => {
    const { schemaService } = setup(false);
    const missing = await schemaService.findMissing();
    expect(missing).toEqual(expect.arrayContaining([
      'chatbot_tool_semantics.source_file',
      'chatbot_tool_semantics.fingerprint',
      'chatbot_routing_settings.enable_knowledge',
      'chatbot_routing_settings.allowed_langs',
      'chatbot_unmatched_queries.nearest_tool',
      'chatbot_routing_tests',
    ]));
  });

  test('with ensureSchema off nothing is altered, and the report names the columns and says to migrate', async () => {
    const { raw, schemaService, errors } = setup(false);
    await schemaService.activate();
    expect(columns(raw, 'chatbot_tool_semantics')).not.toContain('source_file');

    const status = await schemaService.status();
    expect(status.ensureSchema).toBe(false);
    expect(status.missing).toContain('chatbot_tool_semantics.source_file');
    expect(status.message).toContain('database is missing chatbot_tool_semantics.source_file');
    expect(status.message).toContain('run your migrations');
    expect(errors.join('\n')).toContain('chatbot_tool_semantics.source_file');
  });

  test('/status reports the schema instead of failing on a missing column', async () => {
    const { toolIndex, settingsRepo, config, container } = setup(false);
    const settings = new RoutingSettingsService(config, settingsRepo);
    const svc = new SemanticPhraseService(toolIndex, { tools: [] } as any, {} as any, new ChatbotRagValidator(),
      { isIndexing: false } as any, config, settings);
    Object.assign(svc as any, { container });

    const status = await svc.getStatus();
    expect(status.schema?.missing).toContain('chatbot_routing_settings.allowed_langs');
    expect(status.schema?.message).toContain('run your migrations');
  });

  test('a failed settings check is retried instead of being marked done', async () => {
    const { raw, db, config } = setup(true);
    let failures = 1;
    const flaky = new Proxy(db, {
      get(target: any, prop) {
        if (prop === 'run') {
          return (...args: any[]) => {
            if (failures-- > 0) throw new Error('database is locked');
            return target.run(...args);
          };
        }
        return target[prop];
      },
    });
    const repo = Object.assign(new RoutingSettingsRepository(), { db: flaky, schema: ragSchema, config });
    await expect(repo.ensureSchema()).rejects.toThrow('database is locked');
    await repo.ensureSchema();
    expect(columns(raw, 'chatbot_routing_settings')).toContain('allowed_langs');
  });
});
