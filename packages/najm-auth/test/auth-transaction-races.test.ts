import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { TransactionService } from 'najm-database';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { authSchema } from '../src/schema/sqlite';
import { harness } from './helpers/securityHarness';

for (const mutation of ['remove', 'rename', 'delete', 'deleteAll'] as const) {
  test(`a snapshot recovered before an outer ${mutation} transaction commits is invalidated after commit`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'najm-auth-transaction-'));
    const path = join(directory, 'auth.db');
    const h = await harness({ databasePath: path });
    const old = await h.signIn();
    h.jar.refresh = old.refreshToken;
    const reader = new Database(path, { readonly: true });
    const readerRepo = new TokenRepository();
    Object.assign(readerRepo, { db: drizzle(reader, { schema: authSchema }), schema: authSchema });
    const readerTokens = new TokenService(readerRepo, h.cookies as never, h.cache);
    Object.assign(readerTokens, { config: h.config, t: (key: string) => key });

    // The real transaction service holds the writer's BEGIN open until its
    // async callback finishes, while an independent reader sees committed data.
    const scope = new AsyncLocalStorage<Record<string, any>>();
    const transactions = new TransactionService();
    Object.assign(transactions, {
      container: {
        get: (token: { key: string }) => scope.getStore()?.[token.key],
        run: (values: Record<string, any>, callback: () => unknown) =>
          scope.run({ ...scope.getStore(), ...values }, callback),
      },
      databaseService: { get: () => h.db },
      log: { transactionFailed() {}, transactionRetry() {} },
    });
    const invalidation = new SessionInvalidationService(h.cache, h.tokenRecords, transactions);
    Object.assign(invalidation, { config: h.config });
    Object.assign(h.permissions, { sessionInvalidation: invalidation });
    let captured: Awaited<ReturnType<typeof readerTokens.recoverSessionFromCookie>>;
    try {
      await transactions.run(async () => {
        if (mutation === 'remove') await h.permissions.removePermissionFromRole('editor', 'write');
        else if (mutation === 'rename') await h.permissions.update('write', { name: 'orders:archive' });
        else if (mutation === 'delete') await h.permissions.delete('write');
        else await h.permissions.deleteAll();
        captured = await readerTokens.recoverSessionFromCookie();
        // The reader really sees the committed old state, while the writer
        // already incremented its cache version inside the open transaction.
        expect(captured.permissions).toEqual(['orders:write']);
      });
      h.cookies.setSessionCookie(captured!);
      expect(await h.resolver.resolveFromSessionCookie()).toBe(false);
      expect((await readerTokens.recoverSessionFromCookie()).permissions)
        .toEqual(mutation === 'rename' ? ['orders:archive'] : []);
    } finally {
      reader.close();
    }
  });
}

test('a snapshot recovered from an uncommitted permission grant cannot survive rollback', async () => {
  const h = await harness();
  h.jar.refresh = (await h.signIn()).refreshToken;
  const scope = new AsyncLocalStorage<Record<string, any>>();
  const transactions = new TransactionService();
  Object.assign(transactions, {
    container: {
      get: (token: { key: string }) => scope.getStore()?.[token.key],
      run: (values: Record<string, any>, callback: () => unknown) =>
        scope.run({ ...scope.getStore(), ...values }, callback),
    },
    databaseService: { get: () => h.db },
    log: { transactionFailed() {}, transactionRetry() {} },
  });
  const invalidation = new SessionInvalidationService(h.cache, h.tokenRecords, transactions);
  Object.assign(invalidation, { config: h.config });
  Object.assign(h.permissions, { sessionInvalidation: invalidation });
  const failure = new Error('abort permission grant');
  let captured: Awaited<ReturnType<typeof h.tokens.recoverSessionFromCookie>>;
  await expect(transactions.run(async () => {
    await h.permissions.assignPermissionToRole('editor', 'read');
    captured = await h.tokens.recoverSessionFromCookie();
    expect(captured.permissions).toContain('orders:read');
    throw failure;
  })).rejects.toBe(failure);
  h.cookies.setSessionCookie(captured!);
  expect(await h.resolver.resolveFromSessionCookie()).toBe(false);
  expect((await h.tokens.recoverSessionFromCookie()).permissions).toEqual(['orders:write']);
});
