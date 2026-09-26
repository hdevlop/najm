import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { drizzle as pgDrizzle } from 'drizzle-orm/pg-proxy';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pgTable, text as pgText } from 'drizzle-orm/pg-core';
import { and, eq, asc, type SQL } from 'drizzle-orm';
import { Container } from 'diject';
import { own, join, where } from '../src/ownership/scopedOwnership';
import { Owned, ScopeContext, OWNED_META } from '../src/ownership/OwnedDecorator';
import { ownershipCondition, type OwnershipReadContext } from '../src/ownership/ownershipCondition';

const items = sqliteTable('items', { id: text('id').primaryKey(), ownerId: text('owner_id'), state: text('state') });
const shares = sqliteTable('shares', { id: text('id').primaryKey(), itemId: text('item_id'), userId: text('user_id') });
const direct = own(items, { adminRoles: ['operator'] }).for('member', where(items.ownerId));
const shared = own(items, { adminRoles: ['operator'] })
  .for('member', join(items.id, shares.itemId), where(shares.userId));
const signedIn = (role = 'member', id = 'alice'): OwnershipReadContext => ({
  hasActiveContext: () => true, getUser: () => ({ id, role }),
});

let sqlite: Database;
let db: ReturnType<typeof drizzle>;
beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite);
  sqlite.exec(`
    CREATE TABLE items (id TEXT PRIMARY KEY, owner_id TEXT, state TEXT);
    CREATE TABLE shares (id TEXT PRIMARY KEY, item_id TEXT, user_id TEXT);
    INSERT INTO items VALUES ('a', 'alice', 'open'), ('b', 'bob', 'open'), ('c', 'alice', 'closed'), ('d', 'dora', 'open');
    INSERT INTO shares VALUES ('s1', 'b', 'alice'), ('s2', 'b', 'alice');
  `);
});
afterEach(() => sqlite.close());

function read(condition: SQL | undefined) {
  return db.select({ id: items.id }).from(items).where(condition).orderBy(items.id).all().map((row) => row.id);
}

describe('composable ownership predicate', () => {
  test('keeps an application filter AND-ed with ownership, including by ID', () => {
    const condition = ownershipCondition(db, [direct], signedIn());
    expect(read(and(condition, eq(items.state, 'open')))).toEqual(['a']);
    expect(read(and(condition, eq(items.id, 'b')))).toEqual([]);
    expect(read(and(condition, eq(items.id, 'a')))).toEqual(['a']);
  });

  test('ORs same-table alternatives without multiplying rows from duplicate joins', () => {
    expect(read(ownershipCondition(db, [direct, shared], signedIn()))).toEqual(['a', 'b', 'c']);
    expect(read(and(ownershipCondition(db, [direct, shared], signedIn()), eq(items.state, 'open')))).toEqual(['a', 'b']);
  });

  test('keeps each app admin-role configuration and still applies application filters', () => {
    expect(ownershipCondition(db, [direct], signedIn('operator'))).toBeUndefined();
    expect(read(and(ownershipCondition(db, [direct], signedIn('operator')), eq(items.id, 'd')))).toEqual(['d']);
    expect(read(ownershipCondition(db, [direct], signedIn('admin')))).toEqual([]);
    const otherApp = own(items, { adminRoles: ['supervisor'] });
    expect(read(ownershipCondition(db, [otherApp], signedIn('operator')))).toEqual([]);
    expect(ownershipCondition(db, [otherApp], signedIn('supervisor'))).toBeUndefined();
  });

  test('denies anonymous requests and roles with no own rule, including prototype names', () => {
    for (const role of ['unknown', '__proto__', 'constructor', 'toString']) {
      expect(read(ownershipCondition(db, [direct, shared], signedIn(role)))).toEqual([]);
    }
    expect(read(ownershipCondition(db, [direct], { hasActiveContext: () => true, getUser: () => null }))).toEqual([]);
  });

  test('preserves trusted seed/job reads outside request context', () => {
    expect(ownershipCondition(db, [direct], undefined)).toBeUndefined();
    expect(ownershipCondition(db, [direct], { hasActiveContext: () => false, getUser: () => null })).toBeUndefined();
  });

  test('rejects empty or mixed-table token sets and unsupported missing ID columns', () => {
    expect(() => ownershipCondition(db, [], signedIn())).toThrow('at least one');
    expect(() => Owned(direct, own(shares))).toThrow('same table');
    expect(() => ownershipCondition(db, [direct, own(shares)], signedIn('operator'))).toThrow('same table');
    const noId = sqliteTable('no_id', { key: text('key').primaryKey() });
    expect(() => ownershipCondition(db, [own(noId)], signedIn())).toThrow('id column');
  });

  test('renders parameterized PostgreSQL ownership and filters in one WHERE', () => {
    const records = pgTable('records', { id: pgText('id').primaryKey(), userId: pgText('user_id') });
    const token = own(records).for('member', where(records.userId));
    const pg = pgDrizzle(async () => ({ rows: [] }));
    const query = pg.select().from(records).where(and(
      ownershipCondition(pg, [token], signedIn()), eq(records.id, 'record-1'),
    )).toSQL();
    expect(query.sql).toContain('"records"."id" in (select "id" from "records" where "records"."user_id" = $1)');
    expect(query.sql).toContain('and "records"."id" = $2');
    expect(query.params).toEqual(['alice', 'record-1']);
  });
});

@Owned(direct, shared)
class ItemsRepository {
  db: any;
  declare ownershipCondition: () => SQL | undefined;
  declare findMany: (options?: any) => Promise<any[]>;
  declare findOne: (options: any) => Promise<any>;
  declare scopedQuery: () => any;
}

describe('Owned decorator compatibility and alternatives', () => {
  test('exposes the predicate and supports alternative rules in existing helpers', async () => {
    const repo = new ItemsRepository();
    repo.db = db;
    (repo as any)._scopeCtx = signedIn();
    expect(Reflect.getMetadata(OWNED_META, ItemsRepository)).toBe(direct);
    expect(read(repo.ownershipCondition())).toEqual(['a', 'b', 'c']);
    expect((await repo.findMany({ where: eq(items.state, 'open'), orderBy: asc(items.id), limit: 1 })).map((row) => row.id)).toEqual(['a']);
    expect((await repo.findOne({ where: eq(items.id, 'b') })).id).toBe('b');
    expect(await repo.findOne({ where: eq(items.id, 'd') })).toBeNull();
    expect(repo.scopedQuery().all().map((row: any) => row.id).sort()).toEqual(['a', 'b', 'c']);
  });

  test('preserves single-token helpers and user-defined methods', async () => {
    @Owned(direct)
    class LegacyRepository { db: any; declare findMany: (opts?: any) => Promise<any[]>; }
    const repo = new LegacyRepository();
    repo.db = db;
    (repo as any)._scopeCtx = signedIn();
    expect((await repo.findMany({ where: eq(items.state, 'open') })).map((row) => row.id)).toEqual(['a']);
    (repo as any)._scopeCtx = { hasActiveContext: () => true, getUser: () => null };
    expect(await repo.findMany()).toEqual([]);
    @Owned(direct)
    class CustomRepository { findMany() { return 'custom'; } }
    expect(new CustomRepository().findMany()).toBe('custom');
  });

  test('injects context through the container and isolates sequential requests', async () => {
    const container = new Container();
    container.set(ScopeContext as any, {});
    container.set(ItemsRepository as any, {});
    const outside: any = await container.resolve(ItemsRepository as any);
    outside.db = db;
    expect(outside._scopeCtx).toBeInstanceOf(ScopeContext);
    expect(outside.ownershipCondition()).toBeUndefined();
    for (const [id, expected] of [['alice', ['a', 'b', 'c']], ['bob', ['b']]] as const) {
      await container.run({ requestId: `req-${id}`, user: { id, role: 'member' } } as any, async () => {
        const repo: any = await container.resolve(ItemsRepository as any);
        repo.db = db;
        expect(read(repo.ownershipCondition())).toEqual([...expected]);
      });
    }
  });
});
