import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';

/**
 * Browser tabs share one cookie jar, so several refreshes can present the same
 * refresh token: tabs whose access tokens were issued together (a browser
 * aligns the timers of hidden tabs), or a tab and a server render. Only one of
 * them may rotate the token; the others must be served the same new token, so
 * the jar holds the current one whichever response lands last, and none of
 * them may be mistaken for a stolen token. Reuse after the grace window, or of
 * a token the family never issued, must still revoke the family.
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
  (repo as any).getRoleAndPermissions = async () => ({ roleName: null, permissions: [] });
  (repo as any).getUser = async (id: string) => ({
    id, email: `${id}@example.com`, status: 'active', role: null, permissions: [],
  });

  const cacheStore = new Map<string, string>();
  const cache = {
    get: async (key: string) => cacheStore.get(key) ?? null,
    set: async (key: string, value: string) => { cacheStore.set(key, value); },
    del: async (key: string) => { cacheStore.delete(key); return true; },
    exists: async (key: string) => cacheStore.has(key),
    compareAndDelete: async (key: string, expected: string) =>
      cacheStore.get(key) === expected && cacheStore.delete(key),
    incr: async (key: string) => {
      const count = Number(cacheStore.get(key) ?? '0') + 1;
      cacheStore.set(key, String(count));
      return { count, resetAt: Date.now() };
    },
    expire: async (key: string) => cacheStore.has(key),
  };

  /**
   * One service per request, as the container gives each request its own
   * cookie reader, all sharing the database and cache.
   */
  const withCookie = (refreshToken: string) => {
    const cookie = { getRefreshToken: () => refreshToken, clearRefreshToken() {}, clearSessionCookie() {} };
    const service = new TokenService(repo as any, cookie as any, cache as any);
    (service as any).config = authConfig;
    (service as any).t = (key: string) => key;
    return service;
  };

  return { db, withCookie };
}

const familyRow = async (db: any, family: string) =>
  (await db.select().from(authSchema.tokens).where(eq(authSchema.tokens.tokenFamily, family)))[0];

describe('refreshes that share one refresh cookie (real bun:sqlite)', () => {
  let h: ReturnType<typeof makeService>;
  beforeEach(() => { h = makeService(); });

  test('three presented together are all served the same new token, with one rotation, and the family stays live', async () => {
    const login = await h.withCookie('').generateTokens('user-1');

    const results = await Promise.allSettled([1, 2, 3].map(() =>
      h.withCookie(login.refreshToken).refreshTokens()));

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    const issued = results.map((result) => (result as PromiseFulfilledResult<any>).value.refreshToken);
    expect(issued[0]).toBeString();
    expect(new Set(issued).size).toBe(1);

    // One rotation: the row replaced the login token, not a token issued here.
    const row = await familyRow(h.db, login.tokenFamily);
    expect(row.status).toBe('active');
    expect(row.token).toBe(hashToken(issued[0]));
    expect(row.previousHash).toBe(hashToken(login.refreshToken));

    // The rotated token keeps the session going.
    expect((await h.withCookie(issued[0]).refreshTokens()).accessToken).toBeDefined();
  });

  test('the replaced token presented again inside the grace window is served the current token without rotating, any number of times', async () => {
    const login = await h.withCookie('').generateTokens('user-1');
    const rotated = await h.withCookie(login.refreshToken).refreshTokens();

    for (let attempt = 0; attempt < 3; attempt++) {
      const late = await h.withCookie(login.refreshToken).refreshTokens();
      expect(late.accessToken).toBeDefined();
      expect(late.refreshToken).toBe(rotated.refreshToken);
    }

    const row = await familyRow(h.db, login.tokenFamily);
    expect(row.status).toBe('active');
    expect(row.token).toBe(hashToken(rotated.refreshToken));
    expect(row.previousHash).toBe(hashToken(login.refreshToken));

    expect((await h.withCookie(rotated.refreshToken).refreshTokens()).refreshToken).toBeDefined();
  });

  test('a rotation whose response never reached the browser is recovered, and outlives the grace window', async () => {
    // The page reloads while a refresh is in flight: the server rotates, but
    // the browser never stores the new cookie and presents the old one again.
    const login = await h.withCookie('').generateTokens('user-1');
    await h.withCookie(login.refreshToken).refreshTokens();

    const recovered = await h.withCookie(login.refreshToken).refreshTokens();
    expect(recovered.refreshToken).toBeString();
    await h.db.update(authSchema.tokens)
      .set({ previousValidUntil: new Date(Date.now() - 1_000).toISOString() })
      .where(eq(authSchema.tokens.tokenFamily, login.tokenFamily));

    const next = await h.withCookie(recovered.refreshToken!).refreshTokens();
    expect(next.refreshToken).toBeString();
    expect((await familyRow(h.db, login.tokenFamily)).status).toBe('active');
  });

  test('a current token it cannot rebuild is left in place, and the replaced one gets an access token only', async () => {
    // A family rotated by a release that minted refresh tokens at random.
    const login = await h.withCookie('').generateTokens('user-1');
    const unrelated = h.withCookie('').generateRefreshToken({ userId: 'user-1', tokenFamily: login.tokenFamily });
    await h.db.update(authSchema.tokens)
      .set({
        token: hashToken(unrelated),
        previousHash: hashToken(login.refreshToken),
        previousValidUntil: new Date(Date.now() + 60_000).toISOString(),
      })
      .where(eq(authSchema.tokens.tokenFamily, login.tokenFamily));

    const late = await h.withCookie(login.refreshToken).refreshTokens();
    expect(late.accessToken).toBeDefined();
    expect(late.refreshToken).toBeUndefined();
    expect((await familyRow(h.db, login.tokenFamily)).token).toBe(hashToken(unrelated));
  });

  test('the replaced token presented after the grace window still revokes the family', async () => {
    const login = await h.withCookie('').generateTokens('user-1');
    await h.withCookie(login.refreshToken).refreshTokens();
    await h.db.update(authSchema.tokens)
      .set({ previousValidUntil: new Date(Date.now() - 1_000).toISOString() })
      .where(eq(authSchema.tokens.tokenFamily, login.tokenFamily));

    await expect(h.withCookie(login.refreshToken).refreshTokens()).rejects.toThrow();
    expect((await familyRow(h.db, login.tokenFamily)).status).toBe('revoked');
  });

  test('a token the family never issued still revokes the family', async () => {
    const login = await h.withCookie('').generateTokens('user-1');
    const forged = jwt.sign(
      { userId: 'user-1', type: 'refresh', tokenFamily: login.tokenFamily, jti: 'never-issued' },
      authConfig.jwt.refreshSecret,
      { expiresIn: '7d' },
    );

    await expect(h.withCookie(forged).refreshTokens()).rejects.toThrow();
    expect((await familyRow(h.db, login.tokenFamily)).status).toBe('revoked');
  });
});
