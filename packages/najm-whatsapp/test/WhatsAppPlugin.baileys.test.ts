import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { events } from 'najm-event';
import { whatsapp } from '../src/WhatsAppPlugin';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import {
  usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable,
} from 'najm-auth/sqlite';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const authSchema = {
  users: usersTable, roles: rolesTable, tokens: tokensTable,
  permissions: permissionsTable, rolePermissions: rolePermissionsTable,
};

function createTables(sqlite: Database) {
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
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);

  // WhatsApp tables (minimal — only what the schema references)
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_instances (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'disconnected', phone TEXT, profile_name TEXT, connected_at TEXT, last_seen_at TEXT, auto_connect INTEGER NOT NULL DEFAULT 0, last_error TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_messages (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, direction TEXT NOT NULL, jid TEXT NOT NULL, from_me INTEGER NOT NULL, type TEXT NOT NULL, content TEXT, wa_message_id TEXT, quoted_id TEXT, status TEXT, metadata TEXT, timestamp TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_contacts (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, phone TEXT, name TEXT, push_name TEXT, profile_picture_url TEXT, is_business INTEGER, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_groups (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT NOT NULL, description TEXT, participant_count INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0, picture_url TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_chats (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT, is_group INTEGER NOT NULL, unread_count INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_muted INTEGER DEFAULT 0, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_labels (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, predefined INTEGER DEFAULT 0)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (id TEXT PRIMARY KEY, instance_id TEXT, event_type TEXT NOT NULL, payload TEXT, forward_status TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_studio_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, instance_id TEXT, user_id TEXT, details TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL UNIQUE, creds TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_session_keys (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, key_type TEXT NOT NULL, key_id TEXT NOT NULL, value TEXT NOT NULL)`);
}

let server: Server | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('WhatsAppPlugin Baileys mode wiring', () => {
  test('registers all Baileys services without throwing', async () => {
    const rawSqlite = new Database(':memory:');
    createTables(rawSqlite);
    const db = drizzle(rawSqlite, { schema: authSchema });

    server = new Server({ isolated: true })
      .use(events())
      .use(database({ default: db }))
      .use(auth({
        dialect: 'sqlite',
        jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
        encryptionKey: ENCRYPTION_KEY,
      }))
      .use(whatsapp({
        mode: 'baileys',
        dialect: 'sqlite',
        sessions: { driver: 'file', path: './test-sessions-wiring' },
      }));

    expect(server).toBeDefined();
  });

  test('Cloud mode still works alongside Baileys', async () => {
    const rawSqlite = new Database(':memory:');
    createTables(rawSqlite);
    const db = drizzle(rawSqlite, { schema: authSchema });

    const cloudPlugin = whatsapp({
      phoneNumberId: '1234567890',
      accessToken: 'test-token',
      verifyToken: 'vt',
      webhookSecret: 'ws',
    });

    expect(cloudPlugin).toBeDefined();

    server = new Server({ isolated: true })
      .use(events())
      .use(database({ default: db }))
      .use(auth({
        dialect: 'sqlite',
        jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
        encryptionKey: ENCRYPTION_KEY,
      }))
      .use(cloudPlugin);

    expect(server).toBeDefined();
  });
});
