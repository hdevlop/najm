import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { UnmatchedQueryRepository } from '../src/unmatched/UnmatchedQueryRepository';
import { UnmatchedQueryService } from '../src/unmatched/UnmatchedQueryService';
import { ragSchema } from '../src/schema/sqlite';
import { rag } from '../src/plugin';

const DAY = 24 * 60 * 60 * 1000;

async function setup(unmatchedRetentionDays?: number) {
  const raw = new Database(':memory:');
  const db = drizzle(raw, { schema: ragSchema });
  const config = { dialect: 'sqlite', unmatchedRetentionDays } as any;
  const repository = new UnmatchedQueryRepository();
  Object.assign(repository as any, { db, schema: ragSchema, config });
  const service = new UnmatchedQueryService(repository, config);
  await repository.count(); // creates the table
  const now = new Date('2026-11-14T12:00:00.000Z');
  const insert = (id: string, ageDays: number, format: 'iso' | 'sqlite') => {
    const at = new Date(now.getTime() - ageDays * DAY).toISOString();
    const stamp = format === 'iso' ? at : at.slice(0, 19).replace('T', ' ');
    raw.run(`INSERT INTO chatbot_unmatched_queries (id, query, normalized, score, threshold, source, occurrence_count, created_at, updated_at)
      VALUES (?, ?, ?, '0', '0.45', 'router', 1, ?, ?)`, [id, id, id, stamp, stamp]);
  };
  const ids = () => (raw.query('SELECT id FROM chatbot_unmatched_queries ORDER BY id').all() as Array<{ id: string }>).map((row) => row.id);
  return { service, insert, ids, now };
}

describe('H3: unmatched inbox retention', () => {
  test('entries last seen before the retention window are deleted, whatever their timestamp format', async () => {
    const { service, insert, ids, now } = await setup(30);
    insert('old-iso', 31, 'iso');
    insert('old-sqlite', 31, 'sqlite');
    insert('recent-iso', 29, 'iso');
    insert('recent-sqlite', 29, 'sqlite');

    expect(await service.cleanup(now)).toBe(2);
    expect(ids()).toEqual(['recent-iso', 'recent-sqlite']);
  });

  test('without retention nothing is deleted and no timer starts', async () => {
    const { service, insert, ids, now } = await setup(undefined);
    insert('old', 400, 'iso');

    expect(await service.cleanup(now)).toBe(0);
    expect(ids()).toEqual(['old']);
    await service.onReady();
    expect((service as any).timer).toBeUndefined();
  });

  test('rag() passes a positive retention through and drops anything else', () => {
    const merged = (config: any) => (rag({ dialect: 'sqlite', toolRouting: { enabled: true }, ...config }) as any).config;
    expect(merged({ unmatchedRetentionDays: 14 }).unmatchedRetentionDays).toBe(14);
    expect(merged({ unmatchedRetentionDays: -1 }).unmatchedRetentionDays).toBeUndefined();
  });
});
