import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { TransactionService } from '../src/TransactionService';

function serviceFor(db: any) {
  const scope = new AsyncLocalStorage<Record<string, any>>();
  const service = new TransactionService();
  Object.assign(service, {
    container: {
      get: (token: { key: string }) => scope.getStore()?.[token.key],
      set: (token: { key: string }, value: unknown) => { scope.getStore()![token.key] = value; },
      run: (values: Record<string, any>, callback: () => unknown) =>
        scope.run({ ...scope.getStore(), ...values }, callback),
    },
    databaseService: { get: () => db },
    log: { transactionRetry() {}, transactionFailed() {} },
  });
  return service;
}

test('commit callbacks wait for the outermost commit, including nested registrations', async () => {
  const events: string[] = [];
  const service = serviceFor({ transaction: async (callback: (db: any) => Promise<unknown>) => {
    const result = await callback({});
    events.push('commit');
    return result;
  } });
  await service.run(async () => {
    await service.afterCommit(() => { events.push('outer'); });
    await service.run(async () => {
      await service.afterCommit(() => { events.push('nested'); });
    });
    expect(events).toEqual([]);
  });
  expect(events).toEqual(['commit', 'outer', 'nested']);
  await service.afterCommit(() => { events.push('immediate'); });
  expect(events.at(-1)).toBe('immediate');
});

test('rollback discards commit callbacks', async () => {
  let called = false;
  const service = serviceFor({ transaction: (callback: (db: any) => Promise<unknown>) => callback({}) });
  const failure = new Error('rollback');
  await expect(service.run(async () => {
    await service.afterCommit(() => { called = true; });
    throw failure;
  })).rejects.toBe(failure);
  expect(called).toBe(false);
});

test('rollback callbacks run after the transaction scope ends and never run after commit', async () => {
  const events: boolean[] = [];
  const service = serviceFor({ transaction: (callback: (db: any) => Promise<unknown>) => callback({}) });
  await service.afterRollback(() => { events.push(true); });
  await service.run(async () => {
    await service.afterRollback(() => { events.push(true); });
  });
  const failure = new Error('rollback');
  await expect(service.run(async () => {
    await service.afterRollback(() => { events.push(service.isActive()); });
    throw failure;
  })).rejects.toBe(failure);
  expect(events).toEqual([false]);
});

test('rollback callbacks finish before a failed attempt is retried', async () => {
  const events: string[] = [];
  let attempt = 0;
  const service = serviceFor({ transaction: (callback: (db: any) => Promise<unknown>) => callback({}) });
  await service.run(async () => {
    const current = ++attempt;
    events.push(`attempt ${current}`);
    await service.afterRollback(() => { events.push(`rollback ${current}`); });
    await service.afterCommit(() => { events.push(`commit ${current}`); });
    if (current === 1) throw Object.assign(new Error('serialization failure'), { code: '40001' });
  }, { retries: 1 });
  expect(events).toEqual(['attempt 1', 'rollback 1', 'attempt 2', 'commit 2']);
});

test('retries discard callbacks registered by a failed attempt', async () => {
  const completed: number[] = [];
  let attempt = 0;
  const service = serviceFor({ transaction: (callback: (db: any) => Promise<unknown>) => callback({}) });
  await service.run(async () => {
    const current = ++attempt;
    await service.afterCommit(() => { completed.push(current); });
    if (current === 1) throw Object.assign(new Error('serialization failure'), { code: '40001' });
  }, { retries: 1 });
  expect(attempt).toBe(2);
  expect(completed).toEqual([2]);
});

test('a post-commit failure drains other callbacks and never retries a committed write', async () => {
  let writes = 0;
  let nextCallbackRan = false;
  const service = serviceFor({ transaction: (callback: (db: any) => Promise<unknown>) => callback({}) });
  const failure = Object.assign(new Error('serialization failure in external callback'), { code: '40001' });
  await expect(service.run(async () => {
    writes++;
    await service.afterCommit(() => { throw failure; });
    await service.afterCommit(() => { nextCallbackRan = true; });
  }, { retries: 2 })).rejects.toBe(failure);
  expect(writes).toBe(1);
  expect(nextCallbackRan).toBe(true);
});

test('Bun SQLite keeps an async callback inside its transaction through rollback', async () => {
  const sqlite = new Database(':memory:');
  sqlite.exec('CREATE TABLE entries (value text)');
  const service = serviceFor(drizzle(sqlite));
  const failure = new Error('abort after an async boundary');
  try {
    await expect(service.run(async () => {
      sqlite.exec("INSERT INTO entries VALUES ('must roll back')");
      await Promise.resolve();
      expect(sqlite.inTransaction).toBe(true);
      throw failure;
    })).rejects.toBe(failure);
    expect(sqlite.query('SELECT count(*) AS count FROM entries').get()).toEqual({ count: 0 });
  } finally {
    sqlite.close();
  }
});

test('overlapping async SQLite transactions on one client wait instead of sharing a transaction', async () => {
  const sqlite = new Database(':memory:');
  sqlite.exec('CREATE TABLE entries (value text)');
  const service = serviceFor(drizzle(sqlite));
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const paused = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  try {
    const first = service.run(async () => {
      events.push('first');
      entered();
      await paused;
      sqlite.exec("INSERT INTO entries VALUES ('first')");
    });
    await started;
    const second = service.run(async () => {
      events.push('second');
      sqlite.exec("INSERT INTO entries VALUES ('second')");
    });
    const both = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(events).toEqual(['first']);
    release();
    expect((await both).map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(sqlite.query('SELECT value FROM entries ORDER BY value').all())
      .toEqual([{ value: 'first' }, { value: 'second' }]);
  } finally {
    release?.();
    sqlite.close();
  }
});
