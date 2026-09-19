import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getTableConfig as getPgTableConfig } from 'drizzle-orm/pg-core';
import { getTableConfig as getSqliteTableConfig } from 'drizzle-orm/sqlite-core';

import { rolesTable as pgRolesTable } from '../src/schema/pg';
import { authSchema, rolesTable as sqliteRolesTable } from '../src/schema/sqlite';
import { authSeed } from '../src/seed';
import { seedAuthData } from '../src/seedAuthData';
import { RoleService } from '../src/roles/RoleService';

/**
 * A role name is a domain identity. Guards match `admin` by name and seeding
 * reconciles roles by name, so two rows sharing a name make every downstream
 * authorization answer ambiguous. These tests pin the invariant at the three
 * places it can be lost: the schema, the seed declaration, and the service race.
 */

const AUTH_DDL = `
  CREATE TABLE roles (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    name text NOT NULL,
    description text
  );
  CREATE UNIQUE INDEX roles_name_unique ON roles (name);

  CREATE TABLE permissions (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    name text NOT NULL UNIQUE,
    description text,
    resource text NOT NULL,
    action text NOT NULL
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
    image text,
    status text DEFAULT 'pending',
    role_id text REFERENCES roles(id),
    last_login text,
    failed_login_attempts integer DEFAULT 0,
    lockout_until text
  );

  CREATE TABLE role_permissions (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX role_permission_unique ON role_permissions (role_id, permission_id);
`;

const SEED_ROLES = [
  { name: 'admin', description: 'System administrator' },
  { name: 'delivery', description: 'Delivery staff' },
];

const SEED_PERMISSIONS = [
  { action: 'read', resource: 'orders', name: 'read:orders', description: 'Read orders' },
  { action: 'update', resource: 'orders', name: 'update:orders', description: 'Update orders' },
];

function makeDatabase() {
  const sqlite = new Database(':memory:');
  sqlite.exec(AUTH_DDL);
  return { db: drizzle(sqlite, { schema: authSchema }), sqlite };
}

async function seed(db: unknown, adminEmail = 'admin@test.dev') {
  return seedAuthData({
    db,
    adminEmail,
    adminPassword: 'AdminPass123!',
    bcryptRounds: 4,
    roles: SEED_ROLES,
    permissions: SEED_PERMISSIONS,
  });
}

function makeRoleService(overrides: {
  create?: () => Promise<unknown>;
  update?: () => Promise<unknown>;
  role?: Record<string, unknown>;
} = {}) {
  const role = overrides.role ?? { id: 'r1', name: 'editor' };
  const roleRepository = {
    create: overrides.create ?? (async () => role),
    update: overrides.update ?? (async () => role),
    getByName: async () => undefined,
    getById: async () => role,
    hasUsers: async () => false,
    delete: async () => role,
  };
  const roleValidator = {
    checkRoleExists: async () => role,
    checkNameUnique: async () => undefined,
  };

  const service = new RoleService(roleRepository as any, roleValidator as any);
  (service as any).t = (key: string) => key;
  return service;
}

describe('role-name uniqueness is declared by the schema', () => {
  test('PostgreSQL declares a unique index on roles.name', () => {
    const unique = getPgTableConfig(pgRolesTable).indexes.filter((index) => index.config.unique);

    expect(unique).toHaveLength(1);
    expect(unique[0]!.config.name).toBe('roles_name_unique');
    expect(unique[0]!.config.columns.map((column: any) => column.name)).toEqual(['name']);
  });

  test('SQLite declares the same unique index on roles.name', () => {
    const unique = getSqliteTableConfig(sqliteRolesTable).indexes.filter(
      (index) => index.config.unique,
    );

    expect(unique).toHaveLength(1);
    expect(unique[0]!.config.name).toBe('roles_name_unique');
    expect(unique[0]!.config.columns.map((column: any) => column.name)).toEqual(['name']);
  });

  test('the database rejects a second row with the same role name', () => {
    const { sqlite } = makeDatabase();
    sqlite.exec("INSERT INTO roles (id, name) VALUES ('role_delivery', 'delivery')");

    expect(() =>
      sqlite.exec("INSERT INTO roles (id, name) VALUES ('Ab3xZ', 'delivery')"),
    ).toThrow(/UNIQUE constraint failed/i);
  });
});

describe('auth seeding identifies roles by name', () => {
  test('the roles seed entry declares its domain identity', () => {
    const entry = authSeed({ adminEmail: 'admin@test.dev', adminPass: 'AdminPass123!' })
      .roles as { by?: string[] };

    expect(entry.by).toEqual(['name']);
  });

  test('a pre-existing role with a legacy random ID is reused, not duplicated', async () => {
    const { db, sqlite } = makeDatabase();
    sqlite.exec("INSERT INTO roles (id, name, description) VALUES ('Ab3xZ', 'delivery', 'legacy')");

    await seed(db);

    const rows = sqlite.query('SELECT id FROM roles WHERE name = ?').all('delivery') as Array<{
      id: string;
    }>;
    expect(rows.map((row) => row.id)).toEqual(['Ab3xZ']);
  });

  test('downstream admin and grant rows reference the live legacy ID', async () => {
    const { db, sqlite } = makeDatabase();
    sqlite.exec("INSERT INTO roles (id, name, description) VALUES ('Xy9Qw', 'admin', 'legacy')");

    await seed(db);

    const [admin] = sqlite
      .query('SELECT role_id FROM users WHERE email = ?')
      .all('admin@test.dev') as Array<{ role_id: string }>;
    expect(admin!.role_id).toBe('Xy9Qw');

    const grants = sqlite.query('SELECT role_id FROM role_permissions').all() as Array<{
      role_id: string;
    }>;
    expect(grants).toHaveLength(SEED_PERMISSIONS.length);
    expect(new Set(grants.map((grant) => grant.role_id))).toEqual(new Set(['Xy9Qw']));
  });

  test('repeat seeding is idempotent', async () => {
    const { db, sqlite } = makeDatabase();

    await seed(db);
    await seed(db);

    const roles = sqlite.query('SELECT name, COUNT(*) AS total FROM roles GROUP BY name').all() as Array<{
      name: string;
      total: number;
    }>;
    expect(roles).toHaveLength(SEED_ROLES.length);
    expect(roles.every((row) => row.total === 1)).toBe(true);

    const [users] = sqlite.query('SELECT COUNT(*) AS total FROM users').all() as Array<{
      total: number;
    }>;
    expect(users!.total).toBe(1);
  });
});

describe('concurrent role writes answer with a conflict', () => {
  const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  });

  test('recognizes a unique violation from either dialect', async () => {
    const violations: unknown[] = [
      uniqueViolation,
      new Error('UNIQUE constraint failed: roles.name'),
      { code: 'SQLITE_CONSTRAINT_UNIQUE' },
    ];

    for (const violation of violations) {
      const service = makeRoleService({
        create: async () => {
          throw violation;
        },
      });
      await expect(service.create({ name: 'editor' })).rejects.toMatchObject({ status: 409 });
    }
  });

  test('a creation that loses the race returns 409, not a raw 500', async () => {
    const service = makeRoleService({
      create: async () => {
        throw uniqueViolation;
      },
    });

    await expect(service.create({ name: 'editor' })).rejects.toMatchObject({ status: 409 });
  });

  test('a rename that loses the race returns 409, not a raw 500', async () => {
    const service = makeRoleService({
      update: async () => {
        throw uniqueViolation;
      },
    });

    await expect(service.update('r1', { name: 'editor' })).rejects.toMatchObject({ status: 409 });
  });

  test('an unrelated failure is still surfaced unchanged', async () => {
    const service = makeRoleService({
      create: async () => {
        throw new Error('connection terminated');
      },
    });

    await expect(service.create({ name: 'editor' })).rejects.toThrow('connection terminated');
  });
});
