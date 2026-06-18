import { describe, expect, test } from 'bun:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { USER } from 'najm-guard';
import { AuthService } from '../src/auth/AuthService';
import { AuthResolver } from '../src/auth/AuthResolver';
import { CookieManager } from '../src/auth/CookieManager';
import { EncryptionService } from '../src/auth/EncryptionService';
import { clean } from '../src/shared';
import { TokenService } from '../src/tokens/TokenService';

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

function createTokenService(overrides: {
  repo?: Record<string, any>;
  cookie?: Record<string, any>;
  cache?: Record<string, any>;
} = {}) {
  const repo = {
    getRefreshTokenWithFamily: async () => null,
    revokeToken: async () => undefined,
    revokeByFamily: async () => undefined,
    getRoleAndPermissions: async () => ({ roleName: null, permissions: [] }),
    ...overrides.repo,
  };
  const cookie = {
    getRefreshToken: () => undefined,
    ...overrides.cookie,
  };
  const cache = {
    get: async () => null,
    set: async () => undefined,
    del: async () => false,
    exists: async () => false,
    ...overrides.cache,
  };

  const service = new TokenService(repo as any, cookie as any, cache as any);
  (service as any).config = authConfig;
  (service as any).t = (key: string) => key;

  return { service, repo, cookie, cache };
}

describe('auth security regressions', () => {
  test('dummy login hash is lazy and uses configured bcrypt rounds', async () => {
    const encryption = new EncryptionService(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
    (encryption as any).config = { bcryptRounds: 4 };
    const service = new AuthService(
      {} as any,
      {} as any,
      {} as any,
      encryption,
      {} as any,
      {} as any,
      {} as any,
    );

    expect((service as any).dummyHash).toBeUndefined();
    const dummyHash = await (service as any).getDummyHash();

    expect(dummyHash).toHaveLength(60);
    expect(bcrypt.getRounds(dummyHash)).toBe(4);
    expect(await bcrypt.compare('wrong-password', dummyHash)).toBe(false);
    expect(await (service as any).getDummyHash()).toBe(dummyHash);
  });

  test('valid session cookie bypasses token and database resolution', async () => {
    let middleware: ((ctx: any, next: () => Promise<void>) => Promise<void>) | undefined;
    const resolved: unknown[] = [];
    const writes: Array<{ token: unknown; value: unknown }> = [];
    const resolver = new AuthResolver();
    (resolver as any).app = {
      use: (_path: string, handler: typeof middleware) => { middleware = handler; },
    };
    (resolver as any).log = { warn: () => undefined };
    (resolver as any).container = {
      resolve: async (target: unknown) => {
        resolved.push(target);
        if (target === CookieManager) {
          return {
            getSessionCookie: () => ({
              user: { id: 'user-1', email: 'user@test.com', role: 'admin' },
              roles: ['admin'],
              permissions: ['read:users'],
              iat: Date.now(),
            }),
          };
        }
        throw new Error('TokenService should not be resolved on the session-cookie hot path');
      },
      isActive: () => true,
      set: (token: unknown, value: unknown) => writes.push({ token, value }),
    };

    await resolver.activate();
    let nextCalls = 0;
    await middleware!({ req: { header: () => undefined } }, async () => { nextCalls++; });

    expect(resolved).toEqual([CookieManager]);
    expect(writes).toHaveLength(3);
    expect(nextCalls).toBe(1);
  });

  test('bearer token resolves via TokenService even when a session cookie exists', async () => {
    let middleware: ((ctx: any, next: () => Promise<void>) => Promise<void>) | undefined;
    const resolved: unknown[] = [];
    const writes: Array<{ token: unknown; value: unknown }> = [];
    const resolver = new AuthResolver();
    (resolver as any).app = {
      use: (_path: string, handler: typeof middleware) => { middleware = handler; },
    };
    (resolver as any).log = { warn: () => undefined };
    (resolver as any).container = {
      resolve: async (target: unknown) => {
        resolved.push(target);
        if (target === TokenService) {
          return {
            getUser: async () => ({
              id: 'token-user',
              email: 'token@test.com',
              role: 'editor',
              permissions: ['write:posts'],
            }),
          };
        }
        if (target === CookieManager) {
          throw new Error('session cookie must not be consulted when a Bearer token is present');
        }
        throw new Error('unexpected resolve target');
      },
      isActive: () => true,
      set: (token: unknown, value: unknown) => writes.push({ token, value }),
    };

    await resolver.activate();
    let nextCalls = 0;
    await middleware!(
      { req: { header: (name: string) => (name === 'authorization' ? 'Bearer abc.def.ghi' : undefined) } },
      async () => { nextCalls++; },
    );

    // Token path wins outright; the session cookie is never consulted.
    expect(resolved).toEqual([TokenService]);
    const userWrite = writes.find((w) => w.token === USER);
    expect((userWrite?.value as any).id).toBe('token-user');
    expect(nextCalls).toBe(1);
  });

  test('clean preserves explicit null update values', () => {
    expect(clean({ name: null, image: '', email: undefined, status: 'active' })).toEqual({
      name: null,
      status: 'active',
    });
  });

  test('session version invalidation uses access-token TTL', async () => {
    const writes: Array<{ key: string; value: string; ttl?: number }> = [];
    const { service } = createTokenService({
      cache: {
        get: async () => null,
        set: async (key: string, value: string, ttl?: number) => {
          writes.push({ key, value, ttl });
        },
        del: async () => true,
      },
    });

    await service.invalidateUserAccessTokens('user-1');

    expect(writes).toContainEqual({
      key: 'auth:session-version:user-1',
      value: '1',
      ttl: 3_600_000,
    });
  });

  test('access-token verification batches blacklist and session-version reads', async () => {
    const reads: string[][] = [];
    const { service } = createTokenService({
      cache: {
        getMany: async (keys: string[]) => {
          reads.push(keys);
          return [null, null];
        },
      },
    });
    const token = jwt.sign(
      { userId: 'user-1', jti: 'jti-1', sessionVersion: 0 },
      authConfig.jwt.accessSecret,
      { expiresIn: '1h' },
    );

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({ userId: 'user-1' });
    expect(reads).toEqual([[
      'auth:blacklist:jti-1',
      'auth:session-version:user-1',
    ]]);
  });

  test('refresh token mismatch revokes the suspected token family', async () => {
    const refreshToken = jwt.sign(
      { userId: 'user-1', type: 'refresh' },
      authConfig.jwt.refreshSecret,
      { expiresIn: '7d' },
    );
    const revokedFamilies: string[] = [];

    const { service } = createTokenService({
      cookie: {
        getRefreshToken: () => refreshToken,
      },
      repo: {
        getRefreshTokenWithFamily: async () => ({
          token: 'not-the-presented-token-hash',
          tokenFamily: 'family-1',
          previousHash: null,
          previousValidUntil: null,
          previousUsedAt: null,
        }),
        revokeByFamily: async (family: string) => {
          revokedFamilies.push(family);
        },
      },
    });

    await expect(service.refreshTokens()).rejects.toThrow();
    expect(revokedFamilies).toEqual(['family-1']);
  });

  test('concurrent grace-window refreshes produce exactly one successful rotation', async () => {
    const refreshToken = jwt.sign(
      { userId: 'user-1', type: 'refresh' },
      authConfig.jwt.refreshSecret,
      { expiresIn: '7d' },
    );
    const presentedHash = createHash('sha256').update(refreshToken).digest('hex');
    let claims = 0;
    const revokedFamilies: string[] = [];

    const { service } = createTokenService({
      cookie: {
        getRefreshToken: () => refreshToken,
      },
      repo: {
        // Presented token is the PREVIOUS (rotated) token, still in grace.
        getRefreshTokenWithFamily: async () => ({
          token: 'current-token-hash',
          tokenFamily: 'family-1',
          previousHash: presentedHash,
          previousValidUntil: new Date(Date.now() + 60_000).toISOString(),
          previousUsedAt: null,
        }),
        // First caller claims the slot; every later caller gets zero rows.
        markPreviousUsed: async () => (claims++ === 0 ? [{ userId: 'user-1' }] : []),
        storeRefreshToken: async () => undefined,
        getRoleAndPermissions: async () => ({ roleName: 'user', permissions: [] }),
        revokeByFamily: async (family: string) => { revokedFamilies.push(family); },
      },
    });

    const winner = await service.refreshTokens();
    expect(winner.accessToken).toBeDefined();

    // The loser fails instead of rotating a second time, and does NOT revoke.
    await expect(service.refreshTokens()).rejects.toThrow();
    expect(claims).toBe(2);
    expect(revokedFamilies).toEqual([]);
  });
});
