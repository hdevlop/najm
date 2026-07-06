import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Server } from 'najm-core';
import { auth } from 'najm-auth';
import {
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  tokensTable,
  usersTable,
} from 'najm-auth/sqlite';
import { database } from 'najm-database';
import { events } from 'najm-event';
import { validation } from 'najm-validation';
import { whatsapp } from '../../src/WhatsAppPlugin';
import { registerAdmin, authHeaders } from '../helpers/admin';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const authSchema = {
  users: usersTable,
  roles: rolesTable,
  tokens: tokensTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable,
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

  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_instances (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'disconnected', phone TEXT, profile_name TEXT, connected_at TEXT, last_seen_at TEXT, auto_connect INTEGER NOT NULL DEFAULT 0, last_error TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_messages (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, direction TEXT NOT NULL, jid TEXT NOT NULL, from_me INTEGER NOT NULL, type TEXT NOT NULL, content TEXT, wa_message_id TEXT, quoted_id TEXT, status TEXT, metadata TEXT, timestamp TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_contacts (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, phone TEXT, name TEXT, push_name TEXT, profile_picture_url TEXT, is_business INTEGER, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_groups (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT NOT NULL, description TEXT, participant_count INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0, picture_url TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_chats (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, jid TEXT NOT NULL, name TEXT, is_group INTEGER NOT NULL, unread_count INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_muted INTEGER DEFAULT 0, labels TEXT, last_message_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_labels (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, predefined INTEGER DEFAULT 0)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_webhooks (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, instance_id TEXT, url TEXT NOT NULL, events TEXT, headers TEXT, enabled INTEGER NOT NULL DEFAULT 1, signing_secret TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (id TEXT PRIMARY KEY, instance_id TEXT, event_type TEXT NOT NULL, payload TEXT, forward_status TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_studio_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, instance_id TEXT, user_id TEXT, details TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL UNIQUE, creds TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS whatsapp_session_keys (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, key_type TEXT NOT NULL, key_id TEXT NOT NULL, value TEXT NOT NULL)`);
}

let server: Server | undefined;
let port = 5900;

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
      sessions: { driver: 'file', path: `./test-sessions-studio-${p}` },
      webhooks: [{ url: 'https://example.test/webhook', events: ['studio.test'] }],
      studioApi: true,
    }));

  await server.listen(p);
  const token = await registerAdmin(p, rawSqlite);
  return { base: `http://localhost:${p}`, rawSqlite, headers: authHeaders(token) };
}

async function json(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe('Studio controller integration', () => {
  test('routes and persists through the studio controller set', async () => {
    const { base, rawSqlite, headers } = await setup();

    const created = await fetch(`${base}/wa-studio/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: 'int-1', name: 'Integration' }),
    });
    expect(created.status).toBe(200);
    expect((await json(created)).id).toBe('int-1');

    const instances = await fetch(`${base}/wa-studio/instances`, { headers });
    expect(await json(instances)).toHaveLength(1);

    const qr = await fetch(`${base}/wa-studio/instances/int-1/qr`, { headers });
    expect(await json(qr)).toEqual({ qr: null });

    const messages = await fetch(`${base}/wa-studio/messages/int-1/123@s.whatsapp.net?limit=5`, { headers });
    expect(messages.status).toBe(200);
    expect(await json(messages)).toEqual([]);

    const conversations = await fetch(`${base}/wa-studio/conversations/int-1`, { headers });
    expect(conversations.status).toBe(200);
    expect(await json(conversations)).toEqual([]);

    const contacts = await fetch(`${base}/wa-studio/contacts/int-1?limit=10&offset=0`, { headers });
    expect(contacts.status).toBe(200);
    expect(await json(contacts)).toEqual([]);

    const labels = await fetch(`${base}/wa-studio/labels/int-1`, { headers });
    expect(labels.status).toBe(200);
    expect(await json(labels)).toEqual([]);

    const settings = await fetch(`${base}/wa-studio/settings`, { headers });
    expect(settings.status).toBe(200);
    expect((await json(settings)).sessions.driver).toBe('file');

    // DB starts empty (config.webhooks is consumed by the forwarder, not listed here)
    const emptyWebhooks = await fetch(`${base}/wa-studio/webhooks`, { headers });
    expect(emptyWebhooks.status).toBe(200);
    expect(await json(emptyWebhooks)).toEqual([]);

    const createdHook = await fetch(`${base}/wa-studio/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        url: 'https://example.test/dynamic',
        events: ['message'],
      }),
    });
    expect(createdHook.status).toBe(200);
    const hookBody = await json(createdHook);
    expect(hookBody.url).toBe('https://example.test/dynamic');

    const updatedHook = await fetch(`${base}/wa-studio/webhooks/${hookBody.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ enabled: false }),
    });
    expect(updatedHook.status).toBe(200);
    expect((await json(updatedHook)).enabled).toBe(false);

    const listAfter = await fetch(`${base}/wa-studio/webhooks`, { headers });
    expect((await json(listAfter))).toHaveLength(1);

    const deletedHook = await fetch(`${base}/wa-studio/webhooks/${hookBody.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(deletedHook.status).toBe(200);
    expect((await json(deletedHook)).success).toBe(true);

    const badGroup = await fetch(`${base}/wa-studio/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ instanceId: 'int-1' }),
    });
    expect(badGroup.status).toBe(400);

    const profile = await fetch(`${base}/wa-studio/profile/missing/picture?jid=123@s.whatsapp.net`, { headers });
    expect(profile.status).toBe(500);

    const chatOps = await fetch(`${base}/wa-studio/chat-ops/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ instanceId: 'missing', jid: '123@s.whatsapp.net' }),
    });
    expect(chatOps.status).toBe(500);

    const auditRows = rawSqlite
      .query(`SELECT action, instance_id FROM whatsapp_studio_audit_logs ORDER BY action`)
      .all() as Array<{ action: string; instance_id: string | null }>;
    expect(auditRows).toContainEqual({ action: 'instance.create', instance_id: 'int-1' });
  });
});
