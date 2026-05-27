import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { events } from 'najm-event';
import { validation } from 'najm-validation';
import { whatsapp } from '../../src/WhatsAppPlugin';
import { InstanceController } from '../../src/studio/InstanceController';
import { StudioAuditService } from '../../src/studio/StudioAuditService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import {
  usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable,
} from 'najm-auth/sqlite';
import { registerAdmin, authHeaders } from '../helpers/admin';

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
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_instances (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'disconnected', phone TEXT, profile_name TEXT, connected_at TEXT, last_seen_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_messages (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, direction TEXT NOT NULL, jid TEXT NOT NULL, from_me INTEGER NOT NULL, type TEXT NOT NULL, content TEXT, wa_message_id TEXT, quoted_id TEXT, status TEXT, metadata TEXT, timestamp TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_contacts (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, phone TEXT, name TEXT, push_name TEXT, profile_picture_url TEXT, is_business INTEGER, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_groups (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT NOT NULL, description TEXT, participant_count INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0, picture_url TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_chats (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT, is_group INTEGER NOT NULL, unread_count INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_muted INTEGER DEFAULT 0, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_labels (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, predefined INTEGER DEFAULT 0)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_webhooks (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT, url TEXT NOT NULL, events TEXT, headers TEXT, enabled INTEGER NOT NULL DEFAULT 1)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (id TEXT PRIMARY KEY, instance_id TEXT, event_type TEXT NOT NULL, payload TEXT, forward_status TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_studio_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, instance_id TEXT, user_id TEXT, details TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL UNIQUE, creds TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_session_keys (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, key_type TEXT NOT NULL, key_id TEXT NOT NULL, value TEXT NOT NULL)`);
}

let server: Server | undefined;
let port = 5800;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function setup() {
  const p = ++port;
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
    .use(validation())
    .use(whatsapp({
      mode: 'baileys',
      dialect: 'sqlite',
      sessions: { driver: 'file', path: `./test-sessions-instance-${p}` },
    }))
    .load(InstanceController, StudioAuditService);

  await server.listen(p);
  const token = await registerAdmin(p, rawSqlite);
  return { port: p, headers: authHeaders(token), rawSqlite };
}

describe('InstanceController', () => {
  test('GET /wa-studio/instances returns empty list', async () => {
    const { port: p, headers } = await setup();
    const res = await fetch(`http://localhost:${p}/wa-studio/instances`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test('POST /wa-studio/instances creates an instance', async () => {
    const { port: p, headers } = await setup();
    const res = await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ name: 'Test Instance' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Test Instance');
    expect(body.status).toBe('disconnected');
    expect(body.id).toBeTruthy();
  });

  test('POST /wa-studio/instances with custom id', async () => {
    const { port: p, headers } = await setup();
    const res = await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'custom-id-123', name: 'Custom' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('custom-id-123');
    expect(body.name).toBe('Custom');
  });

  test('GET /wa-studio/instances/:id/qr returns null for disconnected instance', async () => {
    const { port: p, headers } = await setup();

    await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'qr-test', name: 'QR Test' }),
    });

    const res = await fetch(`http://localhost:${p}/wa-studio/instances/qr-test/qr`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qr).toBeNull();
  });

  test('DELETE /wa-studio/instances/:id deletes the instance', async () => {
    const { port: p, headers } = await setup();

    await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'del-test', name: 'Delete Me' }),
    });

    const delRes = await fetch(`http://localhost:${p}/wa-studio/instances/del-test`, {
      method: 'DELETE',
      headers,
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    const listRes = await fetch(`http://localhost:${p}/wa-studio/instances`, { headers });
    const listBody = await listRes.json();
    const ids = listBody.map((i: any) => i.id);
    expect(ids).not.toContain('del-test');
  });

  test('POST /wa-studio/instances/:id/connect starts the connection flow', async () => {
    const { port: p, headers } = await setup();

    await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'conn-test', name: 'Connect Test' }),
    });

    const res = await fetch(`http://localhost:${p}/wa-studio/instances/conn-test/connect`, {
      method: 'POST',
      headers,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /wa-studio/instances/:id/disconnect returns success', async () => {
    const { port: p, headers } = await setup();

    await fetch(`http://localhost:${p}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'disc-test', name: 'Disconnect Test' }),
    });

    const res = await fetch(`http://localhost:${p}/wa-studio/instances/disc-test/disconnect`, {
      method: 'POST',
      headers,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /wa-studio/instances/:id/qr returns null for unknown instance', async () => {
    const { port: p, headers } = await setup();
    const res = await fetch(`http://localhost:${p}/wa-studio/instances/nonexistent/qr`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qr).toBeNull();
  });
});
