import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { getTransactionalMethods } from 'najm-database';
import { AuthService } from '../src/auth/AuthService';
import { TokenService } from '../src/tokens/TokenService';
import { moroccanCinTemporaryCredential } from '../src/identity/ma';

/**
 * The three operations an admin surface composes to recover an account that
 * already exists. What matters here is what each one refuses, what it leaves
 * untouched, and whether it tells the truth about delivery — none of that is
 * visible from the happy path alone.
 */

const ACCOUNT = {
  id: 'user-1',
  name: 'Fatima Z.',
  email: 'fatima@example.ma',
  status: 'active',
  emailVerified: true,
  role: 'family',
};

function recoveryService(options: {
  account?: Record<string, unknown> | null;
  send?: (message: any) => Promise<{ success: boolean }>;
  markRequired?: () => Promise<unknown>;
  requirementsUnavailable?: boolean;
  discard?: (userId: string, jti: string) => Promise<boolean>;
} = {}) {
  const account = 'account' in options ? options.account : ACCOUNT;
  const state = {
    created: [] as unknown[],
    updates: [] as Array<{ id: string; data: any; options: any }>,
    marked: [] as unknown[],
    minted: [] as Array<{ type: 'reset' | 'invite'; userId: string }>,
    discarded: [] as Array<{ userId: string; jti: string }>,
    sent: [] as any[],
    invalidated: [] as string[],
    revoked: [] as string[],
  };

  const tokenService = {
    generateResetToken: async (userId: string) => {
      state.minted.push({ type: 'reset', userId });
      return { token: `reset-token-for-${userId}`, userId, jti: `jti-${state.minted.length}` };
    },
    generateInviteToken: async (userId: string) => {
      state.minted.push({ type: 'invite', userId });
      return { token: `invite-token-for-${userId}`, userId, jti: `jti-${state.minted.length}` };
    },
    discardSetPasswordToken: async (userId: string, jti: string) => {
      state.discarded.push({ userId, jti });
      return options.discard ? options.discard(userId, jti) : true;
    },
    invalidateUserAccessTokens: async (userId: string) => { state.invalidated.push(userId); },
    revokeAllForUser: async (userId: string) => { state.revoked.push(userId); },
  };

  const userService = {
    getById: async (id: string) => {
      if (!account) {
        const error: any = new Error('errors.notFound');
        error.status = 404;
        throw error;
      }
      return { ...account, id };
    },
    create: async (data: unknown) => { state.created.push(data); return { id: 'created-user' }; },
    update: async (id: string, data: any, updateOptions: any) => {
      state.updates.push({ id, data, options: updateOptions });
      return { ...account, id };
    },
  };

  const emailService = {
    send: async (message: any) => {
      state.sent.push(message);
      return options.send ? options.send(message) : { success: true };
    },
    sendHtml: async (to: string, subject: string, html: string) => {
      const message = { to, subject, html };
      state.sent.push(message);
      return options.send ? options.send(message) : { success: true };
    },
  };

  const requirements = options.requirementsUnavailable
    ? undefined
    : {
      markRequired: async (userId: string, purpose: string, markOptions: any) => {
        if (options.markRequired) await options.markRequired();
        state.marked.push({ userId, purpose, ...markOptions });
        return { userId, purpose, required: true };
      },
    };

  const service = new AuthService(
    tokenService as never,
    userService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    emailService as never,
    {} as never,
    requirements as never,
    {} as never,
  );
  (service as any).config = {
    frontendUrl: 'https://app.example.test',
    appName: 'Example',
  };
  (service as any).t = (key: string) => key;
  (service as any).logger = { error() { }, warn() { } };

  return { service, state };
}

describe('resetting an existing account to a temporary credential', () => {
  test('normalizes and stores the CIN, skips strength rules, and records the kind', async () => {
    const { service, state } = recoveryService();

    const result = await service.resetToTemporaryCredential(
      'user-1',
      moroccanCinTemporaryCredential('AB123456'),
    );

    expect(result).toEqual({
      userId: 'user-1',
      purpose: 'password',
      temporaryCredentialKind: 'ma-cin',
    });
    expect(state.updates).toEqual([{
      id: 'user-1',
      data: { password: 'ab123456' },
      options: { validatePasswordStrength: false },
    }]);
    expect(state.marked).toEqual([{
      userId: 'user-1',
      purpose: 'password',
      temporaryCredentialKind: 'ma-cin',
    }]);
  });

  test('returns no credential, token, or link', async () => {
    const { service } = recoveryService();

    const result = await service.resetToTemporaryCredential(
      'user-1',
      moroccanCinTemporaryCredential('AB123456'),
    );

    expect(JSON.stringify(result)).not.toMatch(/ab123456|token|http/i);
  });

  test('repeating the reset is idempotent and re-marks the requirement', async () => {
    const { service, state } = recoveryService();

    await service.resetToTemporaryCredential('user-1', moroccanCinTemporaryCredential('AB123456'));
    await service.resetToTemporaryCredential('user-1', moroccanCinTemporaryCredential('ab123456'));

    expect(state.updates.map((update) => update.data.password)).toEqual(['ab123456', 'ab123456']);
    expect(state.marked).toHaveLength(2);
  });

  test('a value that is not a CIN never reaches the hash', async () => {
    const { service, state } = recoveryService();

    await expect(
      service.resetToTemporaryCredential('user-1', { kind: 'ma-cin', value: 'not-a-cin' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(state.updates).toHaveLength(0);
    expect(state.marked).toHaveLength(0);
  });

  test('an unknown credential kind fails closed instead of falling back', async () => {
    const { service, state } = recoveryService();

    await expect(
      service.resetToTemporaryCredential('user-1', { kind: 'ma-passport', value: 'AB123456' }),
    ).rejects.toThrow(/Unknown temporary credential kind/);
    expect(state.updates).toHaveLength(0);
  });

  test('an unknown account is refused before anything is written', async () => {
    const { service, state } = recoveryService({ account: null });

    await expect(
      service.resetToTemporaryCredential('ghost', moroccanCinTemporaryCredential('AB123456')),
    ).rejects.toMatchObject({ status: 404 });
    expect(state.updates).toHaveLength(0);
    expect(state.marked).toHaveLength(0);
  });

  test('a failed requirement mark fails the whole reset', async () => {
    // The credential write and the requirement share one @Transaction, so the
    // temporary credential never survives a requirement that did not stick.
    const { service, state } = recoveryService({
      markRequired: async () => { throw new Error('requirement write failed'); },
    });

    await expect(
      service.resetToTemporaryCredential('user-1', moroccanCinTemporaryCredential('AB123456')),
    ).rejects.toThrow('requirement write failed');
    expect(state.updates).toHaveLength(1);
  });

  test('the credential write and the requirement share one transaction', () => {
    expect(
      getTransactionalMethods(AuthService).map((method) => String(method.propertyKey)),
    ).toContain('resetToTemporaryCredential');
  });

  test('the reset is refused when credential setup is not registered', async () => {
    const { service, state } = recoveryService({ requirementsUnavailable: true });

    await expect(
      service.resetToTemporaryCredential('user-1', moroccanCinTemporaryCredential('AB123456')),
    ).rejects.toBeDefined();
    expect(state.updates).toHaveLength(0);
  });

  test('it never creates a user and never issues a session', async () => {
    const { service, state } = recoveryService();

    const result: any = await service.resetToTemporaryCredential(
      'user-1',
      moroccanCinTemporaryCredential('AB123456'),
    );

    expect(state.created).toHaveLength(0);
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });
});

describe('administrative password reset for one selected account', () => {
  test('sends to the address read from that account and reports delivery', async () => {
    const { service, state } = recoveryService();

    const result = await service.sendPasswordReset('user-1');

    expect(result).toEqual({ userId: 'user-1', emailSent: true, undeliveredLinkLive: false });
    expect(state.minted).toEqual([{ type: 'reset', userId: 'user-1' }]);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toBe('fatima@example.ma');
    expect(state.sent[0].html).toContain('reset-token-for-user-1');
    expect(state.discarded).toHaveLength(0);
  });

  test('it changes no account state and revokes no session', async () => {
    const { service, state } = recoveryService();

    await service.sendPasswordReset('user-1');

    expect(state.updates).toHaveLength(0);
    expect(state.marked).toHaveLength(0);
    expect(state.revoked).toHaveLength(0);
    expect(state.invalidated).toHaveLength(0);
  });

  test('a provider that reports failure is reported as failure, and the link is discarded', async () => {
    const { service, state } = recoveryService({ send: async () => ({ success: false }) });

    const result = await service.sendPasswordReset('user-1');

    expect(result).toEqual({ userId: 'user-1', emailSent: false, undeliveredLinkLive: false });
    expect(state.discarded).toEqual([{ userId: 'user-1', jti: 'jti-1' }]);
  });

  test('a provider that throws is reported as failure, not as success', async () => {
    const { service, state } = recoveryService({
      send: async () => { throw new Error('smtp unreachable'); },
    });

    const result = await service.sendPasswordReset('user-1');

    expect(result).toEqual({ userId: 'user-1', emailSent: false, undeliveredLinkLive: false });
    expect(state.discarded).toEqual([{ userId: 'user-1', jti: 'jti-1' }]);
  });

  test('a discard that itself fails reports the link it could not retire', async () => {
    // The mail did not leave and the token store was unreachable, so the jti it
    // holds is still this one: a usable link exists that nobody received. The
    // delivery answer stays truthful, and so does this one.
    const { service } = recoveryService({
      send: async () => ({ success: false }),
      discard: async () => { throw new Error('cache unavailable'); },
    });

    expect(await service.sendPasswordReset('user-1')).toEqual({
      userId: 'user-1',
      emailSent: false,
      undeliveredLinkLive: true,
    });
  });

  test('a link a newer mint already superseded is not reported as live', async () => {
    // Compare-and-delete answers false when the stored jti is no longer ours.
    // That link cannot be consumed either way, so nothing is stranded.
    const { service } = recoveryService({
      send: async () => ({ success: false }),
      discard: async () => false,
    });

    expect(await service.sendPasswordReset('user-1')).toEqual({
      userId: 'user-1',
      emailSent: false,
      undeliveredLinkLive: false,
    });
  });

  test('an account with no address is refused rather than mailed nowhere', async () => {
    const { service, state } = recoveryService({ account: { ...ACCOUNT, email: '   ' } });

    await expect(service.sendPasswordReset('user-1')).rejects.toMatchObject({ status: 409 });
    expect(state.minted).toHaveLength(0);
    expect(state.sent).toHaveLength(0);
  });

  test('an unknown account is a not-found, not a silent success', async () => {
    const { service, state } = recoveryService({ account: null });

    await expect(service.sendPasswordReset('ghost')).rejects.toMatchObject({ status: 404 });
    expect(state.sent).toHaveLength(0);
  });

  test('the result carries no token and no link', async () => {
    const { service } = recoveryService();

    const result = await service.sendPasswordReset('user-1');

    expect(JSON.stringify(result)).not.toMatch(/token|http/i);
  });
});

describe('re-inviting an account that is still pending', () => {
  const PENDING = { ...ACCOUNT, status: 'pending', emailVerified: false, role: 'sponsor' };

  test('mints a fresh invite for the same account without creating a second one', async () => {
    const { service, state } = recoveryService({ account: PENDING });

    const result = await service.resendInvitation('user-1');

    expect(result).toEqual({ userId: 'user-1', emailSent: true, undeliveredLinkLive: false });
    expect(state.created).toHaveLength(0);
    expect(state.minted).toEqual([{ type: 'invite', userId: 'user-1' }]);
    expect(state.sent[0].to).toBe('fatima@example.ma');
    expect(state.sent[0].html).toContain('invite-token-for-user-1');
  });

  test('it leaves status and verification exactly as they were', async () => {
    const { service, state } = recoveryService({ account: PENDING });

    await service.resendInvitation('user-1');

    expect(state.updates).toHaveLength(0);
    expect(state.revoked).toHaveLength(0);
  });

  test('an active account is refused — it is reset, not re-invited', async () => {
    const { service, state } = recoveryService();

    await expect(service.resendInvitation('user-1')).rejects.toMatchObject({ status: 409 });
    expect(state.minted).toHaveLength(0);
    expect(state.sent).toHaveLength(0);
  });

  test('an inactive account is refused', async () => {
    const { service, state } = recoveryService({ account: { ...ACCOUNT, status: 'inactive' } });

    await expect(service.resendInvitation('user-1')).rejects.toMatchObject({ status: 409 });
    expect(state.minted).toHaveLength(0);
  });

  test('a failed send is reported as failure and discards the fresh invite', async () => {
    const { service, state } = recoveryService({
      account: PENDING,
      send: async () => ({ success: false }),
    });

    expect(await service.resendInvitation('user-1')).toEqual({
      userId: 'user-1',
      emailSent: false,
      undeliveredLinkLive: false,
    });
    expect(state.discarded).toEqual([{ userId: 'user-1', jti: 'jti-1' }]);
  });

  test('an invite whose discard fails reports the link it could not retire', async () => {
    const { service } = recoveryService({
      account: PENDING,
      send: async () => ({ success: false }),
      discard: async () => { throw new Error('cache unavailable'); },
    });

    expect(await service.resendInvitation('user-1')).toEqual({
      userId: 'user-1',
      emailSent: false,
      undeliveredLinkLive: true,
    });
  });

  test('repeated sends mint a new link each time', async () => {
    const { service, state } = recoveryService({ account: PENDING });

    await service.resendInvitation('user-1');
    await service.resendInvitation('user-1');

    expect(state.minted).toHaveLength(2);
    expect(state.created).toHaveLength(0);
  });
});

describe('one-time set-password tokens', () => {
  function tokenService(cache: Record<string, unknown>) {
    const service = new TokenService({} as never, {} as never, cache as never);
    (service as any).config = {
      jwt: { refreshSecret: 'refresh-secret-value-at-least-32-characters' },
    };
    (service as any).t = (key: string) => key;
    return service;
  }

  function memoryCache() {
    const store = new Map<string, string>();
    return {
      store,
      set: async (key: string, value: string) => { store.set(key, value); },
      get: async (key: string) => store.get(key) ?? null,
      compareAndDelete: async (key: string, expected: string) => {
        if (store.get(key) !== expected) return false;
        store.delete(key);
        return true;
      },
    };
  }

  test('a minted token is identified by its own jti', async () => {
    const cache = memoryCache();
    const service = tokenService(cache);

    const reset = await service.generateResetToken('user-1');
    expect(reset.jti).toBeString();
    expect(cache.store.get('auth:reset:user-1')).toBe(reset.jti);

    const invite = await service.generateInviteToken('user-1');
    expect(invite.jti).not.toBe(reset.jti);
    // One live link per user: the newer mint supersedes the older one.
    expect(cache.store.get('auth:reset:user-1')).toBe(invite.jti);
  });

  test('a superseded link no longer consumes', async () => {
    const cache = memoryCache();
    const service = tokenService(cache);

    const first = await service.generateResetToken('user-1');
    const second = await service.generateResetToken('user-1');

    await expect(service.consumeSetPasswordToken(first.token)).rejects.toBeDefined();
    expect(await service.consumeSetPasswordToken(second.token)).toMatchObject({
      userId: 'user-1',
      type: 'reset',
    });
  });

  test('discarding removes exactly the token that was minted', async () => {
    const cache = memoryCache();
    const service = tokenService(cache);

    const minted = await service.generateResetToken('user-1');
    expect(await service.discardSetPasswordToken('user-1', minted.jti)).toBe(true);
    expect(cache.store.has('auth:reset:user-1')).toBe(false);
    await expect(service.consumeSetPasswordToken(minted.token)).rejects.toBeDefined();
  });

  test('a late discard never kills a newer link', async () => {
    const cache = memoryCache();
    const service = tokenService(cache);

    const stale = await service.generateResetToken('user-1');
    const current = await service.generateResetToken('user-1');

    expect(await service.discardSetPasswordToken('user-1', stale.jti)).toBe(false);
    expect(await service.consumeSetPasswordToken(current.token)).toMatchObject({
      userId: 'user-1',
    });
  });

  test('a cache without atomic consumption refuses to discard rather than pretend', async () => {
    const service = tokenService({ set: async () => { }, get: async () => null });

    await expect(service.discardSetPasswordToken('user-1', 'jti-1')).rejects.toBeDefined();
  });
});
