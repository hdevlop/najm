import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { CacheService } from 'najm-cache';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';

/**
 * Two ways a revoked session could come back to life.
 *
 * Both are races or failures of *ordering* rather than of any single check, so
 * every case here drives the real services and asks the same question at the
 * end: can this credential still authorize a request?
 */

const authConfig = {
  jwt: {
    accessSecret: 'access-secret-access-secret-access-secret',
    accessExpiresIn: '1h',
    refreshSecret: 'refresh-secret-refresh-secret-refresh-secret',
    refreshExpiresIn: '7d',
  },
  refreshCookieName: 'refreshToken',
  database: 'default',
  blacklistPrefix: 'auth:blacklist:',
  defaultRole: null,
  frontendUrl: 'http://localhost:3000',
  registrationMode: 'active' as const,
  lockout: { maxAttempts: 5, duration: '15m' },
  bcryptRounds: 10,
  session: { name: 'najm.session', maxAge: 300 },
};

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

function harness() {
  const sqlite = new Database(':memory:');
  sqlite.exec(TOKENS_DDL);
  const db = drizzle(sqlite, { schema: authSchema });

  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;
  (repo as any).getRoleAndPermissions = async () => ({ roleName: 'admin', permissions: [] });
  (repo as any).getUser = async (id: string) => ({
    id, email: `${id}@example.test`, status: 'active', role: 'admin', permissions: [],
  });

  const jar = { refresh: undefined as string | undefined };
  const cookie = {
    getRefreshToken: () => jar.refresh,
    setRefreshToken: (v: string) => { jar.refresh = v; },
    clearRefreshToken: () => { jar.refresh = undefined; },
    clearSessionCookie: () => undefined,
  };

  const cache = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
  const invalidation = new SessionInvalidationService(cache, repo);
  (invalidation as any).config = authConfig;

  const tokens = new TokenService(repo as any, cookie as any, cache as any, undefined, invalidation);
  (tokens as any).config = authConfig;
  (tokens as any).t = (key: string) => key;

  return { db, repo, cache, tokens, invalidation, jar };
}

const authorizes = async (tokens: TokenService, accessToken: string): Promise<boolean> => {
  try {
    await tokens.verifyAccessToken(accessToken);
    return true;
  } catch {
    return false;
  }
};

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe('a revoked family cannot be brought back to life', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  test('issuance that lands after revocation does not resurrect the family', async () => {
    const session = await h.tokens.generateTokens('user-1');
    expect(await h.tokens.isSessionFamilyLive(session.tokenFamily, 'user-1')).toBe(true);

    await h.invalidation.markFamilyRevoked(session.tokenFamily);
    // A refresh that rotated before the logout, then resumed after it.
    await h.invalidation.markFamilyIssued(session.tokenFamily, 'user-1');

    expect(await h.tokens.isSessionFamilyLive(session.tokenFamily, 'user-1')).toBe(false);
  });

  for (const first of ['issue', 'revoke'] as const) {
    test(`${first} pauses after its cache write while the other operation completes`, async () => {
      const session = await h.tokens.generateTokens('user-1');
      const reached = barrier();
      const resume = barrier();
      const pausedKey = first === 'issue'
        ? h.invalidation.familyKey(session.tokenFamily)
        : h.invalidation.revokedFamilyKey(session.tokenFamily);
      const set = h.cache.set.bind(h.cache);
      h.cache.set = async (...args: Parameters<typeof set>) => {
        const result = await set(...args);
        if (args[0] === pausedKey) {
          reached.release();
          await resume.promise;
        }
        return result;
      };
      const issue = () => h.invalidation.markFamilyIssued(session.tokenFamily, 'user-1');
      const revoke = () => h.invalidation.markFamilyRevoked(session.tokenFamily);
      const pending = first === 'issue' ? issue() : revoke();
      try {
        await reached.promise;
        await (first === 'issue' ? revoke() : issue());
        expect(await h.invalidation.familyStatus(session.tokenFamily, 'user-1')).toBe('revoked');
      } finally {
        resume.release();
        await pending;
        h.cache.set = set;
      }
      expect(await h.cache.get(h.invalidation.familyKey(session.tokenFamily))).toBeNull();
      expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
    });
  }

  test('a refresh paused after its rotation cannot outlive the logout that followed', async () => {
    const session = await h.tokens.generateTokens('user-1');
    h.jar.refresh = session.refreshToken;

    const committed = barrier();
    const resume = barrier();
    const rotate = h.repo.rotateRefreshToken.bind(h.repo);
    h.repo.rotateRefreshToken = async (...args: Parameters<typeof rotate>) => {
      const result = await rotate(...args);
      expect(result.length).toBe(1);
      committed.release();
      await resume.promise;
      return result;
    };
    const rotating = h.tokens.refreshTokens().then(
      (value) => ({ value, error: undefined }),
      (error: unknown) => ({ value: undefined, error }),
    );
    try {
      await committed.promise;
      await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);
    } finally {
      resume.release();
    }
    const result = await rotating;
    expect(result.error).toMatchObject({ status: 401 });
    expect(result.value).toBeUndefined();

    expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
    expect(await h.tokens.isSessionFamilyLive(session.tokenFamily, 'user-1')).toBe(false);
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
    h.jar.refresh = session.refreshToken;
    await expect(h.tokens.getUserFromCookie()).rejects.toMatchObject({ status: 401 });
  });

  test('the revoked marker is authoritative even if a liveness marker exists', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.invalidation.markFamilyRevoked(session.tokenFamily);

    // Write the liveness key directly, behind the service's back.
    await h.cache.set(h.invalidation.familyKey(session.tokenFamily), 'user-1', 60_000);

    expect(await h.tokens.isSessionFamilyLive(session.tokenFamily, 'user-1')).toBe(false);
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('issuance paused after storing its row rejects when revocation completes', async () => {
    const family = 'pending-issuance';
    const committed = barrier();
    const resume = barrier();
    const store = h.repo.storeRefreshToken.bind(h.repo);
    h.repo.storeRefreshToken = async (...args: Parameters<typeof store>) => {
      const result = await store(...args);
      committed.release();
      await resume.promise;
      return result;
    };
    const issuing = h.tokens.generateTokens('user-1', family).then(
      (value) => ({ value, error: undefined }),
      (error: unknown) => ({ value: undefined, error }),
    );
    try {
      await committed.promise;
      expect(await h.repo.getByFamily(family)).not.toBeNull();
      await h.tokens.revokeFamily(family);
    } finally {
      resume.release();
    }
    const result = await issuing;
    expect(result.error).toMatchObject({ status: 401 });
    expect(result.value).toBeUndefined();
    expect(await h.repo.getByFamily(family)).toBeNull();
    expect(await h.invalidation.familyStatus(family, 'user-1')).toBe('revoked');
  });

  test('explicit issuance cannot recreate a known revoked family', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.tokens.revokeFamily(session.tokenFamily);
    await expect(h.tokens.generateTokens('user-1', session.tokenFamily))
      .rejects.toMatchObject({ status: 401 });
    expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
  });
});

describe('bearer verification does not rely on absence alone', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  test('a live token still authorizes', async () => {
    const session = await h.tokens.generateTokens('user-1');
    expect(await authorizes(h.tokens, session.accessToken)).toBe(true);
  });

  test('losing the cache does not revive a revoked bearer token', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);

    // Everything the cache knew is gone: blacklist entry, revocation marker,
    // and session version all read as absent again.
    await h.cache.flush();

    expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('losing the cache also denies a token whose account was invalidated', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.invalidation.invalidateUser('user-1');
    await h.cache.flush();

    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
  });

  test('a token carrying no family at all fails closed', async () => {
    const orphan = await h.tokens.generateAccessToken({ userId: 'user-1' });
    expect(await authorizes(h.tokens, orphan)).toBe(false);
  });

  test('a token cannot borrow another user\'s live family', async () => {
    const mine = await h.tokens.generateTokens('user-1');
    const theirs = await h.tokens.generateTokens('user-2');

    await h.tokens.logout('user-1', `Bearer ${mine.accessToken}`);

    const borrowed = await h.tokens.generateAccessToken({
      userId: 'user-1',
      tokenFamily: theirs.tokenFamily,
    });
    expect(await authorizes(h.tokens, borrowed)).toBe(false);
  });

  test('cache loss costs a live session a round trip, not its account', async () => {
    const session = await h.tokens.generateTokens('user-1');
    await h.cache.flush();

    // The bearer token is refused, but the refresh session is database-backed
    // and still re-establishes the user.
    expect(await authorizes(h.tokens, session.accessToken)).toBe(false);

    h.jar.refresh = session.refreshToken;
    const rotated = await h.tokens.refreshTokens();
    expect(await authorizes(h.tokens, rotated.accessToken)).toBe(true);
  });
});
