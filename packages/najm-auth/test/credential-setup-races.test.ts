import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { CredentialSetupRepository } from '../src/credentialSetup/CredentialSetupRepository';
import { CredentialSetupService } from '../src/credentialSetup/CredentialSetupService';
import { CredentialSetupRequirementRepository } from '../src/credentialSetup/CredentialSetupRequirementRepository';
import { CredentialSetupRequirementService } from '../src/credentialSetup/CredentialSetupRequirementService';
import { PasswordSetupService } from '../src/credentialSetup/PasswordSetupService';
import { authSchema } from '../src/schema/sqlite';
import { harness } from './helpers/securityHarness';

async function setupHarness() {
  const h = await harness();
  await h.users.update('one', { password: 'TemporaryPass123' });
  const sessions = new CredentialSetupRepository();
  const requirementRecords = new CredentialSetupRequirementRepository();
  for (const repository of [sessions, requirementRecords]) Object.assign(repository, { db: h.db, schema: authSchema });
  const requirements = new CredentialSetupRequirementService(requirementRecords, h.tokens);
  await requirements.markRequired('one', 'password');
  let cookie: string | undefined;
  const setup = new CredentialSetupService(sessions, h.tokens, h.cookies as never, {
    get: () => cookie, setSession: (_name: string, value: string) => { cookie = value; },
    delete: () => { cookie = undefined; },
  } as never, h.userRecords);
  Object.assign(setup, { config: h.config });
  const passwords = new PasswordSetupService(setup, requirements, h.users, h.userRecords, h.validator, h.encryption);
  Object.assign(passwords, { config: h.config });
  await passwords.begin('one');
  return { ...h, passwords, requirements };
}

for (const field of ['password', 'status', 'email'] as const) {
  test(`a password-setup cookie cannot survive a subsequent ${field} replacement`, async () => {
    const h = await setupHarness();
    await h.users.update('one', field === 'password' ? { password: 'LatestTemporary456' }
      : field === 'status' ? { status: 'inactive' } : { email: 'new-owner@example.test' });
    await expect(h.passwords.change('DelayedPassword789')).rejects.toBeDefined();
    expect(await h.requirements.isRequired('one', 'password')).toBe(true);
    const user = await h.userRecords.getRawById('one');
    expect(await h.encryption.comparePassword('DelayedPassword789', user!.password)).toBe(false);
  });
}

test('password setup paused during hashing cannot overwrite an administrative replacement', async () => {
  const h = await setupHarness();
  let arrive!: () => void;
  let resume!: () => void;
  const reached = new Promise<void>(resolve => { arrive = resolve; });
  const released = new Promise<void>(resolve => { resume = resolve; });
  const hash = h.encryption.hashPassword.bind(h.encryption);
  h.encryption.hashPassword = async plain => {
    const result = await hash(plain);
    if (plain === 'DelayedPassword789') { arrive(); await released; }
    return result;
  };
  const pending = h.passwords.change('DelayedPassword789').then(value => ({ value }), error => ({ error }));
  await reached;
  await h.users.update('one', { password: 'LatestTemporary456' });
  resume();
  expect(await pending).toHaveProperty('error');
  const user = await h.userRecords.getRawById('one');
  expect(await h.encryption.comparePassword('LatestTemporary456', user!.password)).toBe(true);
  expect(await h.requirements.isRequired('one', 'password')).toBe(true);
});

test('an unchanged password-setup credential completes once without exposing a hash', async () => {
  const h = await setupHarness();
  expect(await h.passwords.change('PermanentPassword789')).toEqual({ changed: true, signInAgain: true });
  expect(await h.requirements.isRequired('one', 'password')).toBe(false);
  const user = await h.userRecords.getRawById('one');
  expect(await h.encryption.comparePassword('PermanentPassword789', user!.password)).toBe(true);
  await expect(h.passwords.change('AnotherPassword123')).rejects.toBeDefined();
});
