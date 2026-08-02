import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { CredentialSetupRepository } from '../src/credentialSetup/CredentialSetupRepository';
import { CredentialSetupService } from '../src/credentialSetup/CredentialSetupService';
import { authSchema } from '../src/schema/sqlite';

const SETUP_DDL = `
  CREATE TABLE credential_setup_sessions (
    id text PRIMARY KEY,
    created_at text,
    updated_at text,
    user_id text NOT NULL,
    purpose text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at text NOT NULL,
    consumed_at text,
    revoked_at text
  );
`;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function makeRepository() {
  const sqlite = new Database(':memory:');
  sqlite.exec(SETUP_DDL);
  const db = drizzle(sqlite, { schema: authSchema });
  const repository = new CredentialSetupRepository();
  (repository as any).db = db;
  (repository as any).schema = authSchema;
  return { db, repository };
}

describe('durable credential setup sessions', () => {
  test('replaces an active purpose session and consumes the replacement once', async () => {
    const { db, repository } = makeRepository();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    await repository.replaceActive({
      userId: 'user-1',
      purpose: 'password-setup',
      tokenHash: hash('first'),
      expiresAt,
    });
    await repository.replaceActive({
      userId: 'user-1',
      purpose: 'password-setup',
      tokenHash: hash('second'),
      expiresAt,
    });

    expect(await repository.findActive(hash('first'), 'password-setup')).toBeUndefined();
    expect(await repository.findActive(hash('second'), 'password-setup')).toMatchObject({
      userId: 'user-1',
      purpose: 'password-setup',
    });

    const claims = await Promise.all([
      repository.consume(hash('second'), 'password-setup'),
      repository.consume(hash('second'), 'password-setup'),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    const rows = await db.select().from(authSchema.credentialSetupSessions)
      .where(eq(authSchema.credentialSetupSessions.userId, 'user-1'));
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.revokedAt)).toHaveLength(1);
    expect(rows.filter((row) => row.consumedAt)).toHaveLength(1);
  });

  test('binds a token to its server-owned purpose', async () => {
    const { repository } = makeRepository();
    await repository.replaceActive({
      userId: 'user-1',
      purpose: 'password-setup',
      tokenHash: hash('opaque'),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(await repository.findActive(hash('opaque'), 'email-change')).toBeUndefined();
    expect(await repository.consume(hash('opaque'), 'email-change')).toBeUndefined();
    expect(await repository.findActive(hash('opaque'), 'password-setup')).toBeDefined();
  });
});

describe('credential setup browser contract', () => {
  let cookieValue: string | undefined;
  let setOptions: Record<string, unknown> | undefined;
  let revoked = 0;
  let invalidated = 0;
  let clearedAuthCookies = 0;
  let active: any;
  let service: CredentialSetupService;

  beforeEach(() => {
    cookieValue = undefined;
    setOptions = undefined;
    revoked = 0;
    invalidated = 0;
    clearedAuthCookies = 0;
    active = undefined;

    const repository = {
      deleteExpired: async () => undefined,
      replaceActive: async (data: any) => {
        active = { ...data };
        return data;
      },
      findActive: async (tokenHash: string, purpose: string) =>
        active?.tokenHash === tokenHash && active?.purpose === purpose
          ? { userId: active.userId, purpose, expiresAt: active.expiresAt }
          : undefined,
      consume: async (tokenHash: string, purpose: string) => {
        if (active?.tokenHash !== tokenHash || active?.purpose !== purpose) return undefined;
        const session = { userId: active.userId, purpose, expiresAt: active.expiresAt };
        active = undefined;
        return session;
      },
      revoke: async () => {
        active = undefined;
        return { userId: 'user-1' };
      },
    };
    const tokens = {
      invalidateUserAccessTokens: async () => { invalidated += 1; },
      revokeAllForUser: async () => { revoked += 1; },
    };
    const authCookies = {
      clearRefreshToken: () => { clearedAuthCookies += 1; },
      clearSessionCookie: () => { clearedAuthCookies += 1; },
    };
    const cookies = {
      get: () => cookieValue,
      setSession: (_name: string, value: string, options: Record<string, unknown>) => {
        cookieValue = value;
        setOptions = options;
      },
      delete: () => { cookieValue = undefined; },
    };

    service = new CredentialSetupService(
      repository as any,
      tokens as any,
      authCookies as any,
      cookies as any,
    );
  });

  test('issues only a Strict browser-session cookie and revokes normal sessions', async () => {
    const started = await service.begin('user-1', {
      purpose: 'password-setup',
      cookieName: 'app.setup',
    });

    expect(started.purpose).toBe('password-setup');
    expect(cookieValue).toBeDefined();
    expect(setOptions).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'Strict',
    });
    expect(setOptions).not.toHaveProperty('maxAge');
    expect(setOptions).not.toHaveProperty('expires');
    expect(invalidated).toBe(1);
    expect(revoked).toBe(1);
    expect(clearedAuthCookies).toBe(2);
  });

  test('consumes around the application callback and clears the cookie', async () => {
    await service.begin('user-1', { purpose: 'password-setup' });
    const result = await service.consume(
      { purpose: 'password-setup' },
      async (session) => ({ changed: true, userId: session.userId }),
    );

    expect(result).toEqual({ changed: true, userId: 'user-1' });
    expect(cookieValue).toBeUndefined();
    await expect(service.require({ purpose: 'password-setup' })).rejects.toThrow();
  });
});
