import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { CacheService } from 'najm-cache';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { AuthService } from '../src/auth/AuthService';
import { UserValidator } from '../src/users/UserValidator';

/**
 * One-time consumption of reset and invite tokens, against a real cache driver
 * and a real SQL database.
 *
 * The defect this covers is a race, so nothing here stubs the cache: the real
 * MemoryDriver decides the winner, and the assertions are on how many callers
 * were told to proceed — not on how the service reached that answer.
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

const STRONG = 'NewStrongPassw0rd';
const OTHER_STRONG = 'OtherStrongPassw0rd';

function harness() {
  const sqlite = new Database(':memory:');
  sqlite.exec(TOKENS_DDL);
  const db = drizzle(sqlite, { schema: authSchema });

  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;
  (repo as any).getRoleAndPermissions = async () => ({ roleName: null, permissions: [] });
  (repo as any).getUser = async (id: string) => ({
    id,
    email: `${id}@example.com`,
    status: 'active',
    role: null,
    permissions: [],
  });

  const cookie = {
    value: undefined as string | undefined,
    getRefreshToken() { return this.value; },
    clearRefreshToken() { this.value = undefined; },
    clearSessionCookie() { /* no session cookie in this harness */ },
  };

  // The real cache service and its real driver decide every race below.
  const cache = new CacheService({ driver: 'memory', required: false, memory: {} } as any);

  const tokens = new TokenService(repo as any, cookie as any, cache as any);
  (tokens as any).config = authConfig;
  (tokens as any).t = (key: string) => key;

  const validator = new UserValidator();
  (validator as any).t = (key: string) => key;

  const passwordsSet: Array<{ userId: string; password: string }> = [];
  const userUpdates: Array<{ userId: string; data: Record<string, unknown> }> = [];
  let userStatus: 'active' | 'inactive' | 'pending' = 'active';
  let updateFails = false;

  const userService = {
    getById: async (userId: string) => ({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: false,
      status: userStatus,
    }),
    update: async (userId: string, data: Record<string, unknown>) => {
      if (updateFails) throw new Error('storage unavailable');
      userUpdates.push({ userId, data });
      passwordsSet.push({ userId, password: String(data.password) });
      return undefined;
    },
  };

  const auth = new AuthService(
    tokens,
    userService as any,
    validator as any,
    {} as any,
    cookie as any,
    {} as any,
    {} as any,
  );
  (auth as any).config = authConfig;
  (auth as any).t = (key: string) => key;

  return {
    db, repo, tokens, auth, cache, cookie, passwordsSet, userUpdates,
    setUserStatus: (status: typeof userStatus) => { userStatus = status; },
    failNextUpdates: () => { updateFails = true; },
    allowUpdates: () => { updateFails = false; },
  };
}

const settledOk = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r) => r.status === 'fulfilled');

const rowsForUser = (db: any, userId: string) =>
  db.select().from(authSchema.tokens).where(eq(authSchema.tokens.userId, userId));

describe('one-time reset/invite token consumption', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  test('two concurrent verifications of the same token: exactly one wins', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');

    const results = await Promise.allSettled([
      h.tokens.verifyResetToken(token),
      h.tokens.verifyResetToken(token),
    ]);

    expect(settledOk(results)).toHaveLength(1);
  });

  test('eight concurrent resets set exactly one password, and it is the winner\'s', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');

    const attempts = Array.from({ length: 8 }, (_, i) => `Concurrent${i}Passw0rd`);
    const results = await Promise.allSettled(
      attempts.map((password) => h.auth.resetPassword(token, password)),
    );

    expect(settledOk(results)).toHaveLength(1);
    expect(h.passwordsSet).toHaveLength(1);
    expect(attempts).toContain(h.passwordsSet[0].password);
    expect(h.passwordsSet[0].userId).toBe('user-1');
  });

  test('a successful reset revokes every existing session for that user only', async () => {
    await h.tokens.generateTokens('user-1');
    await h.tokens.generateTokens('user-1');
    await h.tokens.generateTokens('user-2');

    const { token } = await h.tokens.generateResetToken('user-1');
    await h.auth.resetPassword(token, STRONG);

    expect((await rowsForUser(h.db, 'user-1')).filter(
      (row: { status?: string | null }) => row.status === 'active',
    )).toHaveLength(0);
    expect((await rowsForUser(h.db, 'user-1')).every(
      (row: { status?: string | null }) => row.status === 'revoked',
    )).toBe(true);
    expect((await rowsForUser(h.db, 'user-2')).filter(
      (row: { status?: string | null }) => row.status === 'active',
    )).toHaveLength(1);
    expect(await h.cache.get('auth:session-version:user-1')).toBe('1');
  });

  test('an ordinary reset preserves verification and lifecycle state', async () => {
    h.setUserStatus('pending');
    const { token } = await h.tokens.generateResetToken('user-1');

    await h.auth.resetPassword(token, STRONG);

    expect(h.userUpdates).toEqual([{
      userId: 'user-1',
      data: { password: STRONG },
    }]);
  });

  test('accepting an invite verifies the email and activates a pending account', async () => {
    h.setUserStatus('pending');
    const { token } = await h.tokens.generateInviteToken('user-1');

    await h.auth.resetPassword(token, STRONG);

    expect(h.userUpdates).toEqual([{
      userId: 'user-1',
      data: {
        password: STRONG,
        emailVerified: true,
        status: 'active',
      },
    }]);
  });

  test('accepting an invite verifies but does not reactivate an inactive account', async () => {
    h.setUserStatus('inactive');
    const { token } = await h.tokens.generateInviteToken('user-1');

    await h.auth.resetPassword(token, STRONG);

    expect(h.userUpdates).toEqual([{
      userId: 'user-1',
      data: {
        password: STRONG,
        emailVerified: true,
      },
    }]);
  });

  test('a consumed token is rejected on every later use', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');
    await h.auth.resetPassword(token, STRONG);

    expect(h.auth.resetPassword(token, OTHER_STRONG)).rejects.toThrow();
    expect(h.tokens.verifyResetToken(token)).rejects.toThrow();
    expect(h.passwordsSet).toHaveLength(1);
  });

  test('a weak replacement password is rejected without burning the link', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');

    expect(h.auth.resetPassword(token, 'weak')).rejects.toThrow();

    // The link the user was emailed still works.
    await h.auth.resetPassword(token, STRONG);
    expect(h.passwordsSet).toEqual([{ userId: 'user-1', password: STRONG }]);
  });

  test('a token consumed by a request that then fails storage stays consumed', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');

    h.failNextUpdates();
    expect(h.auth.resetPassword(token, STRONG)).rejects.toThrow('storage unavailable');
    await Bun.sleep(0);

    // Deliberate: the token is not restored. A restored token would be
    // replayable, so the user requests a new link instead.
    h.allowUpdates();
    expect(h.auth.resetPassword(token, STRONG)).rejects.toThrow();
    expect(h.passwordsSet).toHaveLength(0);
  });

  test('a superseded token cannot delete the newer token that replaced it', async () => {
    const stale = await h.tokens.generateResetToken('user-1');
    const fresh = await h.tokens.generateResetToken('user-1');

    expect(h.tokens.verifyResetToken(stale.token)).rejects.toThrow();

    // The newer link is untouched by the stale one's failed attempt.
    expect(await h.tokens.verifyResetToken(fresh.token)).toBe('user-1');
  });

  test('invite tokens preserve their purpose through the one-time path', async () => {
    const invite = await h.tokens.generateInviteToken('user-1');

    const results = await Promise.allSettled([
      h.tokens.consumeSetPasswordToken(invite.token),
      h.tokens.consumeSetPasswordToken(invite.token),
    ]);

    expect(settledOk(results)).toHaveLength(1);
    expect(results.find((result) => result.status === 'fulfilled')).toMatchObject({
      value: { userId: 'user-1', type: 'invite' },
    });
    expect(h.tokens.verifyResetToken(invite.token)).rejects.toThrow();
  });

  test('expired, wrong-type, forged, and unknown tokens are all rejected', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { refreshSecret, accessSecret } = authConfig.jwt;

    const expired = jwt.sign(
      { userId: 'user-1', type: 'reset', jti: 'x', exp: Math.floor(Date.now() / 1000) - 10 },
      refreshSecret,
    );
    const wrongType = jwt.sign({ userId: 'user-1', type: 'refresh', jti: 'x' }, refreshSecret);
    const noJti = jwt.sign({ userId: 'user-1', type: 'reset' }, refreshSecret);
    const forged = jwt.sign({ userId: 'user-1', type: 'reset', jti: 'x' }, accessSecret);
    const unknown = jwt.sign({ userId: 'nobody', type: 'reset', jti: 'x' }, refreshSecret);

    for (const token of [expired, wrongType, noJti, forged, unknown, 'not-a-jwt']) {
      expect(h.tokens.verifyResetToken(token)).rejects.toThrow();
    }
  });

  test('a cache without the atomic primitive refuses to consume at all', async () => {
    const { token } = await h.tokens.generateResetToken('user-1');

    // Emulating consumption with get()+del() is the defect, so an incapable
    // cache must fail the request rather than fall back to it.
    const degraded = {
      get: async () => null,
      set: async () => undefined,
      del: async () => true,
      exists: async () => false,
    };
    (h.tokens as any).cache = degraded;

    expect(h.tokens.verifyResetToken(token)).rejects.toThrow(
      /atomic compare-and-delete/,
    );
  });
});
