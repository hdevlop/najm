import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getTableColumns } from 'drizzle-orm';
import { CredentialSetupRequirementRepository } from '../src/credentialSetup/CredentialSetupRequirementRepository';
import { authSchema as sqliteSchema } from '../src/schema/sqlite';
import { authSchema as pgSchema } from '../src/schema/pg';

const REQUIREMENTS_DDL = `
  CREATE TABLE credential_setup_requirements (
    user_id text NOT NULL,
    purpose text NOT NULL,
    temporary_credential_kind text,
    required integer NOT NULL DEFAULT 1,
    completed_at text,
    created_at text,
    updated_at text,
    PRIMARY KEY (user_id, purpose)
  );
`;

function makeRepository() {
  const sqlite = new Database(':memory:');
  sqlite.exec(REQUIREMENTS_DDL);
  const repository = new CredentialSetupRequirementRepository();
  (repository as any).db = drizzle(sqlite, { schema: sqliteSchema });
  (repository as any).schema = sqliteSchema;
  return repository;
}

describe('credential setup requirement storage', () => {
  test('one user may owe more than one purpose', async () => {
    const repository = makeRepository();

    await repository.markRequired('user-1', 'password', 'ma-cin');
    await repository.markRequired('user-1', 'mfa', null);

    const required = await repository.listRequired('user-1');
    expect(required.map((row) => row.purpose).sort()).toEqual(['mfa', 'password']);
    expect(await repository.find('user-1', 'password')).toMatchObject({
      temporaryCredentialKind: 'ma-cin',
      required: true,
    });
  });

  test('every read and write is purpose-scoped', async () => {
    const repository = makeRepository();
    await repository.markRequired('user-1', 'password', 'exact');

    expect(await repository.find('user-1', 'mfa')).toBeUndefined();
    expect(await repository.complete('user-1', 'mfa')).toBeUndefined();
    expect(await repository.find('user-1', 'password')).toMatchObject({ required: true });
  });

  test('marking is idempotent and resets a previous completion', async () => {
    const repository = makeRepository();

    await repository.markRequired('user-1', 'password', 'ma-cin');
    await repository.complete('user-1', 'password');
    expect(await repository.find('user-1', 'password')).toMatchObject({
      required: false,
      completedAt: expect.any(String),
    });

    const remarked = await repository.markRequired('user-1', 'password', 'exact');
    expect(remarked).toMatchObject({
      required: true,
      completedAt: null,
      temporaryCredentialKind: 'exact',
    });
  });

  test('only a still-required row completes, so a replay is a no-op', async () => {
    const repository = makeRepository();
    await repository.markRequired('user-1', 'password', 'ma-cin');

    expect(await repository.complete('user-1', 'password')).toBeDefined();
    expect(await repository.complete('user-1', 'password')).toBeUndefined();
  });

  test('concurrent completion has exactly one winner', async () => {
    const repository = makeRepository();
    await repository.markRequired('user-1', 'password', 'ma-cin');

    const results = await Promise.all([
      repository.complete('user-1', 'password'),
      repository.complete('user-1', 'password'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test('the repository refuses a schema without the requirement table', async () => {
    const repository = makeRepository();
    (repository as any).schema = { ...sqliteSchema, credentialSetupRequirements: undefined };
    expect(() => repository.find('user-1', 'password')).toThrow(
      /credentialSetupRequirements is required/,
    );
  });
});

describe('dialect parity', () => {
  test('PostgreSQL and SQLite requirement schemas are equivalent', () => {
    const pgColumns = getTableColumns(pgSchema.credentialSetupRequirements);
    const sqliteColumns = getTableColumns(sqliteSchema.credentialSetupRequirements);

    const names = (columns: Record<string, { name: string }>) =>
      Object.values(columns).map((column) => column.name).sort();

    expect(names(sqliteColumns)).toEqual(names(pgColumns));
    expect(names(pgColumns)).toEqual([
      'completed_at',
      'created_at',
      'purpose',
      'required',
      'temporary_credential_kind',
      'updated_at',
      'user_id',
    ]);

    for (const key of Object.keys(pgColumns)) {
      expect(sqliteColumns[key].notNull).toBe(pgColumns[key].notNull);
      expect(sqliteColumns[key].primary).toBe(pgColumns[key].primary);
    }
  });

  test('both dialects expose the table on authSchema', () => {
    expect(pgSchema.credentialSetupRequirements).toBeDefined();
    expect(sqliteSchema.credentialSetupRequirements).toBeDefined();
  });
});
