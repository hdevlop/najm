import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { Database } from 'bun:sqlite';
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import Redis from 'ioredis';
import { auth } from '../../src/AuthPlugin';
import { authSchema } from '../../src/schema/sqlite';

const DEFAULT_API_URL = 'http://127.0.0.1:8025';
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6399';
const DEFAULT_SMTP_HOST = '127.0.0.1';
const DEFAULT_SMTP_PORT = 1025;

const USERS_DDL = `
  CREATE TABLE roles (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    name text NOT NULL,
    description text
  );
  CREATE TABLE users (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    name text,
    email text NOT NULL UNIQUE,
    email_verified integer DEFAULT 0,
    phone text UNIQUE,
    phone_verified integer DEFAULT 0,
    password text NOT NULL,
    image text DEFAULT 'noavatar.png',
    status text DEFAULT 'pending',
    role_id text REFERENCES roles(id),
    last_login text,
    failed_login_attempts integer DEFAULT 0,
    lockout_until text
  );
`;

type MailpitSummary = { ID: string };

function requireLoopbackUrl(raw: string, name: string, protocols: readonly string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  const loopback = parsed.hostname === '127.0.0.1'
    || parsed.hostname === 'localhost'
    || parsed.hostname === '[::1]'
    || parsed.hostname === '::1';
  if (!loopback || !protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use an allowed protocol on loopback`);
  }
  return parsed;
}

function requireLoopbackHost(raw: string, name: string): string {
  if (raw !== '127.0.0.1' && raw !== 'localhost' && raw !== '::1') {
    throw new Error(`${name} must be a loopback host`);
  }
  return raw;
}

function requirePort(raw: string | undefined, fallback: number, name: string): number {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer port`);
  }
  return value;
}

async function searchMailbox(apiUrl: URL, recipient: string): Promise<MailpitSummary[]> {
  const query = encodeURIComponent(`to:${recipient}`);
  const response = await fetch(new URL(`/api/v1/search?query=${query}`, apiUrl));
  assert.equal(response.status, 200, 'Mailpit search must succeed');
  const payload = await response.json() as { messages?: MailpitSummary[] };
  return payload.messages ?? [];
}

async function waitForMessageCount(
  apiUrl: URL,
  recipient: string,
  expected: number,
): Promise<MailpitSummary[]> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = await searchMailbox(apiUrl, recipient);
    if (messages.length === expected) return messages;
    if (messages.length > expected) break;
    await Bun.sleep(100);
  }
  const messages = await searchMailbox(apiUrl, recipient);
  assert.equal(messages.length, expected, 'Mailpit captured an unexpected message count');
  return messages;
}

async function deleteMessages(apiUrl: URL, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const response = await fetch(new URL('/api/v1/messages', apiUrl), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
  assert.equal(response.status, 200, 'Mailpit cleanup must succeed');
}

async function main(): Promise<void> {
  const apiUrl = requireLoopbackUrl(
    process.env.NAJM_AUTH_MAILPIT_API_URL ?? DEFAULT_API_URL,
    'NAJM_AUTH_MAILPIT_API_URL',
    ['http:', 'https:'],
  );
  const redisUrl = requireLoopbackUrl(
    process.env.NAJM_AUTH_MAILPIT_REDIS_URL ?? DEFAULT_REDIS_URL,
    'NAJM_AUTH_MAILPIT_REDIS_URL',
    ['redis:', 'rediss:'],
  );
  const smtpHost = requireLoopbackHost(
    process.env.NAJM_AUTH_MAILPIT_SMTP_HOST ?? DEFAULT_SMTP_HOST,
    'NAJM_AUTH_MAILPIT_SMTP_HOST',
  );
  const smtpPort = requirePort(
    process.env.NAJM_AUTH_MAILPIT_SMTP_PORT,
    DEFAULT_SMTP_PORT,
    'NAJM_AUTH_MAILPIT_SMTP_PORT',
  );
  const serverPort = requirePort(
    process.env.NAJM_AUTH_MAILPIT_SERVER_PORT,
    37_000 + Math.floor(Math.random() * 1_000),
    'NAJM_AUTH_MAILPIT_SERVER_PORT',
  );

  const readiness = await fetch(new URL('/api/v1/info', apiUrl));
  assert.equal(readiness.status, 200, 'Mailpit API must be ready');

  const redis = new Redis(redisUrl.toString(), {
    connectTimeout: 2_000,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });
  await redis.connect();
  assert.equal(await redis.ping(), 'PONG', 'Redis must be ready');

  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(USERS_DDL);

  const runId = crypto.randomUUID();
  const cachePrefix = `auth-mailpit:${runId}:`;
  const primaryRecipient = `primary-${runId}@example.test`;
  const secondaryRecipient = `secondary-${runId}@example.test`;
  const unknownRecipient = `unknown-${runId}@example.test`;
  const capturedIds = new Set<string>();
  let server: Server | undefined;

  try {
    const now = new Date().toISOString();
    const insert = sqlite.prepare(`
      INSERT INTO users (
        id, created_at, updated_at, name, email, email_verified, password, status
      ) VALUES (?, ?, ?, ?, ?, 1, ?, 'active')
    `);
    insert.run('fixture-primary', now, now, 'Primary fixture', primaryRecipient, 'unused');
    insert.run('fixture-secondary', now, now, 'Secondary fixture', secondaryRecipient, 'unused');

    const db = drizzle(sqlite, { schema: authSchema });
    server = new Server({ isolated: true, silent: true })
      .base('/api')
      .use(database({ default: db }))
      .use(auth({
        dialect: 'sqlite',
        encryptionKey: '0000000000000000000000000000000000000000000000000000000000000000',
        frontendUrl: 'http://127.0.0.1:3000',
        jwt: {
          accessSecret: 'mailpit-access-secret-at-least-32-characters',
          refreshSecret: 'mailpit-refresh-secret-at-least-32-characters',
        },
        cache: {
          driver: 'redis',
          required: true,
          redis: { url: redisUrl.toString(), keyPrefix: cachePrefix },
        },
        rateLimit: {
          keyPrefix: 'rate:',
          trustedProxyHops: 0,
        },
        email: {
          provider: {
            provider: 'smtp',
            host: smtpHost,
            port: smtpPort,
            secure: false,
          },
          defaultFrom: 'no-reply@najm.test',
          retry: { attempts: 1, delay: 0 },
        },
      }));
    await server.listen(serverPort);

    const requestReset = (email: string, identifier: string, forwardedFor: string) => fetch(
      `http://127.0.0.1:${serverPort}/api/auth/forgot-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': forwardedFor,
        },
        body: JSON.stringify({ email, identifier }),
      },
    );

    const statuses: number[] = [];
    const successfulBodies: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await requestReset(
        primaryRecipient,
        `ignored-${attempt}`,
        `198.51.100.${attempt + 1}`,
      );
      statuses.push(response.status);
      successfulBodies.push(await response.text());
    }
    for (const [identifier, forwardedFor] of [
      ['ignored-four', '203.0.113.40'],
      ['ignored-five', '203.0.113.41'],
    ] as const) {
      const response = await requestReset(primaryRecipient, identifier, forwardedFor);
      statuses.push(response.status);
      await response.arrayBuffer();
    }
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);

    const secondaryResponse = await requestReset(
      secondaryRecipient,
      'ignored-secondary',
      '203.0.113.42',
    );
    assert.equal(secondaryResponse.status, 200, 'A different recipient must keep its own allowance');
    const secondaryBody = await secondaryResponse.text();

    const unknownResponse = await requestReset(
      unknownRecipient,
      'ignored-unknown',
      '203.0.113.43',
    );
    assert.equal(unknownResponse.status, 200, 'An unknown recipient must keep the generic response');
    const unknownBody = await unknownResponse.text();
    for (const knownBody of [...successfulBodies, secondaryBody]) {
      assert.equal(unknownBody, knownBody, 'Known and unknown recipients must receive the same response body');
    }

    const primaryMessages = await waitForMessageCount(apiUrl, primaryRecipient, 3);
    const secondaryMessages = await waitForMessageCount(apiUrl, secondaryRecipient, 1);
    const unknownMessages = await waitForMessageCount(apiUrl, unknownRecipient, 0);
    for (const message of [...primaryMessages, ...secondaryMessages, ...unknownMessages]) {
      capturedIds.add(message.ID);
    }

    const redisKeys = await redis.keys(`${cachePrefix}*`);
    assert.ok(redisKeys.length >= 3, 'The Redis-backed limiter must persist isolated buckets');

    console.log('AUTH_MAILPIT_ACCEPTANCE PASS');
    console.log('HTTP primary=200,200,200,429,429 secondary=200 unknown=200 generic_body=matched');
    console.log('MAIL primary=3 secondary=1 unknown=0');
    console.log('REDIS isolated_rate_buckets=present');
  } finally {
    await server?.stop();

    for (const recipient of [primaryRecipient, secondaryRecipient, unknownRecipient]) {
      for (const message of await searchMailbox(apiUrl, recipient)) {
        capturedIds.add(message.ID);
      }
    }
    await deleteMessages(apiUrl, [...capturedIds]);

    const keys = await redis.keys(`${cachePrefix}*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
    sqlite.close();
  }
}

await main();
