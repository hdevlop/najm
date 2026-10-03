import 'reflect-metadata';
import { afterEach, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { CacheService } from 'najm-cache';
import { resolveAuthConfig } from '../../src/AuthPlugin';
import { AuthResolver } from '../../src/auth/AuthResolver';
import { CookieManager } from '../../src/auth/CookieManager';
import { EncryptionService } from '../../src/auth/EncryptionService';
import { PermissionRepository } from '../../src/permissions/PermissionRepository';
import { PermissionService } from '../../src/permissions/PermissionService';
import { PermissionValidator } from '../../src/permissions/PermissionValidator';
import { RoleRepository } from '../../src/roles/RoleRepository';
import { RoleService } from '../../src/roles/RoleService';
import { RoleValidator } from '../../src/roles/RoleValidator';
import { authSchema } from '../../src/schema/sqlite';
import { SessionInvalidationService } from '../../src/tokens/SessionInvalidationService';
import { TokenRepository } from '../../src/tokens/TokenRepository';
import { TokenService } from '../../src/tokens/TokenService';
import { UserRepository } from '../../src/users/UserRepository';
import { UserService } from '../../src/users/UserService';
import { UserValidator } from '../../src/users/UserValidator';

const DDL = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE roles (id text PRIMARY KEY, created_at text, updated_at text,
    name text NOT NULL UNIQUE, description text);
  CREATE TABLE permissions (id text PRIMARY KEY, created_at text, updated_at text,
    name text NOT NULL UNIQUE, description text, resource text NOT NULL, action text NOT NULL);
  CREATE TABLE users (id text PRIMARY KEY, created_at text, updated_at text, name text,
    email text NOT NULL UNIQUE, email_verified integer DEFAULT 0, phone text UNIQUE,
    phone_verified integer DEFAULT 0, password text NOT NULL, image text, status text DEFAULT 'active',
    role_id text REFERENCES roles(id), last_login text, failed_login_attempts integer DEFAULT 0,
    lockout_until text);
  CREATE TABLE role_permissions (id text PRIMARY KEY, created_at text, updated_at text,
    role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id));
  CREATE TABLE tokens (id text PRIMARY KEY, created_at text, updated_at text,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, token text NOT NULL,
    token_family text NOT NULL UNIQUE, previous_hash text, previous_valid_until text,
    previous_used_at text, type text DEFAULT 'refresh', status text DEFAULT 'active', expires_at text NOT NULL);
  CREATE TABLE credential_setup_sessions (id text PRIMARY KEY, created_at text, updated_at text,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL,
    token_hash text NOT NULL UNIQUE, expires_at text NOT NULL, consumed_at text, revoked_at text);
  CREATE TABLE credential_setup_requirements (user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL, temporary_credential_kind text, required integer NOT NULL DEFAULT 1,
    completed_at text, created_at text, updated_at text, PRIMARY KEY (user_id, purpose));
`;

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

export async function harness(options: { sharedSecret?: boolean; shortAccess?: boolean; databasePath?: string } = {}) {
  const sqlite = new Database(options.databasePath ?? ':memory:');
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema: authSchema });
  const config = resolveAuthConfig({
    jwt: {
      accessSecret: 'test-access-secret-at-least-32-bytes',
      refreshSecret: options.sharedSecret
        ? 'test-access-secret-at-least-32-bytes'
        : 'test-refresh-secret-at-least-32-bytes',
      accessExpiresIn: options.shortAccess ? '1s' : '1h',
      refreshExpiresIn: '7d',
    },
    bcryptRounds: 4,
    session: { maxAge: 300 },
  });
  const cache = new CacheService({ driver: 'memory', required: false, memory: {} });
  cleanup.push(async () => { await cache.destroy(); sqlite.close(); });
  function repository<T extends object>(instance: T): T {
    Object.assign(instance, { db, schema: authSchema });
    return instance;
  }
  function translated<T extends object>(instance: T): T {
    Object.assign(instance, { config, t: (key: string) => key });
    return instance;
  }
  const userRecords = repository(new UserRepository());
  const roleRecords = repository(new RoleRepository());
  const permissionRecords = repository(new PermissionRepository());
  const tokenRecords = repository(new TokenRepository());
  const invalidation = translated(new SessionInvalidationService(cache, tokenRecords));
  const roleValidator = translated(new RoleValidator(roleRecords));
  const roles = translated(new RoleService(roleRecords, roleValidator, userRecords, invalidation));
  const permissions = new PermissionService(permissionRecords,
    translated(new PermissionValidator(permissionRecords, roleValidator)), roles, userRecords, invalidation);
  const encryption = translated(new EncryptionService('0123456789abcdef0123456789abcdef'));
  const validator = translated(new UserValidator(userRecords, encryption));
  const users = translated(new UserService(roleValidator, roles, userRecords, validator,
    encryption, {} as never, config, invalidation));
  const jar = { refresh: undefined as string | undefined, snapshot: null as any };
  const cookies = {
    getRefreshToken: () => jar.refresh,
    setRefreshToken: (token: string) => { jar.refresh = token; },
    setSessionCookie: (snapshot: any) => { jar.snapshot = { ...snapshot, iat: Date.now() }; },
    clearRefreshToken: () => { jar.refresh = undefined; },
    clearSessionCookie: () => { jar.snapshot = null; },
    getSessionCookie: () => jar.snapshot,
  };
  const tokens = translated(new TokenService(tokenRecords, cookies as never, cache, undefined, invalidation));
  const resolver = new AuthResolver();
  Object.assign(resolver, {
    log: { debug() {}, warn() {} },
    container: { resolve: async (target: unknown) => target === CookieManager ? cookies : tokens },
  });
  await db.insert(authSchema.roles).values([
    { id: 'editor', name: 'editor' }, { id: 'reader', name: 'reader' },
  ]);
  await db.insert(authSchema.permissions).values([
    { id: 'write', name: 'orders:write', resource: 'orders', action: 'write' },
    { id: 'read', name: 'orders:read', resource: 'orders', action: 'read' },
  ]);
  await db.insert(authSchema.rolePermissions).values([
    { roleId: 'editor', permissionId: 'write' }, { roleId: 'reader', permissionId: 'read' },
  ]);
  await db.insert(authSchema.users).values([
    { id: 'one', email: 'One@Example.Test', password: 'unused', status: 'active', roleId: 'editor' },
    { id: 'two', email: 'two@example.test', password: 'unused', status: 'active', roleId: 'reader' },
  ]);
  async function signIn(userId = 'one') {
    const session = await tokens.generateTokens(userId);
    const user = await userRecords.getById(userId);
    jar.snapshot = { user, roles: session.roles, permissions: session.permissions,
      sessionVersion: session.sessionVersion, tokenFamily: session.tokenFamily, iat: Date.now() };
    return session;
  }
  async function expectInvalidated(session: Awaited<ReturnType<typeof signIn>>) {
    await expect(tokens.verifyAccessToken(session.accessToken)).rejects.toMatchObject({ status: 401 });
    expect(await resolver.resolveFromSessionCookie()).toBe(false);
    jar.refresh = session.refreshToken;
    const recovered = await tokens.recoverSessionFromCookie();
    expect(recovered.sessionVersion).toBeGreaterThan(session.sessionVersion);
    return recovered;
  }
  return { config, cache, db, roles, permissions, users, tokens, resolver, jar, signIn,
    expectInvalidated, userRecords, validator, tokenRecords, permissionRecords, invalidation, encryption, cookies, sqlite };
}


