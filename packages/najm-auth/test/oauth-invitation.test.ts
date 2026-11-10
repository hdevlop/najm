import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { CacheService } from 'najm-cache';
import { TokenService } from '../src/tokens/TokenService';
import { OAuthService } from '../src/oauth/OAuthService';
import { resolveAuthConfig } from '../src/AuthPlugin';

/**
 * An invited account can accept its invitation by signing in with a provider
 * that has verified the invited email — but only while the invitation is the
 * account's live link. The cache is the real memory driver, as in
 * reset-token-consumption.test.ts, so consumption is decided for real.
 */

const jwt = { accessSecret: 'a'.repeat(32), refreshSecret: 'b'.repeat(32), accessExpiresIn: '1h', refreshExpiresIn: '7d' };

function tokens() {
  let password = 'fixture-hash';
  const repo = {
    getCredentialState: async (id: string) => ({
      id, email: `${id}@example.com`, password, status: 'pending', emailVerified: false,
    }),
  };
  const cache = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
  const service = new TokenService(repo as any, {} as any, cache as any);
  (service as any).config = { jwt };
  (service as any).t = (key: string) => key;
  return { service, changePassword: () => { password = 'another-hash'; } };
}

describe('accepting an invitation without its link', () => {
  test('accepts a live invitation once, and its emailed link no longer works', async () => {
    const { service } = tokens();
    const { token } = await service.generateInviteToken('teacher', 'teacher@example.com');
    expect(await service.consumeLiveInvitation('teacher')).toBe(true);
    expect(await service.consumeLiveInvitation('teacher')).toBe(false);
    await expect(service.consumeSetPasswordToken(token)).rejects.toThrow();
  });

  test('a password-reset link is not an invitation', async () => {
    const { service } = tokens();
    await service.generateResetToken('self-registered', 'self-registered@example.com');
    expect(await service.consumeLiveInvitation('self-registered')).toBe(false);
  });

  test('an invitation superseded by a newer link, or by a changed credential, is no longer live', async () => {
    const replaced = tokens();
    await replaced.service.generateInviteToken('teacher', 'teacher@example.com');
    await replaced.service.generateResetToken('teacher', 'teacher@example.com');
    expect(await replaced.service.consumeLiveInvitation('teacher')).toBe(false);

    const changed = tokens();
    await changed.service.generateInviteToken('teacher', 'teacher@example.com');
    changed.changePassword();
    expect(await changed.service.consumeLiveInvitation('teacher')).toBe(false);
  });
});

describe('provider sign-in of an invited account', () => {
  function signIn(user: { id: string; email: string; status: string }, verifiedEmail: string, liveInvitation: boolean) {
    const calls: string[] = [];
    let established: any;
    const attempt = { provider: 'google' as const, intent: 'login' as const, returnTo: '/home', createdAt: Date.now() };
    const service = new OAuthService(
      { consume: () => attempt, validateReturnTo: (value: string) => value } as any,
      { exchange: async () => ({ provider: 'google', providerAccountId: 'sub', email: verifiedEmail, emailVerified: true }) } as any,
      {} as any,
      { resolveForLogin: async () => user } as any,
      { establish: async (value: unknown) => { established = value; } } as any,
      { consumeLiveInvitation: async (id: string) => { calls.push(`consume ${id}`); return liveInvitation; } } as any,
      {
        update: async (id: string, data: object) => { calls.push(`update ${id} ${JSON.stringify(data)}`); },
        getById: async (id: string) => ({ ...user, id, status: 'active', emailVerified: true }),
      } as any,
    );
    (service as any).config = resolveAuthConfig({ jwt, oauth: { google: { clientId: 'id', clientSecret: 'secret' } } });
    (service as any).logger = { warn() { } };
    return { run: () => service.finishGoogleCallback({ code: 'code', state: 'state' }), calls, established: () => established };
  }

  test('a live invitation to the verified email activates the account and signs it in', async () => {
    const flow = signIn({ id: 'teacher', email: 'Teacher@Example.com', status: 'pending' }, 'teacher@example.com', true);
    await flow.run();
    expect(flow.calls).toEqual(['consume teacher', 'update teacher {"status":"active","emailVerified":true}']);
    expect(flow.established()).toMatchObject({ id: 'teacher', status: 'active' });
  });

  test('without a live invitation the account stays pending, for the session to refuse', async () => {
    const flow = signIn({ id: 'waiting', email: 'waiting@example.com', status: 'pending' }, 'waiting@example.com', false);
    await flow.run();
    expect(flow.calls).toEqual(['consume waiting']);
    expect(flow.established()).toMatchObject({ status: 'pending' });
  });

  test('an invitation to another email is never accepted, and an active account is left alone', async () => {
    const other = signIn({ id: 'teacher', email: 'teacher@example.com', status: 'pending' }, 'someone@example.com', true);
    await other.run();
    expect(other.calls).toEqual([]);

    const active = signIn({ id: 'teacher', email: 'teacher@example.com', status: 'active' }, 'teacher@example.com', true);
    await active.run();
    expect(active.calls).toEqual([]);
  });
});
