import 'reflect-metadata';
import { describe, expect, spyOn, test } from 'bun:test';
import { Server } from 'najm-core';
import { database, TransactionService } from 'najm-database';
import jwt from 'jsonwebtoken';
import { AuthService } from '../src/auth/AuthService';
import { authSchema } from '../src/schema/sqlite';
import { harness } from './helpers/securityHarness';
describe('authorization catalog mutations invalidate captured claims', () => {
  test('renaming a role denies its old bearer and signed snapshot while another role stays live', async () => {
    const h = await harness();
    const unrelated = await h.tokens.generateTokens('two');
    const old = await h.signIn();
    await expect(h.tokens.getUser(`Bearer ${old.accessToken}`)).resolves.toMatchObject({ role: 'editor' });
    await h.roles.update('editor', { name: 'former-editor' });
    const recovered = await h.expectInvalidated(old);
    expect(recovered.roles).toEqual(['former-editor']);
    await expect(h.tokens.verifyAccessToken(unrelated.accessToken)).resolves.toBeDefined();
  });

  test('renaming a permission removes the old name from recovery and cached principals', async () => {
    const h = await harness();
    const old = await h.signIn();
    await h.tokens.getUser(`Bearer ${old.accessToken}`);
    await h.permissions.update('write', { name: 'orders:archive' });
    const recovered = await h.expectInvalidated(old);
    expect(recovered.permissions).toEqual(['orders:archive']);
  });

  test('deleting a permission cascades its grant and invalidates only its role holders', async () => {
    const h = await harness();
    const unrelated = await h.tokens.generateTokens('two');
    const old = await h.signIn();
    await h.permissions.delete('write');
    expect((await h.expectInvalidated(old)).permissions).toEqual([]);
    await expect(h.tokens.verifyAccessToken(unrelated.accessToken)).resolves.toBeDefined();
  });

  test('deleting every permission denies all snapshots that captured a grant', async () => {
    const h = await harness();
    const one = await h.signIn();
    const two = await h.tokens.generateTokens('two');
    await h.permissions.deleteAll();
    expect((await h.expectInvalidated(one)).permissions).toEqual([]);
    await expect(h.tokens.verifyAccessToken(two.accessToken)).rejects.toMatchObject({ status: 401 });
  });

  test('description edits preserve existing credentials', async () => {
    const h = await harness();
    const old = await h.signIn();
    await h.roles.update('editor', { description: 'New display text' });
    await h.permissions.update('write', { description: 'New display text' });
    await expect(h.tokens.verifyAccessToken(old.accessToken)).resolves.toBeDefined();
    expect(await h.resolver.resolveFromSessionCookie()).not.toBe(false);
  });

  test('revocation markers outlive a snapshot when access tokens are shorter lived', async () => {
    const h = await harness({ shortAccess: true });
    const old = await h.signIn();
    await h.permissions.removePermissionFromRole('editor', 'write');
    // The marker must protect the whole 300-second snapshot lifetime, even
    // though this application issues one-second bearer tokens.
    expect(await h.cache.ttl('auth:session-version:one')).toBeGreaterThan(299_000);
    const now = Date.now();
    const clock = spyOn(Date, 'now').mockReturnValue(now + 2_000);
    try {
      expect(Date.now() - h.jar.snapshot.iat).toBeLessThan(h.config.session.maxAge * 1_000);
      expect(await h.resolver.resolveFromSessionCookie()).toBe(false);
    } finally {
      clock.mockRestore();
    }
  });

  test('the built plugin wires role invalidation through an outer transaction during a real server boot', async () => {
    const h = await harness();
    const built = await import('../dist/index.js');
    const server = new Server({ isolated: true, silent: true }).use(database(h.db)).use(built.auth({
      jwt: h.config.jwt,
      bcryptRounds: 4,
      schema: authSchema,
      encryptionKey: '0123456789abcdef0123456789abcdef',
      email: { provider: { provider: 'memory' }, defaultFrom: 'auth@example.test' },
      cache: { driver: 'memory' },
    }));
    try {
      await server.init();
      const tokens = await server.container.resolve(built.TokenService);
      const roles = await server.container.resolve(built.RoleService);
      const transactions = await server.container.resolve(TransactionService);
      const session = await tokens.generateTokens('one');
      await expect(tokens.verifyAccessToken(session.accessToken)).resolves.toBeDefined();
      let transient: Awaited<ReturnType<typeof tokens.generateTokens>>;
      await transactions.run(async () => {
        await roles.update('editor', { name: 'former-editor' });
        transient = await tokens.generateTokens('one');
        await expect(tokens.verifyAccessToken(transient.accessToken)).resolves.toBeDefined();
      });
      await expect(tokens.verifyAccessToken(session.accessToken)).rejects.toMatchObject({ status: 401 });
      await expect(tokens.verifyAccessToken(transient!.accessToken)).rejects.toMatchObject({ status: 401 });
      // Resolve the compiled setup service through DI as well: its credential
      // reader and signing configuration must come from the actual plugin.
      const setup = await server.container.resolve(built.CredentialSetupService);
      const users = await server.container.resolve(built.UserService);
      let setupCookie: string | undefined;
      Object.assign(setup, {
        authCookies: h.cookies,
        cookies: {
          get: () => setupCookie,
          setSession: (_name: string, value: string) => { setupCookie = value; },
          delete: () => { setupCookie = undefined; },
        },
      });
      await setup.begin('one', { purpose: 'password' });
      expect(await setup.require({ purpose: 'password' })).toMatchObject({ userId: 'one' });
      await users.update('one', { email: 'new-owner@example.test' });
      await expect(setup.require({ purpose: 'password' })).rejects.toMatchObject({ status: 401 });
    } finally {
      await server.stop();
    }
  });
});

describe('JWT validation separates credential purposes', () => {
  test('a refresh token cannot authorize as a bearer when JWT secrets are shared', async () => {
    const h = await harness({ sharedSecret: true });
    const session = await h.signIn();
    await expect(h.tokens.getUser(`Bearer ${session.refreshToken}`)).rejects.toMatchObject({ status: 401 });
    await expect(h.tokens.verifyAccessToken(session.accessToken)).resolves.toBeDefined();
  });

  test('an access token cannot pass refresh validation when JWT secrets are shared', async () => {
    const h = await harness({ sharedSecret: true });
    const session = await h.signIn();
    expect(() => h.tokens.verifyRefreshToken(session.accessToken)).toThrow();
    expect(h.tokens.verifyRefreshToken(session.refreshToken)).toMatchObject({ userId: 'one' });
  });

  test('an access token without an expiry is refused even with a live family', async () => {
    const h = await harness();
    const session = await h.signIn();
    const token = jwt.sign({ userId: 'one', jti: 'unbounded', tokenFamily: session.tokenFamily },
      h.config.jwt.accessSecret);
    await expect(h.tokens.verifyAccessToken(token)).rejects.toMatchObject({ status: 401 });
  });
});

describe('identity writes match login resolution', () => {
  test('an existing mixed-case email cannot be registered again with another casing', async () => {
    const h = await harness();
    await expect(h.users.create({ email: 'one@example.test', password: 'ValidPass123' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('email updates check the same case-insensitive identity as login', async () => {
    const h = await harness();
    await expect(h.users.update('two', { email: 'ONE@example.test' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('phone updates store a login-resolvable number and reject aliases already owned', async () => {
    const h = await harness();
    await h.users.update('one', { phone: '06 12 34 56 78' });
    expect((await h.users.findByPhone('+212612345678'))?.id).toBe('one');
    await expect(h.users.update('two', { phone: '0612345678' })).rejects.toMatchObject({ status: 409 });
    await expect(h.users.update('one', { phone: 'not-a-number' })).rejects.toMatchObject({ status: 400 });
    await h.users.update('one', { phone: null });
    expect((await h.userRecords.getRawById('one'))?.phone).toBeNull();
  });

  test('password reset resolves the same mixed-case email identity as login', async () => {
    const h = await harness();
    const recipients: unknown[] = [];
    const issuedFor: string[] = [];
    const auth = new AuthService({ generateResetToken: async (id: string) => {
      issuedFor.push(id); return { token: 'test-reset' };
    } } as never, h.users, h.validator, {} as never, {} as never, {} as never,
    { sendHtml: async (email: string) => { recipients.push(email); } } as never);
    Object.assign(auth, { config: h.config, t: (key: string) => key, logger: { warn() {} } });
    await auth.forgotPassword('one@example.test');
    expect(issuedFor).toEqual(['one']);
    expect(recipients).toEqual(['One@Example.Test']);
  });
});

