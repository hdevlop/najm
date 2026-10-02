import 'reflect-metadata';
import { expect, test } from 'bun:test';
import postgres from 'postgres';
import { Pool } from 'pg';
import { drizzle as postgresJs } from 'drizzle-orm/postgres-js';
import { drizzle as nodePostgres } from 'drizzle-orm/node-postgres';
import { Server } from 'najm-core';
import { database } from '../dist/index.mjs';

// These real drivers are lazy: no database connection or query is opened.
test('closes an owned postgres-js client and prevents subsequent queries', async () => {
  const client = postgres('postgres://localhost:1/lifecycle_test');
  const db = postgresJs(client);
  const server = new Server({ isolated: true, silent: true }).use(database(db));
  try {
    await server.init();
    await server.stop();
    await expect(client`select 1`.execute()).rejects.toMatchObject({ code: 'CONNECTION_ENDED' });
  } finally {
    await server.stop();
    await client.end({ timeout: 0 });
  }
});

test('awaits shutdown of an owned node-postgres pool', async () => {
  const pool = new Pool({ connectionString: 'postgres://localhost:1/lifecycle_test' });
  const db = nodePostgres(pool);
  const server = new Server({ isolated: true, silent: true }).use(database(db));
  try {
    await server.init();
    await server.stop();
    expect(pool.ended).toBe(true);
    await expect(pool.query('select 1')).rejects.toThrow('after calling end');
  } finally {
    await server.stop();
    if (!pool.ending) await pool.end();
  }
});

test('keeps a shared node-postgres pool open with inline close: false', async () => {
  const pool = new Pool({ connectionString: 'postgres://localhost:1/lifecycle_test' });
  const db = nodePostgres(pool);
  const first = new Server({ isolated: true, silent: true }).use(database({ default: db, close: false }));
  const second = new Server({ isolated: true, silent: true }).use(database({ default: db, close: false }));
  try {
    await first.init();
    await second.init();
    await first.stop();
    expect(pool.ending).toBe(false);
    await second.stop();
    expect(pool.ending).toBe(false);
  } finally {
    await first.stop();
    await second.stop();
    await pool.end();
  }
});
