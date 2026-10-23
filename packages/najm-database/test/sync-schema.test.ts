import { expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { PgDialect } from 'drizzle-orm/pg-core';
import { syncCounters, syncSchema } from '../src/sync/pg';

test('all sync schema defaults can enter a migration snapshot without native BigInt JSON', () => {
  const defaults = Object.values(syncSchema).flatMap(table => getTableConfig(table).columns.map(column => column.default));
  expect(() => JSON.stringify(defaults)).not.toThrow();
  const column = getTableConfig(syncCounters).columns.find(column => column.name === 'position')!;
  expect(new PgDialect().sqlToQuery(column.default as any).sql).toBe('0');
});
