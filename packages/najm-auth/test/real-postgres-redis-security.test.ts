import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import Redis from 'ioredis';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CacheService } from 'najm-cache';
import { TransactionService } from 'najm-database';

import { resolveAuthConfig } from '../src/AuthPlugin';
import { AuthService } from '../src/auth/AuthService';
import { EncryptionService } from '../src/auth/EncryptionService';
import { PermissionRepository } from '../src/permissions/PermissionRepository';
import { PermissionService } from '../src/permissions/PermissionService';
import { PermissionValidator } from '../src/permissions/PermissionValidator';
import { RoleRepository } from '../src/roles/RoleRepository';
import { RoleService } from '../src/roles/RoleService';
import { RoleValidator } from '../src/roles/RoleValidator';
import { authSchema } from '../src/schema/pg';
import { SessionInvalidationService } from '../src/tokens/SessionInvalidationService';
import { TokenRepository } from '../src/tokens/TokenRepository';
import { TokenService } from '../src/tokens/TokenService';
import { UserValidator } from '../src/users/UserValidator';
import { UserRepository } from '../src/users/UserRepository';
import { UserService } from '../src/users/UserService';

/**
 * Opt-in acceptance of Redis Lua consumption, PostgreSQL catalog locks,
 * transaction completion, and competing credential/session mutations.
 *
 * The suite creates and drops its own PostgreSQL database and uses a unique
 * Redis key prefix. Remote endpoints are refused even when the opt-in flag is
 * set so this test cannot be pointed at production by accident.
 */

const enabled = process.env.NAJM_AUTH_REAL_INFRA === '1';
const realInfra = enabled ? describe : describe.skip;

const authConfig = resolveAuthConfig({
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
});

const DDL = [
  `CREATE TYPE "userStatus" AS ENUM ('active', 'inactive', 'pending')`,
  `CREATE TYPE "tokenStatus" AS ENUM ('active', 'revoked', 'expired')`,
  `CREATE TYPE "tokenType" AS ENUM ('access', 'refresh')`,
  `CREATE TABLE roles (id text PRIMARY KEY, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP, name text NOT NULL UNIQUE, description text)`,
  `CREATE TABLE permissions (id text PRIMARY KEY, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP, name text NOT NULL UNIQUE, description text,
    resource text NOT NULL, action text NOT NULL)`,
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
    role_id text REFERENCES roles(id),
    last_login timestamp,
    failed_login_attempts integer DEFAULT 0,
    lockout_until timestamp
  )`,
  `CREATE TABLE role_permissions (role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (role_id, permission_id))`,
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

let adminSql: postgres.Sql;
let databaseSql: postgres.Sql;
let databaseName: string;
let databaseUrl: string;
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

function postgresClient(url: string) {
  return postgres(url, { max: 20, onnotice: () => {} });
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
  const scope = new AsyncLocalStorage<Record<string, any>>();
  const transactions = new TransactionService();
  Object.assign(transactions, {
    container: {
      get: (token: { key: string }) => scope.getStore()?.[token.key],
      set: (token: { key: string }, value: unknown) => { scope.getStore()![token.key] = value; },
      run: (values: Record<string, any>, callback: () => unknown) =>
        scope.run({ ...scope.getStore(), ...values }, callback),
    },
    databaseService: { get: () => db },
    log: { transactionFailed() {}, transactionRetry() {} },
  });
  function repository<T extends object>(instance: T): T {
    Object.assign(instance, { schema: authSchema });
    Object.defineProperty(instance, 'db', { configurable: true,
      get: () => transactions.getActive() ?? db });
    return instance;
  }
  function translated<T extends object>(instance: T): T {
    return Object.assign(instance, { config: authConfig, t: (key: string) => key });
  }
  const repo = repository(new TokenRepository());

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

  const invalidation = new SessionInvalidationService(cache, repo, transactions);
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

  const userRecords = repository(new UserRepository());
  const roleRecords = repository(new RoleRepository());
  const permissionRecords = repository(new PermissionRepository());
  const roleValidator = translated(new RoleValidator(roleRecords));
  const roles = translated(new RoleService(roleRecords, roleValidator, userRecords, invalidation));
  const permissions = new PermissionService(permissionRecords,
    translated(new PermissionValidator(permissionRecords, roleValidator)), roles, userRecords, invalidation);
  const encryption = translated(new EncryptionService('0123456789abcdef0123456789abcdef'));
  const validator = translated(new UserValidator(userRecords, encryption));
  const users = translated(new UserService(roleValidator, roles, userRecords, validator,
    encryption, {} as never, authConfig, invalidation));
  const auth = new AuthService(
    tokens,
    users,
    validator as any,
    encryption,
    cookie as any,
    {} as any,
    {} as any,
  );
  (auth as any).config = authConfig;
  (auth as any).t = (key: string) => key;

  return { auth, cache, db, invalidation, jar, repo, tokens, users, userRecords,
    permissionRecords, permissions, transactions, encryption };
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

async function waitForDatabaseLock(applicationName: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const rows = await databaseSql`
      SELECT pid FROM pg_stat_activity
      WHERE application_name = ${applicationName} AND wait_event_type = 'Lock'`;
    if (rows.length > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('PostgreSQL did not report the expected catalog lock wait');
}

async function insertCatalog(h: ReturnType<typeof createHarness>) {
  const suffix = crypto.randomUUID();
  const roleId = `role-${suffix}`;
  const permissionId = `permission-${suffix}`;
  const userId = `catalog-user-${suffix}`;
  await h.db.insert(authSchema.roles).values({ id: roleId, name: roleId });
  await h.db.insert(authSchema.permissions).values({ id: permissionId,
    name: `orders:write:${suffix}`, resource: 'orders', action: 'write' });
  await h.db.insert(authSchema.rolePermissions).values({ roleId, permissionId });
  await insertUser(h.db, userId);
  await h.db.update(authSchema.users).set({ roleId }).where(eq(authSchema.users.id, userId));
  return { roleId, permissionId, userId };
}

realInfra('real PostgreSQL and Redis auth security acceptance', () => {
  beforeAll(async () => {
    const postgres = requireLoopbackUrl('NAJM_AUTH_REAL_POSTGRES_URL');
    const redis = requireLoopbackUrl('NAJM_AUTH_REAL_REDIS_URL');
    if (!['redis:', 'rediss:'].includes(redis.protocol)) {
      throw new Error('NAJM_AUTH_REAL_REDIS_URL must use redis:// or rediss://');
    }

    adminSql = postgresClient(postgres.toString());
    databaseName = `najm_auth_accept_${process.pid}_${crypto.randomUUID().replaceAll('-', '')}`;
    if (!/^najm_auth_accept_[a-zA-Z0-9_]+$/.test(databaseName)) {
      throw new Error('generated acceptance database name is unsafe');
    }
    await adminSql.unsafe(`CREATE DATABASE "${databaseName}"`);

    const disposable = new URL(postgres);
    disposable.pathname = `/${databaseName}`;
    databaseUrl = disposable.toString();
    databaseSql = postgresClient(databaseUrl);
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
    if (databaseSql) await databaseSql.end({ timeout: 5 });
    if (adminSql && databaseName) {
      await adminSql.unsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    if (adminSql) await adminSql.end({ timeout: 5 });
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
      const winningIndex = results.findIndex(result => result.status === 'fulfilled');
      expect(await h.encryption.comparePassword(attempts[winningIndex], user!.password)).toBe(true);
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

  for (const mutation of ['delete', 'deleteAll'] as const) {
    test(`PostgreSQL ${mutation} waits for a concurrent grant and captures its role`, async () => {
      const h = createHarness();
      const catalog = await insertCatalog(h);
      const lateRole = `late-role-${crypto.randomUUID()}`;
      await h.db.insert(authSchema.roles).values({ id: lateRole, name: lateRole });
      const label = `najm-catalog-${crypto.randomUUID()}`;
      const mutationSql = postgres(databaseUrl, { max: 1, connection: { application_name: label }, onnotice() {} });
      const mutations = new PermissionRepository();
      Object.assign(mutations, { db: drizzle(mutationSql, { schema: authSchema }), schema: authSchema });
      const granted = barrier();
      const commit = barrier();
      const granting = h.db.transaction(async tx => {
        // deleteAll's table lock must also wait for an uncommitted new catalog row.
        const permissionId = mutation === 'deleteAll' ? `late-permission-${crypto.randomUUID()}` : catalog.permissionId;
        if (mutation === 'deleteAll') await tx.insert(authSchema.permissions).values({
          id: permissionId, name: permissionId, resource: 'orders', action: 'read' });
        await tx.insert(authSchema.rolePermissions).values({ roleId: lateRole, permissionId });
        granted.release();
        await commit.promise;
      });
      try {
        await granted.promise;
        const deleting = mutation === 'delete'
          ? mutations.deleteWithRoles(catalog.permissionId) : mutations.deleteAllWithRoles();
        // Observe the real lock wait, rather than assuming Promise scheduling order.
        try { await waitForDatabaseLock(label); }
        finally { commit.release(); }
        await granting;
        const deleted = await deleting;
        expect(deleted.roleIds).toContain(lateRole);
        expect(await h.permissionRecords.getRolesByPermission(catalog.permissionId)).toEqual([]);
      } finally {
        commit.release();
        await granting;
        await mutationSql.end({ timeout: 5 });
        await h.cache.destroy();
      }
    });
  }

  test('outer PostgreSQL commit invalidates credentials recovered from old committed claims', async () => {
    const h = createHarness();
    try {
      const catalog = await insertCatalog(h);
      const old = await h.tokens.generateTokens(catalog.userId);
      h.jar.refresh = old.refreshToken;
      const readerRepo = new TokenRepository();
      Object.assign(readerRepo, { db: h.db, schema: authSchema });
      const reader = new TokenService(readerRepo, { getRefreshToken: () => h.jar.refresh } as any,
        h.cache, undefined, h.invalidation);
      Object.assign(reader, { config: authConfig, t: (key: string) => key });
      let captured!: Awaited<ReturnType<typeof reader.recoverSessionFromCookie>>;
      await h.transactions.run(async () => {
        await h.permissions.removePermissionFromRole(catalog.roleId, catalog.permissionId);
        captured = await reader.recoverSessionFromCookie();
        expect(captured.permissions).toEqual(old.permissions);
        expect(captured.sessionVersion).toBeGreaterThan(old.sessionVersion);
      });
      expect(await h.invalidation.getSessionVersion(catalog.userId)).toBeGreaterThan(captured.sessionVersion);
      expect((await reader.recoverSessionFromCookie()).permissions).toEqual([]);
      expect(await authorizes(h.tokens, old.accessToken)).toBe(false);
    } finally { await h.cache.destroy(); }
  });

  test('outer PostgreSQL rollback invalidates a recovered uncommitted grant', async () => {
    const h = createHarness();
    try {
      const catalog = await insertCatalog(h);
      h.jar.refresh = (await h.tokens.generateTokens(catalog.userId)).refreshToken;
      const extra = `extra-${crypto.randomUUID()}`;
      await h.db.insert(authSchema.permissions).values({ id: extra, name: extra, resource: 'orders', action: 'read' });
      let captured!: Awaited<ReturnType<typeof h.tokens.recoverSessionFromCookie>>;
      const failure = new Error('rollback live grant');
      await expect(h.transactions.run(async () => {
        await h.permissions.assignPermissionToRole(catalog.roleId, extra);
        captured = await h.tokens.recoverSessionFromCookie();
        expect(captured.permissions).toContain(extra);
        throw failure;
      })).rejects.toBe(failure);
      expect(await h.invalidation.getSessionVersion(catalog.userId)).toBeGreaterThan(captured.sessionVersion);
      expect((await h.tokens.recoverSessionFromCookie()).permissions).not.toContain(extra);
    } finally { await h.cache.destroy(); }
  });

  test('a delayed reset cannot overwrite a later PostgreSQL credential replacement', async () => {
    const h = createHarness();
    const hashed = barrier();
    const resume = barrier();
    try {
      const userId = `credential-user-${crypto.randomUUID()}`;
      await insertUser(h.db, userId);
      const { token } = await h.tokens.generateResetToken(userId);
      const hash = h.encryption.hashPassword.bind(h.encryption);
      h.encryption.hashPassword = async password => {
        const result = await hash(password);
        if (password === 'DelayedPassword456') { hashed.release(); await resume.promise; }
        return result;
      };
      const resetting = h.auth.resetPassword(token, 'DelayedPassword456').then(
        value => ({ value, error: undefined }), error => ({ value: undefined, error }));
      await hashed.promise;
      try { await h.users.update(userId, { password: 'AuthoritativePassword789' }); }
      finally { resume.release(); }
      expect((await resetting).error).toMatchObject({ status: 409 });
      const user = await h.userRecords.getRawById(userId);
      expect(await h.encryption.comparePassword('AuthoritativePassword789', user!.password)).toBe(true);
    } finally { resume.release(); await h.cache.destroy(); }
  });

  test('a real PostgreSQL email replacement ends an unused Redis reset proof', async () => {
    const h = createHarness();
    try {
      const userId = `email-binding-user-${crypto.randomUUID()}`;
      await insertUser(h.db, userId);
      const { token } = await h.tokens.generateResetToken(userId);
      await h.users.update(userId, { email: `new-${crypto.randomUUID()}@example.test` });
      await expect(h.auth.resetPassword(token, 'DelayedPassword456')).rejects.toThrow('errors.invalidResetToken');
      await expect(h.tokens.generateResetToken(userId, `${userId}@example.test`)).rejects.toMatchObject({ status: 401 });
      expect((await h.userRecords.getRawById(userId))!.password).toBe('old-password');
    } finally { await h.cache.destroy(); }
  });
});
