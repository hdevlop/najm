import 'reflect-metadata';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { CacheService } from 'najm-cache';
import { authSchema } from '../src/schema/sqlite';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';
import { AuthResolver } from '../src/auth/AuthResolver';
import { CookieManager } from '../src/auth/CookieManager';
import { parseSessionCookiePayload } from '../src/client/sessionCookie';
import { USER, ROLE, PERMISSIONS } from 'najm-guard';

/**
 * Replaying a saved signed session cookie after logout.
 *
 * The snapshot is HMAC-signed, so it stays intact after the session it
 * describes ends — the question is whether the reader treats intact as valid.
 * Every case here asks the resolver the real question ("does this request get a
 * principal?") rather than inspecting how it decided.
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
  (repo as any).getRoleAndPermissions = async () => ({ roleName: 'admin', permissions: ['read:users'] });
  (repo as any).getUser = async (id: string) => ({
    id, email: `${id}@example.test`, status: 'active', role: 'admin', permissions: ['read:users'],
  });

  const jar = { refresh: undefined as string | undefined, session: undefined as any };
  const cookie = {
    getRefreshToken: () => jar.refresh,
    clearRefreshToken: () => { jar.refresh = undefined; },
    setRefreshToken: (value: string) => { jar.refresh = value; },
    getSessionCookie: () => jar.session ?? null,
    setSessionCookie: (data: any) => { jar.session = { ...data, iat: Date.now() }; },
    clearSessionCookie: () => { jar.session = null; },
  };

  const cache = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
  const invalidation = new SessionInvalidationService(cache, repo);
  (invalidation as any).config = authConfig;

  const tokens = new TokenService(repo as any, cookie as any, cache as any, undefined, invalidation);
  (tokens as any).config = authConfig;
  (tokens as any).t = (key: string) => key;

  const resolver = new AuthResolver();
  let middleware: ((ctx: any, next: () => Promise<void>) => Promise<void>) | undefined;
  (resolver as any).app = { use: (_p: string, handler: any) => { middleware = handler; } };
  (resolver as any).log = { warn: () => undefined, debug: () => undefined };
  (resolver as any).container = {
    resolve: async (target: unknown) => {
      if (target === CookieManager) return cookie;
      if (target === TokenService) return tokens;
      throw new Error('unexpected resolve target');
    },
    isActive: () => true,
    set: (token: unknown, value: unknown) => { published.set(token, value); },
  };
  const published = new Map<unknown, unknown>();

  /** Sign in, and keep the snapshot the browser would have saved. */
  async function signIn(userId = 'user-1') {
    const generated = await tokens.generateTokens(userId);
    cookie.setRefreshToken(generated.refreshToken);
    cookie.setSessionCookie({
      user: { id: userId, email: `${userId}@example.test`, role: 'admin', status: 'active' },
      roles: generated.roles,
      permissions: generated.permissions,
      sessionVersion: generated.sessionVersion,
      tokenFamily: generated.tokenFamily,
    });
    return { ...generated, savedSnapshot: { ...jar.session } };
  }

  /** Does a request carrying the current cookie jar get a principal? */
  async function authenticates(authorization?: string): Promise<boolean> {
    published.clear();
    await resolver.activate();
    await middleware!(
      { req: { header: (name: string) => (name === 'authorization' ? authorization : undefined) } },
      async () => undefined,
    );
    return published.has(USER);
  }

  return { tokens, repo, cache, cookie, jar, invalidation, signIn, authenticates, published };
}

describe('a saved session cookie does not outlive its logout', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  test('the snapshot authenticates while the session is live', async () => {
    await h.signIn();
    expect(await h.authenticates()).toBe(true);
    expect(h.published.get(ROLE)).toBe('admin');
    expect(h.published.get(PERMISSIONS)).toEqual(['read:users']);
  });

  for (const slot of ['current', 'previous'] as const) {
    test(`failed database revocation cannot authorize the ${slot} refresh cookie`, async () => {
      const session = await h.signIn();
      if (slot === 'previous') await h.tokens.refreshTokens();
      const otherDevice = await h.signIn();
      h.repo.revokeFamily = async () => { throw new Error('injected delete failure'); };
      await expect(h.tokens.revokeFamily(session.tokenFamily)).rejects.toThrow('injected delete failure');
      const retained = await h.repo.getByFamily(session.tokenFamily);
      expect(retained).not.toBeNull();
      expect(await h.invalidation.familyStatus(session.tokenFamily, 'user-1')).toBe('revoked');

      for (const authorization of [undefined, `Bearer ${session.accessToken}`]) {
        h.jar.refresh = session.refreshToken;
        h.jar.session = session.savedSnapshot;
        expect(await h.authenticates(authorization)).toBe(false);
        expect(h.jar.refresh).toBeUndefined();
        expect(h.jar.session).toBeNull();
      }
      for (const resolve of [
        () => h.tokens.recoverSessionFromCookie(),
        () => h.tokens.refreshTokens(),
      ]) {
        h.jar.refresh = session.refreshToken;
        h.jar.session = session.savedSnapshot;
        await expect(resolve()).rejects.toMatchObject({ status: 401 });
        expect(h.jar.refresh).toBeUndefined();
        expect(h.jar.session).toBeNull();
        expect(await h.repo.getByFamily(session.tokenFamily)).toEqual(retained);
      }

      h.jar.refresh = otherDevice.refreshToken;
      h.jar.session = otherDevice.savedSnapshot;
      expect(await h.authenticates()).toBe(true);
    });
  }

  test('a retained revoked refresh row stays denied beyond the access token lifetime', async () => {
    const session = await h.signIn();
    h.repo.revokeFamily = async () => { throw new Error('injected delete failure'); };
    await expect(h.tokens.revokeFamily(session.tokenFamily)).rejects.toThrow();
    const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    try {
      h.jar.session = undefined;
      h.jar.refresh = session.refreshToken;
      expect(await h.authenticates()).toBe(false);
      expect(await h.repo.getByFamily(session.tokenFamily)).not.toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  test('replaying the saved snapshot after logout is denied', async () => {
    const session = await h.signIn();
    await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);

    // The browser kept the signed cookie and nothing else.
    h.jar.session = session.savedSnapshot;
    h.jar.refresh = undefined;

    expect(await h.authenticates()).toBe(false);
  });

  test('replay is denied with the old refresh cookie still present', async () => {
    const session = await h.signIn();
    await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);

    h.jar.session = session.savedSnapshot;
    h.jar.refresh = session.refreshToken;

    expect(await h.authenticates()).toBe(false);
  });

  test('replay is denied with the old bearer token still presented', async () => {
    const session = await h.signIn();
    await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);

    h.jar.session = session.savedSnapshot;
    expect(await h.authenticates(`Bearer ${session.accessToken}`)).toBe(false);
  });

  test('a second device stays signed in through the first device\'s logout', async () => {
    const deviceA = await h.signIn();
    const deviceB = await h.signIn();

    await h.tokens.logout('user-1', `Bearer ${deviceA.accessToken}`);

    // Device A's browser holds only device A's cookies.
    h.jar.session = deviceA.savedSnapshot;
    h.jar.refresh = deviceA.refreshToken;
    expect(await h.authenticates()).toBe(false);

    h.jar.session = deviceB.savedSnapshot;
    h.jar.refresh = deviceB.refreshToken;
    expect(await h.authenticates()).toBe(true);
  });

  test('revoking every session ends both devices\' snapshots', async () => {
    const deviceA = await h.signIn();
    const deviceB = await h.signIn();

    await h.invalidation.invalidateUser('user-1');

    for (const device of [deviceA, deviceB]) {
      h.jar.session = device.savedSnapshot;
      h.jar.refresh = undefined;
      expect(await h.authenticates()).toBe(false);
    }
  });

  test('losing the cache does not make a revoked family valid again', async () => {
    const session = await h.signIn();
    await h.tokens.logout('user-1', `Bearer ${session.accessToken}`);

    // Everything the cache knew — the revocation marker included — is gone.
    await h.cache.flush();

    h.jar.session = session.savedSnapshot;
    h.jar.refresh = undefined;
    expect(await h.authenticates()).toBe(false);
  });

  test('losing the cache costs a live session only its fast path, not its access', async () => {
    const session = await h.signIn();
    await h.cache.flush();

    // The snapshot can no longer be proven live, but the refresh session is
    // authoritative and still resolves the request.
    h.jar.session = session.savedSnapshot;
    h.jar.refresh = session.refreshToken;
    expect(await h.authenticates()).toBe(true);
  });

  test('a snapshot with no family claim is refused by strict parsing', () => {
    const legacy = JSON.stringify({
      user: { id: 'user-1', email: 'user-1@example.test', role: 'admin' },
      roles: ['admin'],
      permissions: ['read:users'],
      sessionVersion: 0,
      iat: Date.now(),
    });
    expect(parseSessionCookiePayload(legacy, 300)).toBeNull();

    const withFamily = JSON.stringify({ ...JSON.parse(legacy), tokenFamily: 'family-1' });
    expect(parseSessionCookiePayload(withFamily, 300)).toMatchObject({ tokenFamily: 'family-1' });
  });

  test('a legacy snapshot recovers only through a valid refresh session', async () => {
    const session = await h.signIn();

    // A cookie written by the previous release: no family.
    const { tokenFamily: _dropped, ...legacy } = session.savedSnapshot as Record<string, unknown>;
    h.jar.session = legacy;

    h.jar.refresh = session.refreshToken;
    expect(await h.authenticates()).toBe(true);

    h.jar.refresh = undefined;
    expect(await h.authenticates()).toBe(false);
  });

  test('a snapshot naming someone else\'s live family is still refused', async () => {
    const mine = await h.signIn('user-1');
    const theirs = await h.signIn('user-2');

    await h.tokens.logout('user-1', `Bearer ${mine.accessToken}`);

    // No client can produce this pairing — the HMAC covers the claim — but the
    // liveness marker names its owner, so borrowing a family that is genuinely
    // live still does not resolve the logged-out identity.
    h.jar.session = { ...mine.savedSnapshot, tokenFamily: theirs.tokenFamily };
    h.jar.refresh = undefined;

    expect(await h.authenticates()).toBe(false);
  });

  test('a snapshot whose stamped version is behind is refused', async () => {
    const session = await h.signIn();
    await h.invalidation.invalidateAccessTokens('user-1');

    h.jar.session = session.savedSnapshot;
    h.jar.refresh = undefined;
    expect(await h.authenticates()).toBe(false);
  });

  test('a snapshot carrying a non-active status is refused', async () => {
    const session = await h.signIn();
    h.jar.session = {
      ...session.savedSnapshot,
      user: { ...(session.savedSnapshot as any).user, status: 'inactive' },
    };
    h.jar.refresh = undefined;
    expect(await h.authenticates()).toBe(false);
  });

  test('refresh reissues a snapshot bound to the rotated family', async () => {
    const session = await h.signIn();
    const rotated = await h.tokens.refreshTokens();

    expect(rotated.tokenFamily).toBe(session.tokenFamily);
    expect(await h.tokens.isSessionFamilyLive(rotated.tokenFamily)).toBe(true);
  });
});
