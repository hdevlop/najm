import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';
import jwt from 'jsonwebtoken';
import { harness } from './helpers/securityHarness';

function barrier() {
  let arrive!: () => void;
  let resume!: () => void;
  const reached = new Promise<void>(resolve => { arrive = resolve; });
  const released = new Promise<void>(resolve => { resume = resolve; });
  return { arrive, resume, reached, released };
}

function authFor(h: Awaited<ReturnType<typeof harness>>) {
  const auth = new AuthService(h.tokens, h.users, h.validator, h.encryption,
    h.cookies as never, {} as never, {} as never);
  Object.assign(auth, { config: h.config, t: (key: string) => key });
  return auth;
}

for (const pause of ['comparison', 'hashing'] as const) {
  test(`a password change paused during ${pause} cannot overwrite a later credential replacement`, async () => {
    const h = await harness();
    await h.users.update('one', { password: 'OldPassword123' });
    const auth = authFor(h);
    const gate = barrier();
    if (pause === 'comparison') {
      const compare = h.validator.comparePassword.bind(h.validator);
      h.validator.comparePassword = async (plain, hash) => {
        const valid = await compare(plain, hash);
        gate.arrive();
        await gate.released;
        return valid;
      };
    } else {
      const hash = h.encryption.hashPassword.bind(h.encryption);
      h.encryption.hashPassword = async plain => {
        const result = await hash(plain);
        if (plain === 'DelayedPassword456') {
          gate.arrive();
          await gate.released;
        }
        return result;
      };
    }
    const pending = auth.changePassword('one', 'OldPassword123', 'DelayedPassword456')
      .then(value => ({ value }), error => ({ error }));
    await gate.reached;
    await h.users.update('one', { password: 'AuthoritativePassword789' });
    gate.resume();
    expect(await pending).toHaveProperty('error');
    const user = await h.userRecords.getRawById('one');
    expect(await h.encryption.comparePassword('AuthoritativePassword789', user!.password)).toBe(true);
  });
}

for (const type of ['reset', 'invite'] as const) {
  test(`a ${type} paused during hashing cannot overwrite a later credential or status change`, async () => {
    const h = await harness();
    await h.users.update('one', { password: 'OldPassword123', status: type === 'invite' ? 'pending' : 'active' });
    const auth = authFor(h);
    const { token } = type === 'invite'
      ? await h.tokens.generateInviteToken('one') : await h.tokens.generateResetToken('one');
    const gate = barrier();
    const hash = h.encryption.hashPassword.bind(h.encryption);
    h.encryption.hashPassword = async plain => {
      const result = await hash(plain);
      if (plain === 'DelayedPassword456') { gate.arrive(); await gate.released; }
      return result;
    };
    const pending = auth.resetPassword(token, 'DelayedPassword456')
      .then(value => ({ value }), error => ({ error }));
    await gate.reached;
    await h.users.update('one', { password: 'AuthoritativePassword789', status: 'inactive' });
    gate.resume();
    expect(await pending).toHaveProperty('error');
    const user = await h.userRecords.getRawById('one');
    expect(user!.status).toBe('inactive');
    expect(await h.encryption.comparePassword('AuthoritativePassword789', user!.password)).toBe(true);
  });
}

for (const field of ['email', 'password', 'status', 'emailVerified'] as const) {
  test(`a password-reset link issued before a ${field} change cannot replace current credentials`, async () => {
    const h = await harness();
    await h.users.update('one', { password: 'OldPassword123' });
    const { token } = await h.tokens.generateResetToken('one');
    const data = field === 'email' ? { email: 'new-owner@example.test' }
      : field === 'password' ? { password: 'AuthoritativePassword789' }
      : field === 'status' ? { status: 'inactive' } : { emailVerified: true };
    await h.users.update('one', data);
    await expect(authFor(h).resetPassword(token, 'DelayedPassword456')).rejects.toBeDefined();
    const user = await h.userRecords.getRawById('one');
    expect(await h.encryption.comparePassword('DelayedPassword456', user!.password)).toBe(false);
  });
}

test('a reset-mail request cannot mint a valid link for an address replaced before issuance', async () => {
  const h = await harness();
  await h.users.update('one', { password: 'OldPassword123' });
  const delivered: string[] = [];
  const auth = authFor(h);
  Object.assign(auth, { emailService: { sendHtml: async (to: string) => {
    delivered.push(to);
    return { success: true };
  } } });
  const gate = barrier();
  const generate = h.tokens.generateResetToken.bind(h.tokens);
  h.tokens.generateResetToken = async (...args) => {
    gate.arrive();
    await gate.released;
    return generate(...args);
  };
  const pending = auth.sendPasswordReset('one').then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { email: 'new-owner@example.test' });
  gate.resume();
  expect(await pending).toHaveProperty('error');
  expect(delivered).toEqual([]);
});

test('reset-token issuance crossing a credential change withdraws its cached token', async () => {
  const h = await harness();
  const gate = barrier();
  const set = h.cache.set.bind(h.cache);
  h.cache.set = async (...args) => {
    const result = await set(...args);
    if (args[0] === 'auth:reset:one') { gate.arrive(); await gate.released; }
    return result;
  };
  const pending = h.tokens.generateResetToken('one').then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { email: 'new-owner@example.test' });
  gate.resume();
  expect(await pending).toHaveProperty('error');
  expect(await h.cache.get('auth:reset:one')).toBeNull();
});

test('forgot-password retains its generic response when the recipient changes during issuance', async () => {
  const h = await harness();
  const delivered: string[] = [];
  const auth = authFor(h);
  Object.assign(auth, {
    logger: { warn() {} },
    emailService: { sendHtml: async (to: string) => { delivered.push(to); } },
  });
  const gate = barrier();
  const generate = h.tokens.generateResetToken.bind(h.tokens);
  h.tokens.generateResetToken = async (...args) => {
    gate.arrive();
    await gate.released;
    return generate(...args);
  };
  const pending = auth.forgotPassword('one@example.test');
  await gate.reached;
  await h.users.update('one', { email: 'new-owner@example.test' });
  gate.resume();
  expect(await pending).toEqual(await auth.forgotPassword('missing@example.test'));
  expect(delivered).toEqual([]);
});

for (const type of ['reset', 'invite'] as const) {
  test(`a current ${type} link completes after profile edits without exposing its password hash`, async () => {
    const h = await harness();
    await h.users.update('one', { password: 'OldPassword123', status: type === 'invite' ? 'pending' : 'active' });
    const user = await h.userRecords.getRawById('one');
    const issued = type === 'invite' ? await h.tokens.generateInviteToken('one') : await h.tokens.generateResetToken('one');
    const claims = jwt.decode(issued.token) as Record<string, unknown>;
    expect(claims.credentialState).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify(claims)).not.toContain(user!.password);
    await h.users.update('one', { name: 'Updated display name' });
    await authFor(h).resetPassword(issued.token, 'PermanentPassword789');
    const updated = await h.userRecords.getRawById('one');
    expect(await h.encryption.comparePassword('PermanentPassword789', updated!.password)).toBe(true);
    expect(updated!.status).toBe('active');
    if (type === 'invite') expect(updated!.emailVerified).toBe(true);
  });
}

test('an older reset token without a credential binding fails closed', async () => {
  const h = await harness();
  const token = jwt.sign({ userId: 'one', type: 'reset', jti: 'legacy-reset' }, h.config.jwt.refreshSecret, { expiresIn: '1h' });
  await h.cache.set('auth:reset:one', 'legacy-reset', 60_000);
  await expect(h.tokens.consumeSetPasswordToken(token)).rejects.toBeDefined();
});

test('a credential change immediately before the conditional password write wins', async () => {
  const h = await harness();
  await h.users.update('one', { password: 'OldPassword123' });
  const gate = barrier();
  const update = h.userRecords.updateWithCredential.bind(h.userRecords);
  h.userRecords.updateWithCredential = async (...args) => {
    gate.arrive();
    await gate.released;
    return update(...args);
  };
  const pending = authFor(h).changePassword('one', 'OldPassword123', 'DelayedPassword456')
    .then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { password: 'AuthoritativePassword789' });
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 409 } });
  const user = await h.userRecords.getRawById('one');
  expect(await h.encryption.comparePassword('AuthoritativePassword789', user!.password)).toBe(true);
});
