import 'reflect-metadata';
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { CacheService } from 'najm-cache';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { whatsapp } from '../src/WhatsAppPlugin';
import {
  usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable,
} from 'najm-auth/sqlite';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const schema = {
  users: usersTable, roles: rolesTable, tokens: tokensTable,
  permissions: permissionsTable, rolePermissions: rolePermissionsTable,
};

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0, password TEXT NOT NULL,
    image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active',
    role_id TEXT REFERENCES roles(id), last_login TEXT,
    failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT,
    phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
}

let server: Server | undefined;
let rawSqlite: Database;
let port = 5500;
const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const str = String(url);
    if (str.includes('graph.facebook.com')) {
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.fake' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(url as any, init as any);
  }) as typeof fetch;
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  await server?.stop();
  server = undefined;
});

async function setup() {
  const p = ++port;
  rawSqlite = new Database(':memory:');
  createSchema(rawSqlite);
  const db = drizzle(rawSqlite, { schema });

  server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(whatsapp({
      phoneNumberId: '1234567890',
      accessToken: 'test-token',
      verifyToken: 'vt',
      webhookSecret: 'ws',
    }));

  await server.listen(p);
  return { port: p };
}

async function registerAndLogin(p: number, email: string) {
  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', name: 'U' }),
  });
  const loginRes = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  return (await loginRes.json()).data.accessToken as string;
}

describe('PhoneLinkController', () => {
  test('POST /auth/link-phone requires auth → 401', async () => {
    const { port: p } = await setup();
    const res = await fetch(`http://localhost:${p}/auth/link-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+15551234567' }),
    });
    expect(res.status).toBe(401);
  });

  test('rejects invalid phone format', async () => {
    const { port: p } = await setup();
    const token = await registerAndLogin(p, 'u1@test.com');
    const res = await fetch(`http://localhost:${p}/auth/link-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: 'not-a-phone' }),
    });
    expect(res.status).toBe(400);
  });

  test('link + verify end-to-end updates user.phone and phoneVerified', async () => {
    const { port: p } = await setup();
    const token = await registerAndLogin(p, 'u2@test.com');

    const linkRes = await fetch(`http://localhost:${p}/auth/link-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: '+15551234567' }),
    });
    expect(linkRes.ok).toBe(true);

    const cache = (server as any).container.get(CacheService) as CacheService;
    const otp = (await cache.get('wa:otp:+15551234567')) as string;
    expect(otp).toMatch(/^\d{6}$/);

    const verifyRes = await fetch(`http://localhost:${p}/auth/verify-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: '+15551234567', otp }),
    });
    expect(verifyRes.ok).toBe(true);

    const row = rawSqlite.query(`SELECT phone, phone_verified FROM users WHERE email = ?`).get('u2@test.com') as any;
    expect(row.phone).toBe('+15551234567');
    expect(row.phone_verified).toBe(1);

    // OTP should be consumed (single-use)
    expect(await cache.get('wa:otp:+15551234567')).toBeNull();
  });

  test('wrong OTP → 400 and phone not updated', async () => {
    const { port: p } = await setup();
    const token = await registerAndLogin(p, 'u3@test.com');

    await fetch(`http://localhost:${p}/auth/link-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: '+15559876543' }),
    });

    const res = await fetch(`http://localhost:${p}/auth/verify-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: '+15559876543', otp: '000000' }),
    });
    expect(res.status).toBe(400);

    const row = rawSqlite.query(`SELECT phone_verified FROM users WHERE email = ?`).get('u3@test.com') as any;
    expect(row.phone_verified).toBe(0);
  });
});
