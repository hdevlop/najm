import 'reflect-metadata';

import { describe, test, expect } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { ChatSessionRepository } from '../src/sessions/ChatSessionRepository';
import { DbConversationStore } from '../src/sessions/ConversationStore';
import { aiSettingsTable, chatSessionsTable } from '../src/schema/sqlite';
import type { ChatbotConfig } from '../src/ChatbotPlugin';
import type { ChatbotSchema } from '../src/ai-settings/AiSettingsRepository';

const schema: ChatbotSchema = {
  aiSettings: aiSettingsTable,
  chatSessions: chatSessionsTable,
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
}

function buildRepo(dialect: 'sqlite' | 'pg' | 'mysql' = 'sqlite') {
  const sqlite = new Database(':memory:');
  createSchema(sqlite);
  const db = drizzle(sqlite, { schema });
  const repo = new ChatSessionRepository();
  (repo as any).db = db;
  (repo as any).schema = schema;
  const config: ChatbotConfig = { dialect, conversationStore: 'db' } as ChatbotConfig;
  (repo as any).config = config;
  return { repo, db, sqlite, config };
}

function buildStore() {
  const env = buildRepo();
  const store = new DbConversationStore(env.repo as any, { sessionTtl: 3600 } as any);
  return { store, repo: env.repo, db: env.db, sqlite: env.sqlite };
}

describe('Phase 4 (C4) — ChatSessionRepository.save uses a single native write', () => {
  test('save() writes one row with no pre-select; DbConversationStore.save() does not pre-read', async () => {
    const { repo, store, db } = buildStore();

    const originalFindRawByKey = repo.findRawByKey.bind(repo);
    let findRawCalls = 0;
    (repo as any).findRawByKey = (...args: any[]) => {
      findRawCalls++;
      return originalFindRawByKey(...args);
    };

    await store.save('native-save-key', [{ role: 'user', content: 'hi' }] as any, {
      userId: 'u1',
      channel: 'web',
    });

    expect(findRawCalls).toBe(0);

    const loaded = await store.load('native-save-key');
    expect(loaded).not.toBeNull();
    expect(loaded![0].content).toBe('hi');

    (repo as any).findRawByKey = originalFindRawByKey;
  });

  test('existing title survives an update with title: null; new title writes through', async () => {
    const { repo } = buildStore();

    await repo.save({
      sessionKey: 'title-survive',
      messages: [{ role: 'user', content: 'first' }] as any,
      userId: 'u1',
      channel: 'web',
      title: 'Original title',
    });

    let stored = await repo.findByKey('title-survive');
    expect(stored!.title).toBe('Original title');

    await repo.save({
      sessionKey: 'title-survive',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
      ] as any,
      userId: 'u1',
      channel: 'web',
      title: null,
    });

    stored = await repo.findByKey('title-survive');
    expect(stored!.title).toBe('Original title');
    expect(stored!.messageCount).toBe(2);

    await repo.save({
      sessionKey: 'title-survive',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ] as any,
      userId: 'u1',
      channel: 'web',
      title: 'Renamed title',
    });

    stored = await repo.findByKey('title-survive');
    expect(stored!.title).toBe('Renamed title');
  });

  test('public upsert() returns the committed row from a non-filtered read', async () => {
    const { repo } = buildStore();

    const stored = await repo.upsert({
      sessionKey: 'upsert-key',
      messages: [{ role: 'user', content: 'hi' }] as any,
      userId: 'u1',
      channel: 'web',
    });

    expect(stored.id).toBeTruthy();
    expect(stored.sessionKey).toBe('upsert-key');
    expect(stored.userId).toBe('u1');
    expect(stored.channel).toBe('web');
    expect(stored.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(typeof stored.messageCount).toBe('number');
  });

  test('upsert() throws when findRawByKey returns null after a successful write', async () => {
    const { repo } = buildStore();

    const realFindRaw = repo.findRawByKey.bind(repo);
    (repo as any).findRawByKey = async () => null;

    await expect(repo.upsert({
      sessionKey: 'missing-readback',
      messages: [{ role: 'user', content: 'hi' }] as any,
      userId: 'u1',
      channel: 'web',
    })).rejects.toThrow(/missing-readback/);

    (repo as any).findRawByKey = realFindRaw;
  });

  test('upsert() does not fabricate a session with id: null when the row is missing', async () => {
    const { repo } = buildRepo();

    const insertCalls: any[] = [];
    (repo as any).db.insert = () => {
      const builder: any = {
        _values: undefined as any,
        values: (vals: any) => {
          builder._values = vals;
          return builder;
        },
        onConflictDoUpdate: () => {
          insertCalls.push(builder._values);
          return Promise.resolve();
        },
        onDuplicateKeyUpdate: () => Promise.resolve(),
      };
      return builder;
    };

    await expect(repo.upsert({
      sessionKey: 'race-orphaned',
      messages: [{ role: 'user', content: 'hi' }] as any,
      userId: 'u1',
      channel: 'web',
    })).rejects.toThrow(/race-orphaned/);

    expect(insertCalls.length).toBe(1);
  });

  test('two create attempts for the same session key do not throw a duplicate-key error', async () => {
    const { repo } = buildStore();

    await repo.save({
      sessionKey: 'race-key',
      messages: [{ role: 'user', content: 'a' }] as any,
      userId: 'u1',
      channel: 'web',
    });
    await expect(repo.save({
      sessionKey: 'race-key',
      messages: [{ role: 'user', content: 'b' }] as any,
      userId: 'u1',
      channel: 'web',
    })).resolves.toBeUndefined();

    const stored = await repo.findByKey('race-key');
    expect(stored).toBeTruthy();
    expect(stored!.messageCount).toBe(1);
  });
});

describe('Phase 4 (C4) — ChatSessionRepository routes the dialect-specific upsert', () => {
  function buildInsertSpyRepo(dialect: 'sqlite' | 'pg' | 'mysql') {
    const sqlite = new Database(':memory:');
    createSchema(sqlite);
    const db = drizzle(sqlite, { schema });
    const repo = new ChatSessionRepository();
    (repo as any).db = db;
    (repo as any).schema = schema;
    (repo as any).config = { dialect } as ChatbotConfig;
    return { repo, sqlite, db };
  }

  function installInsertSpy(repo: ChatSessionRepository): { events: { conflict: number; duplicate: number; values: any[] } } {
    const events = { conflict: 0, duplicate: 0, values: [] as any[] };
    const realInsert = (repo as any).db.insert.bind((repo as any).db);
    (repo as any).db.insert = (table: any) => {
      const builder: any = {
        _values: undefined as any,
        values: (vals: any) => {
          builder._values = vals;
          return builder;
        },
        onConflictDoUpdate: (..._args: any[]) => {
          events.conflict++;
          events.values.push(builder._values);
          return realInsert(table).values(builder._values).onConflictDoUpdate(..._args);
        },
        onDuplicateKeyUpdate: (..._args: any[]) => {
          events.duplicate++;
          events.values.push(builder._values);
          return realInsert(table).values(builder._values).onDuplicateKeyUpdate(..._args);
        },
      };
      return builder;
    };
    return { events };
  }

  test('sqlite dialect calls onConflictDoUpdate and not onDuplicateKeyUpdate', async () => {
    const { repo } = buildInsertSpyRepo('sqlite');
    const { events } = installInsertSpy(repo);

    await repo.save({
      sessionKey: 'dialect-sqlite',
      messages: [{ role: 'user', content: 'x' }] as any,
      userId: 'u1',
      channel: 'web',
    });

    expect(events.conflict).toBe(1);
    expect(events.duplicate).toBe(0);
  });

  test('pg dialect calls onConflictDoUpdate', async () => {
    const { repo } = buildInsertSpyRepo('pg');
    const { events } = installInsertSpy(repo);

    await repo.save({
      sessionKey: 'dialect-pg',
      messages: [{ role: 'user', content: 'x' }] as any,
      userId: 'u1',
      channel: 'web',
    });

    expect(events.conflict).toBe(1);
    expect(events.duplicate).toBe(0);
  });

  test('mysql dialect routes to onDuplicateKeyUpdate and not onConflictDoUpdate', async () => {
    const { repo } = buildInsertSpyRepo('mysql');

    let capturedConflict = 0;
    let capturedDuplicate = 0;
    const capturedValues: any[] = [];
    (repo as any).db.insert = () => {
      const builder: any = {
        _values: undefined as any,
        values: (vals: any) => {
          builder._values = vals;
          return builder;
        },
        onConflictDoUpdate: () => {
          capturedConflict++;
          return Promise.resolve();
        },
        onDuplicateKeyUpdate: () => {
          capturedDuplicate++;
          capturedValues.push(builder._values);
          return Promise.resolve();
        },
      };
      return builder;
    };

    await repo.save({
      sessionKey: 'dialect-mysql',
      messages: [{ role: 'user', content: 'x' }] as any,
      userId: 'u1',
      channel: 'web',
    });

    expect(capturedDuplicate).toBe(1);
    expect(capturedConflict).toBe(0);
    expect(capturedValues[0].sessionKey).toBe('dialect-mysql');
  });
});
