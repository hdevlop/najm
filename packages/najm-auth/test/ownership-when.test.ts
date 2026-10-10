import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { drizzle as pgDrizzle } from 'drizzle-orm/pg-proxy';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pgTable, text as pgText } from 'drizzle-orm/pg-core';
import { eq, inArray, isNull, sql } from 'drizzle-orm';
import { own, join, where, when, ownedIds } from '../src';
import { ownershipCondition, type OwnershipReadContext } from '../src/ownership/ownershipCondition';

const signedIn = (role: string, id = 'u1'): OwnershipReadContext => ({
  hasActiveContext: () => true, getUser: () => ({ id, role }),
});

// ── SQL shape (pg) ─────────────────────────────────────────────────────────

const alerts = pgTable('alerts', {
  id: pgText('id').primaryKey(),
  studentId: pgText('student_id'),
  classId: pgText('class_id'),
  audience: pgText('audience'),
  createdBy: pgText('created_by'),
});
const students = pgTable('students', { id: pgText('id').primaryKey(), parentUserId: pgText('parent_user_id') });
const classes = pgTable('classes', { id: pgText('id').primaryKey(), teacherUserId: pgText('teacher_user_id') });

const pg = pgDrizzle(async () => ({ rows: [] })) as any;
const render = (table: any, condition: unknown) =>
  pg.select().from(table).where(condition).toSQL() as { sql: string; params: unknown[] };

const Alert = own(alerts, { adminRoles: ['principal'] })
  .for('parent', join(alerts.studentId, students.id), where(students.parentUserId), when(eq(alerts.audience, 'parents')))
  .for('teacher', when(isNull(alerts.studentId), (userId) => eq(alerts.createdBy, userId)))
  .for('student', when((userId, role) => sql`${alerts.audience} in ('all', ${role}) and ${userId} is not null`));
const Class = own(classes, { adminRoles: ['principal'] }).for('teacher', where(classes.teacherUserId));

describe('when() row conditions', () => {
  test('narrow a join chain by a condition on the owned row', () => {
    const { sql: text, params } = render(alerts, ownershipCondition(pg, [Alert], signedIn('parent')));
    expect(text).toBe(
      'select "id", "student_id", "class_id", "audience", "created_by" from "alerts" '
      + 'where "alerts"."id" in (select "alerts"."id" from "alerts" '
      + 'inner join "students" "_sc_students_1" on "alerts"."student_id" = "_sc_students_1"."id" '
      + 'where ("_sc_students_1"."parent_user_id" = $1 and "alerts"."audience" = $2))',
    );
    expect(params).toEqual(['u1', 'parents']);
  });

  test('are the whole rule on their own, AND-ed, with functions given the user', () => {
    const { sql: text, params } = render(alerts, ownershipCondition(pg, [Alert], signedIn('teacher')));
    expect(text).not.toContain('join');
    expect(text).toContain('where ("alerts"."student_id" is null and "alerts"."created_by" = $1)');
    expect(params).toEqual(['u1']);
  });

  test('pass the rule\'s role to a function', () => {
    const { params } = render(alerts, ownershipCondition(pg, [Alert], signedIn('student')));
    expect(params).toEqual(['student', 'u1']);
  });

  test('several when() steps are AND-ed in order', () => {
    const token = own(alerts).for('parent', when(eq(alerts.audience, 'parents')), when(isNull(alerts.classId)));
    const { sql: text } = render(alerts, ownershipCondition(pg, [token], signedIn('parent')));
    expect(text).toContain('("alerts"."audience" = $1 and "alerts"."class_id" is null)');
  });

  test('a join chain still has to end at the user', () => {
    expect(() => own(alerts).for('parent', join(alerts.studentId, students.id), when(isNull(alerts.classId))))
      .toThrow('Ownership chain must end with where()');
  });

  test('admin roles bypass and roles without a rule see nothing', () => {
    expect(ownershipCondition(pg, [Alert], signedIn('principal'))).toBeUndefined();
    expect(render(alerts, ownershipCondition(pg, [Alert], signedIn('janitor'))).sql).toContain('1 = 0');
  });

  test('tokens with when() rules are OR-ed with other tokens', () => {
    const ByAuthor = own(alerts).for('teacher', where(alerts.createdBy));
    const { sql: text } = render(alerts, ownershipCondition(pg, [Alert, ByAuthor], signedIn('teacher')));
    expect(text.match(/"alerts"\."id" in \(select/g)).toHaveLength(2);
    expect(text).toContain(') or "alerts"."id" in (select');
  });
});

describe('ownedIds()', () => {
  test('is the owned id subquery for a scoped role', () => {
    expect(ownedIds(Class, 'teacher', 'u1').toSQL()).toEqual({
      sql: 'select "id" from "classes" where "classes"."teacher_user_id" = $1',
      params: ['u1'],
    });
  });

  test('selects every id for an admin role and none for a role without a rule', () => {
    expect(ownedIds(Class, 'principal', 'u1').toSQL()).toEqual({ sql: 'select "id" from "classes"', params: [] });
    expect(ownedIds(Class, 'parent', 'u1').toSQL().sql).toBe('select "id" from "classes" where 1 = 0');
  });

  test('feeds another token\'s when() rule', () => {
    const ClassAlert = own(alerts, { adminRoles: ['principal'] })
      .for('teacher', when((userId, role) => inArray(alerts.classId, ownedIds(Class, role, userId))));
    const { sql: text, params } = render(alerts, ownershipCondition(pg, [ClassAlert], signedIn('teacher')));
    expect(text).toContain('"alerts"."class_id" in (select "id" from "classes" where "classes"."teacher_user_id" = $1)');
    expect(params).toEqual(['u1']);
  });

  test('requires an id column', () => {
    const noId = pgTable('things', { key: pgText('key') });
    expect(() => ownedIds(own(noId).for('a', where(noId.key)), 'a', 'u1')).toThrow('things has no id column');
  });
});

describe('own() options', () => {
  test('name overrides the table name and keeps adminRoles', () => {
    const token = own(alerts, { name: 'notices', adminRoles: ['principal'] }).for('teacher', where(alerts.createdBy));
    expect(token.name).toBe('notices');
    expect(token.symbol.description).toBe('notices');
    expect(token.table).toBe(alerts);
    expect(ownershipCondition(pg, [token], signedIn('principal'))).toBeUndefined();
    expect(own(alerts).name).toBe('alerts');
  });
});

// ── Rows actually returned (sqlite) ────────────────────────────────────────

const items = sqliteTable('items', { id: text('id').primaryKey(), ownerId: text('owner_id'), audience: text('audience') });
const folders = sqliteTable('folders', { id: text('id').primaryKey(), ownerId: text('owner_id') });
const placed = sqliteTable('placed', { id: text('id').primaryKey(), itemId: text('item_id'), folderId: text('folder_id') });

let sqlite: Database;
let db: ReturnType<typeof drizzle>;
beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite);
  sqlite.exec(`
    CREATE TABLE items (id TEXT PRIMARY KEY, owner_id TEXT, audience TEXT);
    CREATE TABLE folders (id TEXT PRIMARY KEY, owner_id TEXT);
    CREATE TABLE placed (id TEXT PRIMARY KEY, item_id TEXT, folder_id TEXT);
    INSERT INTO items VALUES ('a', 'alice', 'all'), ('b', 'alice', 'staff'), ('c', 'bob', 'all'), ('d', null, 'members');
    INSERT INTO folders VALUES ('f1', 'alice'), ('f2', 'bob');
    INSERT INTO placed VALUES ('p1', 'c', 'f1'), ('p2', 'b', 'f2');
  `);
});
afterEach(() => sqlite.close());

const ids = (condition: unknown) =>
  db.select({ id: items.id }).from(items).where(condition as any).orderBy(items.id).all().map((row) => row.id);

describe('when() rows (sqlite)', () => {
  test('narrowing keeps only chained rows that match', () => {
    const token = own(items).for('member', where(items.ownerId), when(eq(items.audience, 'all')));
    expect(ids(ownershipCondition(db, [token], signedIn('member', 'alice')))).toEqual(['a']);
  });

  test('an audience rule reaches rows linked to nobody', () => {
    const token = own(items).for('member', when(eq(items.audience, 'members')));
    expect(ids(ownershipCondition(db, [token], signedIn('member', 'alice')))).toEqual(['d']);
  });

  test('ownedIds of another resource selects through its rule', () => {
    const Folder = own(folders).for('member', where(folders.ownerId));
    const InMyFolder = own(items).for('member', when((userId, role) =>
      sql`${items.id} in (select ${placed.itemId} from ${placed} where ${placed.folderId} in ${ownedIds(Folder, role, userId)})`));
    expect(ids(ownershipCondition(db, [InMyFolder], signedIn('member', 'alice')))).toEqual(['c']);
    expect(ids(ownershipCondition(db, [InMyFolder], signedIn('member', 'bob')))).toEqual(['b']);
  });
});
