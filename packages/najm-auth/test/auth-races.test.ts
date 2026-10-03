import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';
import { AuthSessionService } from '../src/auth/AuthSessionService';
import { UserValidator } from '../src/users/UserValidator';
import { harness } from './helpers/securityHarness';

function barrier() {
  let arrive!: () => void;
  let resume!: () => void;
  const reached = new Promise<void>(r => { arrive = r; });
  const released = new Promise<void>(r => { resume = r; });
  return { reached, released, arrive, resume };
}

test('claim reads paused across permission removal cannot acquire its new version', async () => {
  const h = await harness();
  const gate = barrier();
  const read = h.tokenRecords.getRoleAndPermissions.bind(h.tokenRecords);
  h.tokenRecords.getRoleAndPermissions = async userId => {
    const claims = await read(userId);
    gate.arrive();
    await gate.released;
    return claims;
  };
  const pending = h.signIn().then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.permissions.removePermissionFromRole('editor', 'write');
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 401 } });
  expect(await h.permissionRecords.getPermissionsByRole('editor')).toEqual([]);
});

test('permission deletion includes roles granted after an earlier holder lookup', async () => {
  const h = await harness();
  const gate = barrier();
  const remove = h.permissionRecords.deleteWithRoles.bind(h.permissionRecords);
  h.permissionRecords.deleteWithRoles = async id => {
    // An earlier observer must never decide the invalidation set. Pause
    // before the transaction while another role obtains and uses the grant.
    await h.permissionRecords.getRolesByPermission(id);
    gate.arrive();
    await gate.released;
    return remove(id);
  };
  const pending = h.permissions.delete('write');
  await gate.reached;
  await h.permissions.assignPermissionToRole('reader', 'write');
  const stale = await h.signIn('two');
  gate.resume();
  await pending;
  await expect(h.tokens.verifyAccessToken(stale.accessToken)).rejects.toMatchObject({ status: 401 });
  expect(await h.resolver.resolveFromSessionCookie()).toBe(false);
});

for (const field of ['phone', 'email'] as const) {
  test(`concurrent ${field} updates return a conflict for the losing write`, async () => {
    const h = await harness();
    const gate = barrier();
    let reads = 0;
    const method = field === 'phone' ? 'findByPhone' : 'getByEmailInsensitive';
    const read = h.userRecords[method].bind(h.userRecords);
    h.userRecords[method] = async value => {
      const existing = await read(value);
      if (++reads === 2) gate.arrive();
      await gate.released;
      return existing as any;
    };
    const data = field === 'phone' ? { phone: '+212612345678' } : { email: 'new@example.test' };
    const pending = Promise.allSettled([h.users.update('one', data), h.users.update('two', data)]);
    await gate.reached;
    gate.resume();
    const results = await pending;
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  });
}

for (const mutation of ['password', 'status'] as const) {
  test(`login paused at password verification cannot outlive a ${mutation} change`, async () => {
    const h = await harness();
    await h.userRecords.update('one', { password: await h.encryption.hashPassword('OldPass123') });
    const gate = barrier();
    const compare = h.validator.comparePassword.bind(h.validator);
    h.validator.comparePassword = async (plain, hash) => {
      const valid = await compare(plain, hash);
      gate.arrive();
      await gate.released;
      return valid;
    };
    const auth = new AuthService(h.tokens, h.users, h.validator, h.encryption,
      h.cookies as never, {} as never, {} as never);
    Object.assign(auth, { config: h.config, t: (key: string) => key });
    const pending = auth.loginUser({ email: 'one@example.test', password: 'OldPass123' })
      .then(value => ({ value }), error => ({ error }));
    await gate.reached;
    await h.users.update('one', mutation === 'password'
      ? { password: 'NewPass456' } : { status: 'inactive' });
    gate.resume();
    expect(await pending).toMatchObject({ error: { status: mutation === 'status' ? 403 : 401 } });
    expect(h.jar.snapshot).toBeNull();
    expect(h.jar.refresh).toBeUndefined();
  });
}

test('a fresh family stored after password invalidation is withdrawn durably', async () => {
  const h = await harness();
  const gate = barrier();
  const store = h.tokenRecords.storeRefreshToken.bind(h.tokenRecords);
  let family = '';
  h.tokenRecords.storeRefreshToken = async data => {
    family = data.tokenFamily;
    gate.arrive();
    await gate.released;
    return store(data);
  };
  const pending = h.tokens.generateTokens('one').then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { password: 'NewPass456' });
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 401 } });
  expect(await h.tokenRecords.getByFamily(family)).toBeNull();
  expect(await h.invalidation.familyStatus(family, 'one')).toBe('revoked');
  // Cache loss must not expose a live refresh row from the refused attempt.
  await h.cache.flush();
  expect(await h.tokenRecords.getByFamily(family)).toBeNull();
});

test('session recovery cannot stamp an old principal with a newer version', async () => {
  const h = await harness();
  const old = await h.signIn();
  h.jar.refresh = old.refreshToken;
  const gate = barrier();
  const read = h.tokenRecords.getUser.bind(h.tokenRecords);
  h.tokenRecords.getUser = async id => {
    const user = await read(id);
    gate.arrive();
    await gate.released;
    return user;
  };
  const pending = h.tokens.recoverSessionFromCookie().then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.permissions.removePermissionFromRole('editor', 'write');
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 401 } });
});

test('a paused user-cache fill cannot repopulate the current principal after a role change', async () => {
  const h = await harness();
  const gate = barrier();
  const read = h.tokenRecords.getUser.bind(h.tokenRecords);
  h.tokenRecords.getUser = async id => {
    const user = await read(id);
    gate.arrive();
    await gate.released;
    return user;
  };
  const pending = h.tokens.getUserById('one').then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { roleId: 'reader' });
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 401 } });
  h.tokenRecords.getUser = read;
  expect(await h.tokens.getUserById('one')).toMatchObject({ role: 'reader', permissions: ['orders:read'] });
});

test('deactivation during the last-login write sets no new cookies', async () => {
  const h = await harness();
  const gate = barrier();
  const update = h.users.updateLastLogin.bind(h.users);
  h.users.updateLastLogin = async id => {
    await update(id);
    gate.arrive();
    await gate.released;
  };
  const sessions = new AuthSessionService(h.tokens, h.users, h.cookies as never);
  const pending = sessions.establish(await h.users.getById('one'))
    .then(value => ({ value }), error => ({ error }));
  await gate.reached;
  await h.users.update('one', { status: 'inactive' });
  gate.resume();
  expect(await pending).toMatchObject({ error: { status: 401 } });
  expect(h.jar.refresh).toBeUndefined();
  expect(h.jar.snapshot).toBeNull();
});

test('wrapped PostgreSQL unique violations map to 409 and unrelated errors propagate', async () => {
  const validator = new UserValidator({} as never, {} as never);
  const conflict = new Error('Drizzle query failed', { cause: Object.assign(new Error('duplicate key'), { code: '23505' }) });
  await expect(validator.writeUnique(async () => { throw conflict; })).rejects.toMatchObject({ status: 409 });
  const unavailable = Object.assign(new Error('database unavailable'), { code: '08006' });
  await expect(validator.writeUnique(async () => { throw unavailable; })).rejects.toBe(unavailable);
});

for (const mutation of ['rename', 'deleteAll'] as const) {
  test(`permission ${mutation} includes grants committed before the catalog transaction`, async () => {
    const h = await harness();
    const gate = barrier();
    if (mutation === 'rename') {
      const update = h.permissionRecords.updateWithRoles.bind(h.permissionRecords);
      h.permissionRecords.updateWithRoles = async (id, data) => {
        gate.arrive();
        await gate.released;
        return update(id, data);
      };
    } else {
      const remove = h.permissionRecords.deleteAllWithRoles.bind(h.permissionRecords);
      h.permissionRecords.deleteAllWithRoles = async () => {
        gate.arrive();
        await gate.released;
        return remove();
      };
    }
    const pending = mutation === 'rename'
      ? h.permissions.update('write', { name: 'orders:archive' }) : h.permissions.deleteAll();
    await gate.reached;
    await h.permissions.assignPermissionToRole('reader', 'write');
    const old = await h.signIn('two');
    gate.resume();
    await pending;
    await expect(h.tokens.verifyAccessToken(old.accessToken)).rejects.toMatchObject({ status: 401 });
    expect(await h.resolver.resolveFromSessionCookie()).toBe(false);
  });
}

test('a failed catalog transaction preserves grants and live credentials', async () => {
  const h = await harness();
  const old = await h.signIn();
  await expect(h.permissions.update('write', { action: null })).rejects.toThrow();
  expect(await h.permissionRecords.getById('write')).toMatchObject({ action: 'write' });
  expect((await h.permissionRecords.getPermissionsByRole('editor')).map(p => p.name)).toEqual(['orders:write']);
  await expect(h.tokens.verifyAccessToken(old.accessToken)).resolves.toBeDefined();
});

test('concurrent registrations return one user and one conflict', async () => {
  const h = await harness();
  const gate = barrier();
  let reads = 0;
  const read = h.userRecords.getByEmailInsensitive.bind(h.userRecords);
  h.userRecords.getByEmailInsensitive = async email => {
    const user = await read(email);
    if (++reads === 2) gate.arrive();
    await gate.released;
    return user;
  };
  const pending = Promise.allSettled([
    h.users.create({ email: 'new@example.test', password: 'NewPass456' }),
    h.users.create({ email: 'NEW@example.test', password: 'NewPass789' }),
  ]);
  await gate.reached;
  gate.resume();
  const results = await pending;
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
});

for (const path of ['rotation', 'grace'] as const) {
  test(`refresh ${path} paused across a permission removal cannot return stale claims`, async () => {
    const h = await harness();
    const original = await h.signIn();
    h.jar.refresh = original.refreshToken;
    if (path === 'grace') await h.tokens.refreshTokens();
    const gate = barrier();
    const read = h.tokenRecords.getRoleAndPermissions.bind(h.tokenRecords);
    h.tokenRecords.getRoleAndPermissions = async id => {
      const claims = await read(id);
      gate.arrive();
      await gate.released;
      return claims;
    };
    const pending = h.tokens.refreshTokens().then(value => ({ value }), error => ({ error }));
    await gate.reached;
    await h.permissions.removePermissionFromRole('editor', 'write');
    gate.resume();
    expect(await pending).toMatchObject({ error: { status: 401 } });
    // An authorization-catalog change still preserves a legitimate refresh
    // family; the next attempt can obtain its current reduced permissions.
    h.tokenRecords.getRoleAndPermissions = read;
    expect((await h.tokens.recoverSessionFromCookie()).permissions).toEqual([]);
  });
}
