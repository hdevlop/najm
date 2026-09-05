import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import Redis from 'ioredis';
import { CacheService } from 'najm-cache';

import { AuthService } from '../src/auth/AuthService';
import { authSchema } from '../src/schema/pg';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { UserValidator } from '../src/users/UserValidator';

/**
 * Opt-in acceptance for the two security properties that an in-memory cache
 * and SQLite cannot prove: Redis Lua consumption and PostgreSQL/Redis session
 * revocation races.
 *
 * The suite creates and drops its own PostgreSQL database and uses a unique
 * Redis key prefix. Remote endpoints are refused even when the opt-in flag is
 * set so this test cannot be pointed at production by accident.
 */

const enabled = process.env.NAJM_AUTH_REAL_INFRA === '1';
const realInfra = enabled ? describe : describe.skip;

const authConfig = {
  jwt: {
    accessSecret: 'acceptance-access-secret-acceptance-access-secret',
    accessExpiresIn: '1h',
    refreshSecret: 'acceptance-refresh-secret-acceptance-refresh-secret',
    refreshExpiresIn: '7d',
  },
  refreshCookieName: 'refreshToken',
  database: 'default',
  blacklistPrefix: 'auth:blacklist:',
  defaultRole: null,
  frontendUrl: 'http://127.0.0.1:3000',
  registrationMode: 'active' as const,
  lockout: { maxAttempts: 5, duration: '15m' },
  bcryptRounds: 4,
  session: { name: 'najm.session', maxAge: 300 },
};

const DDL = [
  `CREATE TYPE "userStatus" AS ENUM ('active', 'inactive', 'pending')`,
  `CREATE TYPE "tokenStatus" AS ENUM ('active', 'revoked', 'expired')`,
  `CREATE TYPE "tokenType" AS ENUM ('access', 'refresh')`,
  `CREATE TABLE users (
    id text PRIMARY KEY,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
    name text,
    email text NOT NULL UNIQUE,
    email_verified boolean DEFAULT false,
    phone text UNIQUE,
    phone_verified boolean DEFAULT false,
    password text NOT NULL,
    image text DEFAULT 'noavatar.png',
    status "userStatus" DEFAULT 'pending',
    role_id text,
    last_login timestamp,
    failed_login_attempts integer DEFAULT 0,
    lockout_until timestamp
  )`,
  `CREATE TABLE tokens (
    id text PRIMARY KEY,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token text NOT NULL,
    token_family text NOT NULL UNIQUE,
    previous_hash text,
    previous_valid_until timestamp,
    previous_used_at timestamp,
    type "tokenType" DEFAULT 'refresh',
    status "tokenStatus" DEFAULT 'active',
    expires_at timestamp NOT NULL
  )`,
];

let adminSql: SQL;
let databaseSql: SQL;
let databaseName: string;
let redisUrl: string;
let redisPrefix: string;

function requireLoopbackUrl(name: string): URL {
  const fallback = name === 'NAJM_AUTH_REAL_POSTGRES_URL'
    ? 'DATABASE_URL'
    : 'REDIS_URL';
  const raw = process.env[name] ?? process.env[fallback];
  if (!raw) throw new Error(`${name} is required when NAJM_AUTH_REAL_INFRA=1`);

  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must use a loopback host for real-infrastructure acceptance`);
  }
  return url;
}

async function removeAcceptanceRedisKeys(): Promise<void> {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${redisPrefix}*`,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } finally {
    await redis.quit();
  }
}

async function clearAcceptanceRedisKeys(): Promise<void> {
  await removeAcceptanceRedisKeys();
}

function createHarness() {
  const db = drizzle(databaseSql, { schema: authSchema });
  const repo = new TokenRepository();
  (repo as any).db = db;
  (repo as any).schema = authSchema;
  (repo as any).getRoleAndPermissions = async () => ({
    roleName: 'admin',
    permissions: [],
  });
  (repo as any).getUser = async (id: string) => ({
    id,
    email: `${id}@example.test`,
    status: 'active',
    role: 'admin',
    permissions: [],
  });

  const redis = new Redis(redisUrl, {
    keyPrefix: redisPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const cache = new CacheService({
    driver: 'redis',
    required: true,
    memory: {},
    redis: { url: redisUrl, client: redis },
  } as any);

  const invalidation = new SessionInvalidationService(cache, repo);
  (invalidation as any).config = authConfig;

  const jar = { refresh: undefined as string | undefined };
  const cookie = {
    getRefreshToken: () => jar.refresh,
    setRefreshToken: (value: string) => { jar.refresh = value; },
    clearRefreshToken: () => { jar.refresh = undefined; },
    clearSessionCookie: () => undefined,
  };

  const tokens = new TokenService(
    repo as any,
    cookie as any,
    cache as any,
    undefined,
    invalidation,
  );
  (tokens as any).config = authConfig;
  (tokens as any).t = (key: string) => key;

  const validator = new UserValidator();
  (validator as any).t = (key: string) => key;

  const userService = {
    update: async (userId: string, data: Record<string, unknown>) => {
      await db
        .update(authSchema.users)
        .set({ password: String(data.password) })
        .where(eq(authSchema.users.id, userId));
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

  return { auth, cache, db, invalidation, jar, repo, tokens };
}

async function insertUser(db: ReturnType<typeof drizzle>, id: string): Promise<void> {
  await db.insert(authSchema.users).values({
    id,
    email: `${id}@example.test`,
    password: 'old-password',
    status: 'active',
  });
}

const fulfilled = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((result) => result.status === 'fulfilled');

const authorizes = async (tokens: TokenService, accessToken: string) => {
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

realInfra('real PostgreSQL and Redis auth security acceptance', () => {
  beforeAll(async () => {
    const postgres = requireLoopbackUrl('NAJM_AUTH_REAL_POSTGRES_URL');
    const redis = requireLoopbackUrl('NAJM_AUTH_REAL_REDIS_URL');
    if (!['redis:', 'rediss:'].includes(redis.protocol)) {
      throw new Error('NAJM_AUTH_REAL_REDIS_URL must use redis:// or rediss://');
    }

    adminSql = new SQL(postgres.toString());
    databaseName = `najm_auth_accept_${process.pid}_${crypto.randomUUID().replaceAll('-', '')}`;
    if (!/^najm_auth_accept_[a-zA-Z0-9_]+$/.test(databaseName)) {
      throw new Error('generated acceptance database name is unsafe');
    }
    await adminSql.unsafe(`CREATE DATABASE "${databaseName}"`);

    const disposable = new URL(postgres);
    disposable.pathname = `/${databaseName}`;
    databaseSql = new SQL(disposable.toString());
    for (const statement of DDL) await databaseSql.unsafe(statement);

    redisUrl = redis.toString();
    redisPrefix = `najm-auth-accept:${crypto.randomUUID()}:`;
    const probe = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      expect(await probe.ping()).toBe('PONG');
    } finally {
      await probe.quit();
    }
  });

  afterAll(async () => {
    if (redisUrl && redisPrefix) await removeAcceptanceRedisKeys();
    if (databaseSql) await databaseSql.close();
    if (adminSql && databaseName) {
      await adminSql.unsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    if (adminSql) await adminSql.close();
  });

  test('Redis compare-and-delete has exactly one winner', async () => {
    const h = createHarness();
    try {
      await h.cache.verifyReady();
      await h.cache.set('one-time', 'expected', 60_000);
      const results = await Promise.all(
        Array.from({ length: 16 }, () => h.cache.compareAndDelete('one-time', 'expected')),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await h.cache.get('one-time')).toBeNull();

      await h.cache.set('superseded', 'new-value', 60_000);
      expect(await h.cache.compareAndDelete('superseded', 'old-value')).toBe(false);
      expect(await h.cache.get('superseded')).toBe('new-value');
    } finally {
      await h.cache.destroy();
    }
  });

  test('concurrent reset requests write exactly one winning password', async () => {
    const h = createHarness();
    const userId = `reset-user-${crypto.randomUUID()}`;
    try {
      await insertUser(h.db, userId);
      const { token } = await h.tokens.generateResetToken(userId);
      const attempts = Array.from({ length: 12 }, (_, index) =>
        `Concurrent${index}StrongPassw0rd`);
      const results = await Promise.allSettled(
        attempts.map((password) => h.auth.resetPassword(token, password)),
      );

      expect(fulfilled(results)).toHaveLength(1);
      const [user] = await h.db
        .select({ password: authSchema.users.password })
        .from(authSchema.users)
        .where(eq(authSchema.users.id, userId));
      expect(attempts).toContain(user?.password);
      await expect(h.tokens.verifyResetToken(token)).rejects.toThrow();
    } finally {
      await h.cache.destroy();
    }
  });

  test('logout wins over a refresh paused after PostgreSQL rotation', async () => {
    const h = createHarness();
    const userId = `race-user-${crypto.randomUUID()}`;
    try {
      await insertUser(h.db, userId);
      const session = await h.tokens.generateTokens(userId);
      h.jar.refresh = session.refreshToken;

      const committed = barrier();
      const resume = barrier();
      const rotate = h.repo.rotateRefreshToken.bind(h.repo);
      h.repo.rotateRefreshToken = async (...args: Parameters<typeof rotate>) => {
        const rows = await rotate(...args);
        committed.release();
        await resume.promise;
        return rows;
      };

      const refreshing = h.tokens.refreshTokens().then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      );
      try {
        await committed.promise;
        await h.tokens.logout(userId, `Bearer ${session.accessToken}`);
      } finally {
        resume.release();
      }

      const result = await refreshing;
      expect(result.value).toBeUndefined();
      expect(result.error).toMatchObject({ status: 401 });
      expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
      expect(await h.invalidation.familyStatus(session.tokenFamily, userId)).toBe('revoked');
      expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
    } finally {
      await h.cache.destroy();
    }
  });

  test('cache loss denies bearer access but database refresh recovers', async () => {
    const h = createHarness();
    const userId = `recovery-user-${crypto.randomUUID()}`;
    try {
      await insertUser(h.db, userId);
      const session = await h.tokens.generateTokens(userId);
      expect(await authorizes(h.tokens, session.accessToken)).toBe(true);

      await clearAcceptanceRedisKeys();
      expect(await authorizes(h.tokens, session.accessToken)).toBe(false);

      h.jar.refresh = session.refreshToken;
      const recovered = await h.tokens.refreshTokens();
      expect(await authorizes(h.tokens, recovered.accessToken)).toBe(true);
    } finally {
      await h.cache.destroy();
    }
  });

  test('durable PostgreSQL revocation survives later Redis keyspace loss', async () => {
    const h = createHarness();
    const userId = `durable-revoke-user-${crypto.randomUUID()}`;
    try {
      await insertUser(h.db, userId);
      const session = await h.tokens.generateTokens(userId);

      // Revocation no longer performs a physical delete. If a database policy
      // or transient condition makes DELETE unavailable, the status tombstone
      // still commits and remains authoritative after Redis is lost.
      (h.repo as any).db.delete = () => {
        throw new Error('physical delete unavailable');
      };
      await h.tokens.revokeFamily(session.tokenFamily);

      const [stored] = await h.db
        .select({ status: authSchema.tokens.status })
        .from(authSchema.tokens)
        .where(eq(authSchema.tokens.tokenFamily, session.tokenFamily));
      expect(stored?.status).toBe('revoked');

      await clearAcceptanceRedisKeys();
      await expect(h.tokens.generateTokens(userId, session.tokenFamily))
        .rejects.toMatchObject({ status: 401 });
      h.jar.refresh = session.refreshToken;
      await expect(h.tokens.refreshTokens()).rejects.toMatchObject({ status: 401 });
      expect(await h.repo.getByFamily(session.tokenFamily)).toBeNull();
      expect(await authorizes(h.tokens, session.accessToken)).toBe(false);
    } finally {
      await h.cache.destroy();
    }
  });
});
