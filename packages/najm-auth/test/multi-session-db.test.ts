import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { AuthService } from '../src/auth/AuthService';

/**
 * End-to-end multi-session coverage against a real bun:sqlite database. The
 * full TokenRepository runs against real SQL — only the role/permission lookup
 * (irrelevant to session isolation) is stubbed, so every family-scoped CRUD
 * path (upsert-by-family, getByFamily, markPreviousUsed, revokeFamily,
 * revokeAllForUser, deleteExpired) is exercised for real.
 *
 * Proves the core multi-session guarantees:
 *   - independent families per login
 *   - rotation / logout / reuse-revocation isolated to one family
 *   - no global session-version bump on single-family operations
 *   - password-flow revoke-all still nukes every session
 *   - expired-session cleanup
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

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function makeService() {
  const sqlite = new Database(':memory:');
  sqlite.exec(TOKENS_DDL);
  const db = drizzle(sqlite, { schema: authSchema });

  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;
  // Session isolation does not depend on roles/permissions — stub the join.
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
  };

  const cacheStore = new Map<string, string>();
  const cache = {
    get: async (key: string) => cacheStore.get(key) ?? null,
    set: async (key: string, value: string) => { cacheStore.set(key, value); },
    del: async (key: string) => { cacheStore.delete(key); return true; },
    exists: async (key: string) => cacheStore.has(key),
  };

  const service = new TokenService(repo as any, cookie as any, cache as any);
  (service as any).config = authConfig;
  (service as any).t = (key: string) => key;

  return { service, repo, db, cookie, cacheStore };
}

const rowsForUser = (db: any, userId: string) =>
  db.select().from(authSchema.tokens).where(eq(authSchema.tokens.userId, userId));

describe('multi-session refresh tokens (real bun:sqlite)', () => {
  let h: ReturnType<typeof makeService>;
  beforeEach(() => { h = makeService(); });

  test('two logins create independent families; neither invalidates the other', async () => {
    const a = await h.service.generateTokens('user-1');
    const b = await h.service.generateTokens('user-1');

    expect(a.tokenFamily).not.toBe(b.tokenFamily);
    expect(await rowsForUser(h.db, 'user-1')).toHaveLength(2);

    // Both sessions still refresh successfully.
    h.cookie.value = a.refreshToken;
    expect((await h.service.refreshTokens()).accessToken).toBeDefined();

    h.cookie.value = b.refreshToken;
    expect((await h.service.refreshTokens()).accessToken).toBeDefined();
  });

  test('rotation is isolated to the rotating family', async () => {
    const a = await h.service.generateTokens('user-1');
    const b = await h.service.generateTokens('user-1');

    h.cookie.value = a.refreshToken;
    await h.service.refreshTokens(); // rotates family A only

    const bRow = await h.repo.getByFamily(b.tokenFamily);
    // B's stored hash is untouched by A's rotation.
    expect(bRow!.token).toBe(hashToken(b.refreshToken));
  });

  test('a fresh login does not inherit another family grace window', async () => {
    const a = await h.service.generateTokens('user-1');
    h.cookie.value = a.refreshToken;
    await h.service.refreshTokens(); // family A now carries a previousHash

    const b = await h.service.generateTokens('user-1'); // fresh family
    const bRow = await h.repo.getByFamily(b.tokenFamily);
    expect(bRow!.previousHash).toBeNull();
    expect(bRow!.previousValidUntil).toBeNull();
  });

  test('logout revokes only the current session', async () => {
    const a = await h.service.generateTokens('user-1');
    const b = await h.service.generateTokens('user-1');

    h.cookie.value = a.refreshToken; // logout resolves family A from the cookie
    await h.service.logout('user-1');

    expect(await h.repo.getByFamily(a.tokenFamily)).toBeNull();
    expect(await h.repo.getByFamily(b.tokenFamily)).not.toBeNull();
    expect(h.cacheStore.has(`auth:revoked-family:${a.tokenFamily}`)).toBe(true);
    // Single-session logout must NOT bump the global per-user version.
    expect(h.cacheStore.has('auth:session-version:user-1')).toBe(false);
  });

  test('logout prefers the verified Bearer family over a different refresh cookie', async () => {
    const a = await h.service.generateTokens('user-1');
    const b = await h.service.generateTokens('user-1');

    h.cookie.value = a.refreshToken; // stray/different browser cookie
    await h.service.logout('user-1', `Bearer ${b.accessToken}`);

    expect(await h.repo.getByFamily(a.tokenFamily)).not.toBeNull();
    expect(await h.repo.getByFamily(b.tokenFamily)).toBeNull();
    expect(h.cacheStore.has(`auth:revoked-family:${a.tokenFamily}`)).toBe(false);
    expect(h.cacheStore.has(`auth:revoked-family:${b.tokenFamily}`)).toBe(true);
    expect(h.cacheStore.has('auth:session-version:user-1')).toBe(false);
  });

  test('stale-token reuse revokes only the suspect family, no global bump', async () => {
    const a = await h.service.generateTokens('user-1');
    const b = await h.service.generateTokens('user-1');

    // Rotate A twice so the original token is stale beyond the grace window.
    h.cookie.value = a.refreshToken;
    const a2 = await h.service.refreshTokens();
    h.cookie.value = a2.refreshToken;
    await h.service.refreshTokens();

    // Replay the original (now stale) refresh token.
    h.cookie.value = a.refreshToken;
    await expect(h.service.refreshTokens()).rejects.toThrow();

    expect(await h.repo.getByFamily(a.tokenFamily)).toBeNull();
    expect(await h.repo.getByFamily(b.tokenFamily)).not.toBeNull();
    expect(h.cacheStore.has(`auth:revoked-family:${a.tokenFamily}`)).toBe(true);
    expect(h.cacheStore.has('auth:session-version:user-1')).toBe(false);
  });

  test('revokeAllForUser deletes every session for the user only', async () => {
    await h.service.generateTokens('user-1');
    await h.service.generateTokens('user-1');
    await h.service.generateTokens('user-2');

    await h.service.revokeAllForUser('user-1');

    expect(await rowsForUser(h.db, 'user-1')).toHaveLength(0);
    expect(await rowsForUser(h.db, 'user-2')).toHaveLength(1);
  });

  test('public revokeFamily deletes the row and revokes its access tokens', async () => {
    const live = await h.service.generateTokens('user-1');

    await h.service.revokeFamily(live.tokenFamily);

    expect(await h.repo.getByFamily(live.tokenFamily)).toBeNull();
    expect(h.cacheStore.has(`auth:revoked-family:${live.tokenFamily}`)).toBe(true);
    await expect(h.service.verifyAccessToken(live.accessToken)).rejects.toThrow();
  });

  test('deleteExpiredSessions prunes only expired rows', async () => {
    await h.db.insert(authSchema.tokens).values({
      userId: 'user-1',
      token: 'expired-hash',
      tokenFamily: 'family-expired',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const live = await h.service.generateTokens('user-1');

    await h.service.deleteExpiredSessions();

    expect(await h.repo.getByFamily('family-expired')).toBeNull();
    expect(await h.repo.getByFamily(live.tokenFamily)).not.toBeNull();
  });

  test('password reset revokes every session and bumps the global version', async () => {
    // Two live sessions for the user being reset, plus an unrelated user.
    await h.service.generateTokens('user-1');
    await h.service.generateTokens('user-1');
    await h.service.generateTokens('user-2');

    const cleared: string[] = [];
    const auth = new AuthService(
      h.service,                                                  // real TokenService
      { update: async () => undefined } as any,                   // userService
      { validatePasswordStrength: () => undefined } as any,       // userValidator
      {} as any,                                                  // encryptionService
      {                                                           // cookieManager
        clearRefreshToken: () => cleared.push('refresh'),
        clearSessionCookie: () => cleared.push('session'),
      } as any,
      {} as any,                                                  // i18nService
      {} as any,                                                  // emailService
    );
    (auth as any).config = authConfig;
    (auth as any).t = (key: string) => key;

    // Mint a real reset token (stores its jti in the shared cache).
    const { token } = await h.service.generateResetToken('user-1');
    await auth.resetPassword(token, 'NewStrongPassw0rd!');

    // Every session for user-1 is gone; user-2 is untouched.
    expect(await rowsForUser(h.db, 'user-1')).toHaveLength(0);
    expect(await rowsForUser(h.db, 'user-2')).toHaveLength(1);
    // Global per-user access-token invalidation fired (revoke-all, not per-family).
    expect(h.cacheStore.has('auth:session-version:user-1')).toBe(true);
    expect(cleared).toEqual(['refresh', 'session']);
  });
});
