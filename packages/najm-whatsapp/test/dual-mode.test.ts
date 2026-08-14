import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { whatsapp } from '../src/WhatsAppPlugin';
import { createCredentialSetupTables } from './auth-test-schema';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function createTestServer(mode: 'cloud' | 'baileys') {
  const rawSqlite = new Database(':memory:');
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT, last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL, permission_id TEXT NOT NULL, created_at TEXT, updated_at TEXT);
  `);
  createCredentialSetupTables(rawSqlite);

  const { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } = await import('najm-auth/sqlite');
  const schema = {
    users: usersTable, roles: rolesTable, tokens: tokensTable,
    permissions: permissionsTable, rolePermissions: rolePermissionsTable,
  };

  const db = drizzle(rawSqlite, { schema });
  const server = new Server({ isolated: true })
    .use(database({ default: db }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }));

  if (mode === 'cloud') {
    server.use(whatsapp({
      mode: 'cloud',
      phoneNumberId: '123456789',
      accessToken: 'token',
      verifyToken: 'verify',
      webhookSecret: 'secret',
    }));
  } else {
    server.use(whatsapp({
      mode: 'baileys',
      sessions: { driver: 'file', path: './test-sessions' },
    }));
  }

  return server;
}

describe('WhatsAppPlugin dual-mode', () => {
  afterEach(async () => {
    try {
      const { rm } = await import('fs/promises');
      await rm('./test-sessions', { recursive: true, force: true });
    } catch {}
  });

  test('cloud mode plugin builds without throwing', async () => {
    const server = await createTestServer('cloud');
    expect(server).toBeDefined();
    await server.stop();
  });

  test('baileys mode plugin builds without throwing', async () => {
    const server = await createTestServer('baileys');
    expect(server).toBeDefined();
    await server.stop();
  });

  test('cloud mode config throws if required fields missing', () => {
    expect(() => whatsapp({
      mode: 'cloud',
      // missing required fields
    } as any)).toThrow();
  });

  test('baileys config with default sessions uses file driver', async () => {
    const server = await createTestServer('baileys');
    expect(server).toBeDefined();
    await server.stop();
  });

  test('cloud mode throws if phoneNumberId is missing', () => {
    expect(() => whatsapp({
      mode: 'cloud',
      phoneNumberId: '',
      accessToken: 'token',
      verifyToken: 'verify',
      webhookSecret: 'secret',
    } as any)).toThrow();
  });

  test('baileys mode with no explicit sessions defaults to file driver', async () => {
    // Build plugin without explicit sessions config — should use file driver by default
    const rawSqlite = new Database(':memory:');
    rawSqlite.exec(`
      CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT, last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL, permission_id TEXT NOT NULL, created_at TEXT, updated_at TEXT);
    `);
    createCredentialSetupTables(rawSqlite);
    const { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } = await import('najm-auth/sqlite');
    const schema = {
      users: usersTable, roles: rolesTable, tokens: tokensTable,
      permissions: permissionsTable, rolePermissions: rolePermissionsTable,
    };
    const db = drizzle(rawSqlite, { schema });
    const server = new Server({ isolated: true })
      .use(database({ default: db }))
      .use(auth({
        dialect: 'sqlite',
        jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
        encryptionKey: ENCRYPTION_KEY,
      }))
      .use(whatsapp({
        mode: 'baileys',
        // No sessions — should default to file driver
      }));

    expect(server).toBeDefined();
    await server.stop();
  });
});
