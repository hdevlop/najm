import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';

/**
 * Real-DB coverage for the grace-window rotation race (review item #5).
 *
 * The mock-based test in auth-security.test.ts proves the *service* handles a
 * zero-rows result correctly. This proves the *SQL* itself against a real
 * driver: the single conditional UPDATE
 *   `WHERE user_id = ? AND previous_hash = ? AND previous_used_at IS NULL`
 * claims the grace slot exactly once. The second claim — and any claim with a
 * stale hash — returns zero rows, which is what makes the rotation atomic.
 *
 * Note: bun:sqlite is synchronous/single-threaded, so this validates the
 * conditional-UPDATE semantics, not OS-level parallelism. True concurrent
 * atomicity rests on the database's row-level locking of a single statement,
 * which is a documented guarantee of both SQLite and Postgres.
 */

const TOKENS_DDL = `
  CREATE TABLE tokens (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    user_id text NOT NULL,
    token text NOT NULL,
    token_family text NOT NULL UNIQUE,
    previous_hash text,
    previous_valid_until text,
    previous_used_at text,
    type text DEFAULT 'refresh',
    status text DEFAULT 'active',
    expires_at text NOT NULL
  );
`;

function makeRepo() {
  const sqlite = new Database(':memory:');
  sqlite.exec(TOKENS_DDL);
  const db = drizzle(sqlite, { schema: authSchema });

  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;

  return { repo, db };
}

async function seedToken(db: any, overrides: Partial<Record<string, any>> = {}) {
  await db.insert(authSchema.tokens).values({
    userId: 'user-1',
    token: 'current-token-hash',
    tokenFamily: 'family-1',
    previousHash: 'prev-hash',
    previousValidUntil: new Date(Date.now() + 60_000).toISOString(),
    previousUsedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 3_600 * 1_000).toISOString(),
    ...overrides,
  });
}

describe('markPreviousUsed conditional UPDATE (real bun:sqlite)', () => {
  let repo: TokenRepository;
  let db: any;

  beforeEach(() => {
    ({ repo, db } = makeRepo());
  });

  test('first claim wins, second claim gets zero rows', async () => {
    await seedToken(db);

    const first = await repo.markPreviousUsed('family-1', 'prev-hash');
    expect(first).toHaveLength(1);
    expect(first[0].previousUsedAt).not.toBeNull();

    // Grace slot already consumed: the IS NULL guard now fails → zero rows.
    const second = await repo.markPreviousUsed('family-1', 'prev-hash');
    expect(second).toHaveLength(0);
  });

  test('a stale/wrong previous hash never claims the slot', async () => {
    await seedToken(db);

    const claimed = await repo.markPreviousUsed('family-1', 'wrong-hash');
    expect(claimed).toHaveLength(0);

    // The legitimate previous hash is still claimable afterwards.
    const legit = await repo.markPreviousUsed('family-1', 'prev-hash');
    expect(legit).toHaveLength(1);
  });

  test('rotation cannot recreate a family deleted by logout', async () => {
    await seedToken(db);
    await repo.revokeFamily('family-1');

    const rotated = await repo.rotateRefreshToken({
      userId: 'user-1',
      token: 'next-token-hash',
      tokenFamily: 'family-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 3_600 * 1_000).toISOString(),
      previousHash: 'current-token-hash',
      previousValidUntil: new Date(Date.now() + 60_000).toISOString(),
      previousUsedAt: null,
    }, 'current-token-hash');

    expect(rotated).toHaveLength(0);
    expect(await repo.getByFamily('family-1')).toBeNull();
  });
});
