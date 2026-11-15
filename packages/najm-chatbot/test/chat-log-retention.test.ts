import { describe, test, expect, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ChatLogRepository } from '../src/chatLogs';
import { ChatSessionCleanupService } from '../src/sessions/ChatSessionCleanupService';
import { chatbotCoreSchema } from '../src/schema/internal/sqlite';

const DAY = 24 * 60 * 60 * 1000;

function setup(config: Record<string, unknown>) {
  const raw = new Database(':memory:');
  raw.exec(`CREATE TABLE chatbot_interaction_logs (id TEXT PRIMARY KEY, session_key TEXT, user_query TEXT NOT NULL, query_lang TEXT,
    routing_enabled INTEGER NOT NULL DEFAULT 0, routing_status TEXT NOT NULL, routed_tools TEXT, actual_tool_names TEXT, model_tool_calls TEXT,
    model_answer TEXT, steps_count TEXT, success INTEGER, error TEXT, metadata TEXT, created_at TEXT)`);
  const db = drizzle(raw, { schema: chatbotCoreSchema });
  const logs = new ChatLogRepository();
  Object.assign(logs as any, { db, schema: chatbotCoreSchema });
  const sessions = { deleteExpired: mock(async () => 0) } as any;
  const events = { emit: mock(() => {}) } as any;
  const cleanup = new ChatSessionCleanupService(sessions, events, config as any, logs);
  const now = new Date('2026-11-14T12:00:00.000Z');
  const insert = (id: string, ageDays: number) => raw.run(
    `INSERT INTO chatbot_interaction_logs (id, user_query, routing_status, created_at) VALUES (?, 'q', 'disabled', ?)`,
    [id, new Date(now.getTime() - ageDays * DAY).toISOString()],
  );
  const ids = () => (raw.query('SELECT id FROM chatbot_interaction_logs ORDER BY id').all() as Array<{ id: string }>).map((row) => row.id);
  return { cleanup, insert, ids, now, sessions };
}

describe('H3: interaction log retention', () => {
  test('logs older than retentionDays are deleted by the cleanup pass', async () => {
    const { cleanup, insert, ids, now } = setup({ conversationStore: 'db', chatLogging: { enabled: true, retentionDays: 30 } });
    insert('old', 31);
    insert('recent', 29);

    await cleanup.cleanup(now);

    expect(ids()).toEqual(['recent']);
  });

  test('without retentionDays nothing is deleted', async () => {
    const { cleanup, insert, ids, now } = setup({ conversationStore: 'db', chatLogging: { enabled: true } });
    insert('old', 400);

    await cleanup.cleanup(now);

    expect(ids()).toEqual(['old']);
  });

  test('the cleanup timer runs for log retention even with the cache conversation store', async () => {
    const { cleanup } = setup({ conversationStore: 'cache', chatLogging: { enabled: true, retentionDays: 7 } });
    await cleanup.onReady();
    expect((cleanup as any).timer).toBeDefined();
    await cleanup.onDestroy();
  });
});
