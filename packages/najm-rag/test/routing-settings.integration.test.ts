import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ragSchema } from '../src/schema/sqlite';
import { RoutingSettingsRepository } from '../src/routingSettings/RoutingSettingsRepository';
import { RoutingSettingsService } from '../src/routingSettings/RoutingSettingsService';
import { ToolRoutingLoader } from '../src/toolRouter/ToolRoutingLoader';
import { ToolRouterValidator } from '../src/toolRouter/ToolRouterValidator';
import { loadRagRoutingConfig } from '../src/config/loadRoutingConfig';

describe('RoutingSettingsService + Repository integration', () => {
  function createDb() {
    const raw = new Database(':memory:');
    const db = drizzle(raw, { schema: ragSchema });
    return { raw, db };
  }

  function createTables(raw: Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS chatbot_routing_settings (
        id TEXT PRIMARY KEY,
        enable_knowledge INTEGER NOT NULL DEFAULT 1,
        max_tools INTEGER,
        top_semantic_hits INTEGER,
        similarity_threshold TEXT,
        fallback_on_router_error TEXT,
        fallback_on_no_match TEXT,
        dependencies TEXT,
        dangerous_intent_keywords TEXT,
        tools_override TEXT,
        context_override TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);
  }

  function createRepo(db: any): RoutingSettingsRepository {
    const repo = new RoutingSettingsRepository();
    (repo as any).db = db;
    (repo as any).schema = ragSchema;
    return repo;
  }

  function makeBootConfig(overrides: any = {}): any {
    return {
      dialect: 'sqlite',
      toolRouting: {
        enabled: true,
        maxTools: 12,
        topSemanticHits: 8,
        similarityThreshold: 0.45,
        fallbackOnRouterError: 'all',
        fallbackOnNoMatch: 'none',
        dependencies: {},
        ...overrides,
      },
    };
  }

  test('boot config is used when DB is empty', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const effective = await service.getEffectiveSettings();
    expect(effective.maxTools).toBe(12);
    expect(effective.enableKnowledge).toBe(true);
    expect(effective.similarityThreshold).toBe(0.45);
    expect(effective.source).toBe('boot');
  });

  test('DB settings override boot config', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    await repo.create({
      maxTools: 5,
      similarityThreshold: '0.75',
      fallbackOnNoMatch: 'all',
    });

    const effective = await service.getEffectiveSettings();
    expect(effective.maxTools).toBe(5);
    expect(effective.similarityThreshold).toBe(0.75);
    expect(effective.fallbackOnNoMatch).toBe('all');
    expect(effective.topSemanticHits).toBe(8); // from boot
    expect(effective.source).toBe('db');
  });

  test('updateSettings inserts when table is empty', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const updated = await service.updateSettings({ maxTools: 3 });
    expect(updated.maxTools).toBe(3);
    expect(updated.enableKnowledge).toBe(true);
    expect(updated.similarityThreshold).toBe(0.45); // boot fallback
    expect(updated.source).toBe('db');

    const row = await repo.get();
    expect(row).not.toBeNull();
    expect(row.maxTools).toBe(3);
  });

  test('updateSettings upserts existing row', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    await service.updateSettings({ maxTools: 3 });
    const updated = await service.updateSettings({ similarityThreshold: 0.9 });

    expect(updated.maxTools).toBe(3);
    expect(updated.similarityThreshold).toBe(0.9);

    const rows = await db.select().from(ragSchema.chatbotRoutingSettings).all();
    expect(rows.length).toBe(1);
  });

  test('cache is invalidated after updateSettings', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const first = await service.getEffectiveSettings();
    expect(first.maxTools).toBe(12);

    await repo.create({ maxTools: 99 });
    // Cache should still return stale boot value
    const cached = await service.getEffectiveSettings();
    expect(cached.maxTools).toBe(12);

    service.invalidateCache();
    const fresh = await service.getEffectiveSettings();
    expect(fresh.maxTools).toBe(99);
  });

  test('toolsOverride and contextOverride default to auto', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const effective = await service.getEffectiveSettings();
    expect(effective.toolsOverride).toBe('auto');
    expect(effective.contextOverride).toBe('auto');
  });

  test('updateSettings writes override fields', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const updated = await service.updateSettings({
      toolsOverride: 'none',
      contextOverride: 'none',
    });

    expect(updated.toolsOverride).toBe('none');
    expect(updated.contextOverride).toBe('none');
  });

  test('updateSettings writes enableKnowledge', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const updated = await service.updateSettings({ enableKnowledge: false });
    expect(updated.enableKnowledge).toBe(false);

    const row = await repo.get();
    expect(row.enableKnowledge).toBe(false);
  });

  test('getRoutingConfig includes enabled from boot config', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    const config = await service.getRoutingConfig();
    expect(config.enabled).toBe(true);
    expect(config.maxTools).toBe(12);
  });

  test('getRoutingConfig merges DB overrides over optional base config', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const service = new RoutingSettingsService(makeBootConfig(), repo);

    await repo.create({ maxTools: 7 });

    const baseConfig = { maxTools: 20, similarityThreshold: 0.6 };
    const config = await service.getRoutingConfig(baseConfig);
    expect(config.maxTools).toBe(7); // DB wins
    expect(config.similarityThreshold).toBe(0.6); // base fallback
  });
});

describe('ToolRoutingLoader DB integration', () => {
  function createDb() {
    const raw = new Database(':memory:');
    const db = drizzle(raw, { schema: ragSchema });
    return { raw, db };
  }

  function createTables(raw: Database) {
    raw.exec(`
      CREATE TABLE IF NOT EXISTS chatbot_routing_settings (
        id TEXT PRIMARY KEY,
        enable_knowledge INTEGER NOT NULL DEFAULT 1,
        max_tools INTEGER,
        top_semantic_hits INTEGER,
        similarity_threshold TEXT,
        fallback_on_router_error TEXT,
        fallback_on_no_match TEXT,
        dependencies TEXT,
        dangerous_intent_keywords TEXT,
        tools_override TEXT,
        context_override TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);
  }

  function createRepo(db: any): RoutingSettingsRepository {
    const repo = new RoutingSettingsRepository();
    (repo as any).db = db;
    (repo as any).schema = ragSchema;
    return repo;
  }

  function makeLoader(
    config: any,
    settingsService: RoutingSettingsService,
    filePath?: string,
  ): ToolRoutingLoader {
    const validator = new ToolRouterValidator();
    const log = { error: mock(() => {}) } as any;
    const merged = { ...config, configPath: filePath };
    return new ToolRoutingLoader(merged, log, validator, settingsService);
  }

  test('loader returns boot config when no file and DB is empty', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const bootConfig = {
      dialect: 'sqlite',
      toolRouting: {
        enabled: true,
        maxTools: 10,
        topSemanticHits: 6,
        similarityThreshold: 0.5,
        fallbackOnRouterError: 'none',
        fallbackOnNoMatch: 'all',
        dependencies: {},
      },
    };
    const settingsService = new RoutingSettingsService(bootConfig as any, repo);
    const loader = makeLoader(bootConfig, settingsService);

    const routing = await loader.getRoutingConfig();
    expect(routing.maxTools).toBe(10);
    expect(routing.similarityThreshold).toBe(0.5);
  });

  test('loader merges DB settings over boot config', async () => {
    const { raw, db } = createDb();
    createTables(raw);

    const repo = createRepo(db);
    const bootConfig = {
      dialect: 'sqlite',
      toolRouting: {
        enabled: true,
        maxTools: 10,
        topSemanticHits: 6,
        similarityThreshold: 0.5,
        fallbackOnRouterError: 'none',
        fallbackOnNoMatch: 'all',
        dependencies: {},
      },
    };
    const settingsService = new RoutingSettingsService(bootConfig as any, repo);
    await repo.create({ maxTools: 3, similarityThreshold: '0.99' });

    const loader = makeLoader(bootConfig, settingsService);
    const routing = await loader.getRoutingConfig();
    expect(routing.maxTools).toBe(3);
    expect(routing.similarityThreshold).toBe(0.99);
    expect(routing.topSemanticHits).toBe(6); // boot fallback
  });
});
