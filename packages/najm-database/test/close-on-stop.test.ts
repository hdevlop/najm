import "reflect-metadata";
import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import { Server, Service, Meta, plugin, reset } from "najm-core";
import { database, DB, DatabaseService } from "../dist/index.mjs";
import type { DatabaseService as DatabaseServiceType } from '../src';

/** A drizzle-shaped database whose driver client is closed with `end()`. */
function pooledDatabase() {
  const client = { ended: 0, end: async () => { client.ended++; } };
  return { $client: client, query: async () => ({ rows: [] }) };
}

describe("closing databases on stop", () => {
  beforeEach(async () => {
    await reset();
  });

  test("closes a real drizzle bun:sqlite client", async () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);

    const server = new Server({ isolated: true, silent: true }).use(database({ default: db, close: true }));
    await server.init();
    expect(db.all(sql`select 1 as one`)).toEqual([{ one: 1 }]);
    await server.stop();

    expect(() => sqlite.query("select 1").all()).toThrow();
  });

  test("closes a pooled client once when several names share it", async () => {
    const primary = pooledDatabase();
    const alias = { ...primary };
    const other = pooledDatabase();

    const server = new Server({ isolated: true, silent: true })
      .use(database({ primary, alias, other }, { close: true }));
    await server.init();
    await server.stop();

    expect(primary.$client.ended).toBe(1);
    expect(other.$client.ended).toBe(1);
  });

  test("prefers the database's own disconnect()", async () => {
    const calls: string[] = [];
    const db = {
      $client: { end: async () => { calls.push("client.end"); } },
      query: async () => ({ rows: [] }),
      disconnect: async () => { calls.push("disconnect"); },
    };

    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: true }));
    await server.init();
    await server.stop();

    expect(calls).toEqual(["disconnect"]);
  });

  test("close: false leaves connections open", async () => {
    const db = pooledDatabase();

    const server = new Server({ isolated: true, silent: true })
      .use(database({ default: db, close: false }));
    await server.init();
    const service = server.container.get<DatabaseServiceType>(DatabaseService);
    expect(service.get('default')).toBe(db);
    expect(service.getNames()).toEqual(['default']);
    await server.stop();

    expect(db.$client.ended).toBe(0);
  });

  test("omitting close keeps a real shared database usable after either server stops", async () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    const first = new Server({ isolated: true, silent: true }).use(database(db));
    const second = new Server({ isolated: true, silent: true }).use(database({ default: db }));
    try {
      await first.init();
      await second.init();
      await first.stop();
      expect(db.all(sql`select 1 as one`)).toEqual([{ one: 1 }]);
      await second.stop();
      expect(db.all(sql`select 2 as two`)).toEqual([{ two: 2 }]);
    } finally {
      await first.stop();
      await second.stop();
      sqlite.close();
    }
  });

  test("failed initialization leaves caller-owned clients open by default", async () => {
    const db = { ...pooledDatabase(), connect: async () => { throw new Error('connect failed'); } };
    const server = new Server({ isolated: true, silent: true }).use(database(db));
    await expect(server.init()).rejects.toThrow('connect');
    expect(db.$client.ended).toBe(0);
    await server.stop();
    expect(db.$client.ended).toBe(0);
  });

  test("a close function replaces the default, once per distinct client", async () => {
    const primary = pooledDatabase();
    const other = pooledDatabase();
    const closed: string[] = [];

    const server = new Server({ isolated: true, silent: true })
      .use(database({ primary, alias: { ...primary }, other,
        close: async (db, name) => {
          await Promise.resolve();
          closed.push(`${name}:${db.$client === primary.$client ? "primary" : "other"}`);
        },
      }));
    await server.init();
    await server.stop();

    expect(closed.sort()).toEqual(["alias:primary", "other:other"]);
    expect(primary.$client.ended).toBe(0);
  });

  test("a failing close rejects stop after the other clients close", async () => {
    const failing = { $client: { end: async () => { throw new Error("pool stuck"); } }, query: async () => ({}) };
    const healthy = pooledDatabase();

    const server = new Server({ isolated: true, silent: true })
      .use(database({ failing, healthy }, { close: true }));
    await server.init();
    await expect(server.stop()).rejects.toThrow("pool stuck");

    expect(healthy.$client.ended).toBe(1);
  });

  test("app services can still query from their own onDestroy", async () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    let lastQuery: unknown;

    @Service()
    class FlushOnShutdown {
      @DB() db!: typeof db;

      onDestroy() {
        lastQuery = this.db.all(sql`select 2 as two`);
      }
    }

    const server = new Server({ isolated: true, silent: true })
      .use(database(db, { close: true }))
      .load(FlushOnShutdown);
    await server.init();
    await server.stop();

    expect(lastQuery).toEqual([{ two: 2 }]);
    expect(() => sqlite.query("select 1").all()).toThrow();
  });

  test("inline close: false leaves a real shared pool usable", async () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    const first = new Server({ isolated: true, silent: true }).use(database({ default: db, close: false }));
    const second = new Server({ isolated: true, silent: true }).use(database({ default: db, close: false }));
    try {
      await first.init();
      await second.init();
      await first.stop();
      expect(db.all(sql`select 1 as one`)).toEqual([{ one: 1 }]);
      await second.stop();
      expect(db.all(sql`select 2 as two`)).toEqual([{ two: 2 }]);
    } finally {
      await first.stop();
      await second.stop();
      sqlite.close();
    }
  });

  test("a database named close stays a connection, not an option", async () => {
    const db = pooledDatabase();
    const server = new Server({ isolated: true, silent: true }).use(database({ close: db }, { close: true }));
    await server.init();
    expect(server.container.get<DatabaseServiceType>(DatabaseService).get("close")).toBe(db);
    await server.stop();
    expect(db.$client.ended).toBe(1);
  });

  test("plugins can query during teardown before the database closes", async () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    const queries: unknown[] = [];
    @Service()
    @Meta({ layer: 'plugin', order: -10 })
    class FlushPlugin {
      @DB() db!: typeof db;
      onDestroy() { queries.push(this.db.all(sql`select 3 as three`)); }
    }
    const server = new Server({ isolated: true, silent: true })
      .use(database(db, { close: true }))
      .use(plugin('flush').services(FlushPlugin).build());
    await server.init();
    await server.stop();
    expect(queries).toEqual([[{ three: 3 }]]);
    expect(() => sqlite.query("select 1").all()).toThrow();
  });

  test("concurrent and repeated cleanup closes each client at most once", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    let calls = 0;
    const db = { query: () => ({}), disconnect: async () => { calls++; await pending; } };
    const server = new Server({ isolated: true, silent: true })
      .use(database({ primary: db, alias: db }, { close: true }));
    await server.init();
    const service = server.container.get<DatabaseServiceType>(DatabaseService);
    const first = service.onDestroy();
    const second = service.onDestroy();
    expect(calls).toBe(1);
    finish();
    await Promise.all([first, second]);
    await service.clear();
    await server.stop();
    await server.stop();
    expect(calls).toBe(1);
  });

  test("a client disconnected by clear is not disconnected again on stop", async () => {
    let calls = 0;
    const db = { query: () => ({}), disconnect: async () => { calls++; } };
    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: true }));
    await server.init();
    const service = server.container.get<DatabaseServiceType>(DatabaseService);
    await service.clear();
    await service.register('alias', db);
    await server.stop();
    expect(calls).toBe(1);
  });

  test("aggregates failures while still closing healthy clients", async () => {
    const first = { $client: { end: () => { throw new Error('first'); } } };
    const second = { $client: { end: async () => { throw new Error('second'); } } };
    const healthy = pooledDatabase();
    const server = new Server({ isolated: true, silent: true })
      .use(database({ first, second, healthy }, { close: true }));
    await server.init();
    let failure: any;
    try { await server.stop(); } catch (error) { failure = error; }
    expect(failure.cause).toBeInstanceOf(AggregateError);
    expect(failure.cause.errors.map((error: Error) => error.message).sort()).toEqual(['first', 'second']);
    expect(healthy.$client.ended).toBe(1);
  });

  test("automatic cleanup leaves unknown drivers open while closing recognized clients", async () => {
    const unsupported = { query: () => ({}) };
    const healthy = pooledDatabase();
    const server = new Server({ isolated: true, silent: true })
      .use(database({ unsupported, healthy }, { close: true }));
    await server.init();
    await server.stop();
    expect(healthy.$client.ended).toBe(1);
  });

  test("custom cleanup supports drivers without automatic detection", async () => {
    const db = { query: () => ({}) };
    const closed: unknown[] = [];
    const server = new Server({ isolated: true, silent: true })
      .use(database(db, { close: value => { closed.push(value); } }));
    await server.init();
    await server.stop();
    expect(closed).toEqual([db]);
  });

  test("closes clients reachable through a driver session", async () => {
    const primary = pooledDatabase();
    const db = { query: primary.query, session: { client: primary.$client } };
    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: true }));
    await server.init();
    await server.stop();
    expect(primary.$client.ended).toBe(1);
  });

  test("boot rollback closes owned connections", async () => {
    const db = pooledDatabase();
    @Service()
    @Meta({ layer: 'plugin', order: 10 })
    class FailingPlugin {
      configure() { throw new Error('configure failed'); }
    }
    const server = new Server({ isolated: true, silent: true })
      .use(database(db, { close: true }))
      .use(plugin('failure').services(FailingPlugin).build());
    await expect(server.init()).rejects.toThrow('configure failed');
    expect(db.$client.ended).toBe(1);
    await server.stop();
    expect(db.$client.ended).toBe(1);
  });

  test("failed initialization waits for registrations and closes partial connections", async () => {
    const failing = { ...pooledDatabase(), connect: async () => { throw new Error('connect failed'); } };
    const delayed = { ...pooledDatabase(), connect: async () => { await Bun.sleep(5); } };
    const server = new Server({ isolated: true, silent: true })
      .use(database({ failing, delayed }, { close: true }));
    await expect(server.init()).rejects.toThrow('connect');
    expect(failing.$client.ended).toBe(1);
    expect(delayed.$client.ended).toBe(1);
    await server.stop();
    expect(delayed.$client.ended).toBe(1);
  });

  test("replacing an owned registration does not leak its original client", async () => {
    const first = pooledDatabase();
    const second = pooledDatabase();
    const server = new Server({ isolated: true, silent: true }).use(database(first, { close: true }));
    await server.init();
    await server.container.get<DatabaseServiceType>(DatabaseService).register('default', second);
    await server.stop();
    expect(first.$client.ended).toBe(1);
    expect(second.$client.ended).toBe(1);
  });

  test("invalid close options fail before boot", () => {
    expect(() => database({}, { close: 'yes' as any })).toThrow('close must be a boolean or a function');
    expect(() => database({ default: pooledDatabase(), close: 'yes' })).toThrow('close must be a boolean or a function');
  });

  test("a raw client's close method is not interpreted as a configuration callback", async () => {
    let closed = false;
    const db = { query: () => ({}), close() { expect(this).toBe(db); closed = true; } };
    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: true }));
    await server.init();
    await server.stop();
    expect(closed).toBe(true);
  });

  test("the existing second argument still supports shared clients", async () => {
    const db = pooledDatabase();
    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: false }));
    await server.init();
    await server.stop();
    expect(db.$client.ended).toBe(0);
  });

  test("a driver wrapper's close method is not extracted as a plugin option", async () => {
    const primary = pooledDatabase();
    const db = { $client: primary.$client, close() { throw new Error('wrapper mistaken for options'); } };
    const server = new Server({ isolated: true, silent: true }).use(database(db, { close: true }));
    await server.init();
    expect(server.container.get<DatabaseServiceType>(DatabaseService).get()).toBe(db);
    await server.stop();
    expect(primary.$client.ended).toBe(1);
  });
});
