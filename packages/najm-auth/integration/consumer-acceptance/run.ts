import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unlinkSync } from 'node:fs';

// Exercise installed packages with each application's actual auth factory and
// PostgreSQL driver, without loading an app env file or touching its database.
const app = process.argv[2];
assert(app === 'kafil' || app === 'school', 'Expected kafil or school');
const repo = resolve(process.argv[3] ?? resolve(import.meta.dir, '../../../../..', app));
if (!process.argv[3]) {
  // Bare imports must resolve in the consumer's module graph. Importing real
  // paths from an isolated Bun install can duplicate decorated class identities.
  const target = resolve(repo, 'packages/server', app === 'kafil' ? 'test' : 'tests',
    `.najm-auth-acceptance-${crypto.randomUUID()}.ts`);
  let code: number;
  try {
    await Bun.write(target, await Bun.file(import.meta.path).text());
    const child = Bun.spawn([process.execPath, target, app, repo], {
      cwd: repo, stdout: 'inherit', stderr: 'inherit',
    });
    code = await child.exited;
  } finally { unlinkSync(target); }
  process.exit(code);
}
const dependency = (name: string) => import(name);
const infrastructureLoad = createRequire(resolve(repo, '../najm/packages/najm-auth/package.json'));
const { default: postgres } = await import(pathToFileURL(infrastructureLoad.resolve('postgres')).href);
const adminUrl = new URL(process.env.NAJM_AUTH_REAL_POSTGRES_URL
  ?? 'postgresql://postgres@127.0.0.1:55432/postgres');
const redisUrl = new URL(process.env.NAJM_AUTH_REAL_REDIS_URL ?? 'redis://127.0.0.1:56379');
for (const url of [adminUrl, redisUrl]) {
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Acceptance requires loopback infrastructure');
}
const admin = postgres(adminUrl.toString(), { onnotice() {} });
const databaseName = `najm_auth_${app}_accept_${crypto.randomUUID().replaceAll('-', '')}`;
assert(/^najm_auth_(kafil|school)_accept_[a-f0-9]+$/.test(databaseName));
const disposableUrl = new URL(adminUrl);
disposableUrl.pathname = `/${databaseName}`;
const databaseUrl = disposableUrl.toString();
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: databaseUrl, DB_URL: databaseUrl,
  JWT_ACCESS_SECRET: 'acceptance-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'acceptance-refresh-secret-at-least-32-characters',
  NAJM_ENCRYPTION_KEY: '11'.repeat(32), EMAIL_PROVIDER: 'memory',
  REDIS_URL: redisUrl.toString(), FRONTEND_URL: 'http://acceptance.local',
  SCHOOL_TRUSTED_PROXY_HOPS: '1', KAFIL_TRUSTED_PROXY_HOPS: '1',
});

let server: any;
let client: any;
let closeAppPool: (() => Promise<unknown>) | undefined;
try {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  const auth = await dependency('najm-auth');
  const { authSchema } = await dependency('najm-auth/pg');
  const { Server } = await dependency('najm-core');
  const { database } = await dependency('najm-database');
  let db: any;
  let execute: (statement: string) => Promise<unknown>;
  if (app === 'kafil') {
    const { Pool } = await dependency('pg');
    const { drizzle } = await dependency('drizzle-orm/node-postgres');
    client = new Pool({ connectionString: databaseUrl });
    db = drizzle(client, { schema: authSchema });
    execute = statement => client.query(statement);
  } else {
    const { default: postgresDriver } = await dependency('postgres');
    const { drizzle } = await dependency('drizzle-orm/postgres-js');
    client = postgresDriver(databaseUrl, { onnotice() {} });
    db = drizzle(client, { schema: authSchema });
    execute = statement => client.unsafe(statement);
  }
  await execute(`
    CREATE TYPE "userStatus" AS ENUM ('active', 'inactive', 'pending');
    CREATE TYPE "tokenStatus" AS ENUM ('active', 'revoked', 'expired');
    CREATE TYPE "tokenType" AS ENUM ('access', 'refresh');
    CREATE TABLE roles (id text PRIMARY KEY, name text NOT NULL UNIQUE, description text,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE permissions (id text PRIMARY KEY, name text NOT NULL UNIQUE, description text,
      resource text NOT NULL, action text NOT NULL, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id text PRIMARY KEY, name text, email text NOT NULL UNIQUE,
      email_verified boolean DEFAULT false, password text NOT NULL, status "userStatus" DEFAULT 'pending',
      phone text UNIQUE, phone_verified boolean DEFAULT false, image text DEFAULT 'noavatar.png',
      role_id text REFERENCES roles(id), last_login timestamp, failed_login_attempts integer DEFAULT 0,
      lockout_until timestamp, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE role_permissions (role_id text REFERENCES roles(id) ON DELETE CASCADE,
      permission_id text REFERENCES permissions(id) ON DELETE CASCADE, created_at timestamp DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, permission_id));
    CREATE TABLE tokens (id text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE,
      token text NOT NULL, token_family text NOT NULL UNIQUE, previous_hash text, previous_valid_until timestamp,
      previous_used_at timestamp, type "tokenType" DEFAULT 'refresh', status "tokenStatus" DEFAULT 'active',
      expires_at timestamp NOT NULL, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE credential_setup_sessions (id text PRIMARY KEY, user_id text REFERENCES users(id) ON DELETE CASCADE,
      purpose text NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamp NOT NULL, consumed_at timestamp,
      revoked_at timestamp, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE credential_setup_requirements (user_id text REFERENCES users(id) ON DELETE CASCADE,
      purpose text NOT NULL, temporary_credential_kind text, required boolean NOT NULL DEFAULT true,
      completed_at timestamp, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, purpose));
  `);
  const factoryPath = app === 'kafil' ? 'config/authConfig.ts' : 'config/index.ts';
  const { authConfig } = await import(pathToFileURL(resolve(repo, 'packages/server/src', factoryPath)).href);
  const appDatabase = await import(pathToFileURL(resolve(repo, app === 'kafil'
    ? 'packages/server/src/config/databaseConfig.ts' : 'packages/server/src/database/db.ts')).href);
  closeAppPool = app === 'kafil' ? () => appDatabase.pool.end() : () => appDatabase.db.$client.end({ timeout: 5 });
  server = new Server({ isolated: true, silent: true }).base('/api').use(database(db)).use(authConfig());
  await server.init();
  const users = await server.container.resolve(auth.UserRepository);
  const encryption = await server.container.resolve(auth.EncryptionService);
  const tokens = await server.container.resolve(auth.TokenService);
  const requirements = await server.container.resolve(auth.CredentialSetupRequirementService);
  await db.insert(authSchema.roles).values({ id: 'admin', name: 'admin' });
  async function account(id: string, password: string, pending = false) {
    return users.create({ id, email: `${id}@example.invalid`, name: 'Acceptance Account',
      password: await encryption.hashPassword(password), status: pending ? 'pending' : 'active',
      emailVerified: !pending, roleId: 'admin' });
  }
  type Jar = Map<string, string>;
  async function post(path: string, body: unknown, jar: Jar = new Map()) {
    const response = await server.fetch(new Request(`http://acceptance.local/api${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json',
        'x-forwarded-for': clientIp, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: JSON.stringify(body),
    }));
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const index = pair.indexOf('=');
      if (/max-age=0\b/i.test(header) || !pair.slice(index + 1)) jar.delete(pair.slice(0, index));
      else jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const result = await response.json();
    return { status: response.status, data: result.data ?? result };
  }
  const clientIp = `198.18.${crypto.getRandomValues(new Uint8Array(1))[0]}.${crypto.getRandomValues(new Uint8Array(1))[0]}`;
  const suffix = crypto.randomUUID();
  const active = await account(`active-${suffix}`, 'OldPassword123');
  const jar: Jar = new Map();
  const login = await post('/auth/login', { email: active.email, password: 'OldPassword123' }, jar);
  assert.equal(login.status, 200, 'Login succeeds');
  assert(jar.has('refreshToken'), 'Login issues a refresh cookie');
  assert.equal((await post('/auth/refresh', {}, jar)).status, 200, 'Refresh succeeds');
  const link = await tokens.generateResetToken(active.id, active.email);
  assert.equal((await post('/auth/reset-password', { token: link.token, newPassword: 'ResetPassword456' })).status, 200);
  assert.notEqual((await post('/auth/reset-password', { token: link.token, newPassword: 'ResetPassword456' })).status, 200);
  assert.notEqual((await post('/auth/login', { email: active.email, password: 'OldPassword123' })).status, 200);
  assert.equal((await post('/auth/login', { email: active.email, password: 'ResetPassword456' })).status, 200);
  await assert.rejects(tokens.verifyAccessToken(login.data.accessToken), 'Reset revokes the old bearer');
  console.log(`${app}: login, refresh, reset, replay denial, and prior-session revocation PASS`);

  const invited = await account(`invite-${suffix}`, 'TemporaryPass123', true);
  const invitation = await tokens.generateInviteToken(invited.id, invited.email);
  assert.equal((await post('/auth/reset-password', { token: invitation.token, newPassword: 'InvitedPassword456' })).status, 200);
  assert.equal((await users.getRawById(invited.id)).status, 'active');
  assert.equal((await users.getRawById(invited.id)).emailVerified, true);
  assert.equal((await post('/auth/login', { email: invited.email, password: 'InvitedPassword456' })).status, 200);
  console.log(`${app}: invitation activation and replacement-password login PASS`);

  const setup = await account(`setup-${suffix}`, 'TemporaryPass123');
  await requirements.markRequired(setup.id, 'password');
  const setupJar: Jar = new Map();
  const pending = await post('/auth/login', { email: setup.email, password: 'TemporaryPass123' }, setupJar);
  assert.equal(pending.status, 200);
  assert.equal(pending.data.nextStep, 'credential_setup');
  assert(!setupJar.has('refreshToken'), 'Setup login cannot issue a normal session');
  const copiedJar = new Map(setupJar);
  assert.equal((await post('/auth/credential-setup/change', { newPassword: 'PermanentPassword789' }, setupJar)).status, 200);
  assert.notEqual((await post('/auth/credential-setup/change', { newPassword: 'ReplayPassword789' }, copiedJar)).status, 200);
  assert.equal(await requirements.isRequired(setup.id, 'password'), false);
  assert.equal((await post('/auth/login', { email: setup.email, password: 'PermanentPassword789' })).status, 200);
  console.log(`${app}: first-login setup, replay denial, and permanent-password login PASS`);
  // Prove the fixture's caller-owned pool remains usable after server shutdown.
  await server.stop();
  await execute('SELECT 1');
  console.log(`${app}: caller-owned PostgreSQL pool survives server.stop() PASS`);
} finally {
  if (server) await server.stop();
  if (closeAppPool) await closeAppPool();
  if (client) await client.end();
  await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end({ timeout: 5 });
}
