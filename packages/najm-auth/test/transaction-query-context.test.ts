import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';

import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { UserRepository } from '../src/users/UserRepository';

function makeQueryDatabase(id: string) {
  let closed = false;

  const chain = {
    from() { return chain; },
    leftJoin() { return chain; },
    where() {
      if (closed) throw new Error('Transaction query already complete');
      return Promise.resolve([{
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: true,
        image: null,
        status: 'active',
        roleId: null,
        lastLogin: null,
        role: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        permissionName: null,
      }]);
    },
  };

  return {
    close() { closed = true; },
    db: {
      select() {
        if (closed) throw new Error('Transaction query already complete');
        return chain;
      },
    },
  };
}

function injectDynamicDatabase(repository: object) {
  const transaction = makeQueryDatabase('transaction-user');
  const pool = makeQueryDatabase('pool-user');
  let current = transaction.db;

  Object.defineProperty(repository, 'db', {
    configurable: true,
    get: () => current,
  });
  Object.defineProperty(repository, 'schema', {
    configurable: true,
    value: authSchema,
  });

  return {
    closeTransaction() {
      transaction.close();
      current = pool.db;
    },
  };
}

describe('transaction-aware auth query helpers', () => {
  test('UserRepository stops using a completed transaction', async () => {
    const repository = new UserRepository();
    const context = injectDynamicDatabase(repository);

    expect((await repository.findByPhone('+212600000000'))?.id).toBe(
      'transaction-user',
    );

    context.closeTransaction();

    expect((await repository.findByPhone('+212600000000'))?.id).toBe(
      'pool-user',
    );
  });

  test('TokenRepository stops using a completed transaction', async () => {
    const repository = new TokenRepository();
    const context = injectDynamicDatabase(repository);

    expect((await repository.getUser('user-1'))?.id).toBe('transaction-user');

    context.closeTransaction();

    expect((await repository.getUser('user-1'))?.id).toBe('pool-user');
  });
});
