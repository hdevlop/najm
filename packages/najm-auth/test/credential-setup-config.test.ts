import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { resolveAuthConfig, selectAuthSchema } from '../src/AuthPlugin';
import { CREDENTIAL_SETUP_MODULE } from '../src/credentialSetup';
import { CredentialSetupController } from '../src/credentialSetup/CredentialSetupController';
import { CredentialSetupRequirementRepository } from '../src/credentialSetup/CredentialSetupRequirementRepository';
import { CredentialSetupRequirementService } from '../src/credentialSetup/CredentialSetupRequirementService';
import { PasswordSetupService } from '../src/credentialSetup/PasswordSetupService';
import { defaultCredentialSetupPasswordSchema } from '../src/credentialSetup/CredentialSetupDto';
import { UserService } from '../src/users/UserService';
import { authSchema as pgSchema } from '../src/schema/pg';

const jwt = { accessSecret: 'a'.repeat(32), refreshSecret: 'b'.repeat(32) };

describe('the password-setup flow is on by default', () => {
  test('no activation option exists — the module is always registered', () => {
    for (const provider of [
      CredentialSetupRequirementRepository,
      CredentialSetupRequirementService,
      PasswordSetupService,
      CredentialSetupController,
    ]) {
      expect(CREDENTIAL_SETUP_MODULE).toContain(provider);
    }
  });

  test('defaults are a ten-minute lifetime, the standard cookie, and the standard policy', () => {
    const config = resolveAuthConfig({ jwt });

    expect(config.credentialSetup.password).toMatchObject({
      ttlMs: 10 * 60 * 1_000,
      cookieName: 'najm.credential-setup',
    });
    expect(config.credentialSetup.password.passwordSchema)
      .toBe(defaultCredentialSetupPasswordSchema);
  });

  test('policy overrides change only the credential-setup branch', () => {
    const passwordSchema = z.string().min(20);
    const overridden = resolveAuthConfig({
      jwt,
      credentialSetup: { password: { ttlMs: 60_000, cookieName: 'app.setup', passwordSchema } },
    });
    const {
      credentialSetup: _defaultSetup,
      identity: defaultIdentity,
      ...defaults
    } = resolveAuthConfig({ jwt });
    const { credentialSetup: overriddenSetup, identity: overriddenIdentity, ...rest } = overridden;

    expect(overriddenSetup.password).toMatchObject({
      ttlMs: 60_000,
      cookieName: 'app.setup',
      passwordSchema,
    });
    expect(rest).toEqual(defaults);
    expect(overriddenIdentity.resolve('0612345678'))
      .toBe(defaultIdentity.resolve('0612345678'));
  });

  test('an out-of-range setup lifetime is refused at configuration time', () => {
    expect(() => resolveAuthConfig({ jwt, credentialSetup: { password: { ttlMs: 10 } } }))
      .toThrow(/ttlMs/);
  });
});

describe('custom schema validation', () => {
  test('the requirement table is part of the contract', () => {
    const { credentialSetupRequirements: _dropped, ...withoutRequirements } = pgSchema;

    expect(() => selectAuthSchema({ schema: withoutRequirements as never }))
      .toThrow(/credentialSetupRequirements is required/);
    expect(selectAuthSchema({ schema: pgSchema as never })).toBe(pgSchema);
  });

  test('both dialect defaults already carry it', () => {
    expect(selectAuthSchema().credentialSetupRequirements).toBeDefined();
    expect(selectAuthSchema({ dialect: 'sqlite' }).credentialSetupRequirements).toBeDefined();
  });
});

describe('provisioned phones match login lookup', () => {
  test('a local number is stored in its normalized E.164 form', async () => {
    const created: any[] = [];
    const service = new UserService(
      {} as never,
      {} as never,
      {
        create: async (data: any) => { created.push(data); return { id: 'user-1', ...data }; },
      } as never,
      {
        validatePasswordStrength: () => { },
        validatePasswordLength: () => { },
        checkEmailUnique: async () => { },
        checkUserIdIsUnique: async () => { },
        checkPhoneUnique: async () => { },
      } as never,
      { hashPassword: async (value: string) => `hash(${value})` } as never,
      {} as never,
      resolveAuthConfig({ jwt }),
    );

    await service.create({
      email: 'fatima@example.ma',
      phone: '06 12 34 56 78',
      password: 'ab123456',
    }, { validatePasswordStrength: false });

    expect(created[0].phone).toBe('+212612345678');
  });

  test('an unusable phone is refused rather than silently dropped', async () => {
    const service = new UserService(
      {} as never,
      {} as never,
      { create: async () => ({ id: 'user-1' }) } as never,
      {
        validatePasswordStrength: () => { },
        validatePasswordLength: () => { },
        checkEmailUnique: async () => { },
        checkUserIdIsUnique: async () => { },
        checkPhoneUnique: async () => { },
      } as never,
      { hashPassword: async () => 'hash' } as never,
      {} as never,
      resolveAuthConfig({ jwt }),
    );

    await expect(service.create({
      email: 'fatima@example.ma',
      phone: 'not-a-number',
      password: 'ab123456',
    }, { validatePasswordStrength: false })).rejects.toBeDefined();
  });

  test('an email-shaped value is never accepted as a phone', async () => {
    const service = new UserService(
      {} as never,
      {} as never,
      { create: async () => ({ id: 'user-1' }) } as never,
      {
        validatePasswordStrength: () => { },
        validatePasswordLength: () => { },
        checkEmailUnique: async () => { },
        checkUserIdIsUnique: async () => { },
        checkPhoneUnique: async () => { },
      } as never,
      { hashPassword: async () => 'hash' } as never,
      {} as never,
      resolveAuthConfig({ jwt }),
    );

    await expect(service.create({
      email: 'fatima@example.ma',
      phone: 'other@example.ma',
      password: 'ab123456',
    }, { validatePasswordStrength: false })).rejects.toBeDefined();
  });

  test('temporary credentials still obey bcrypt byte significance', async () => {
    let lengthChecked = false;
    const service = new UserService(
      {} as never,
      {} as never,
      { create: async () => ({ id: 'user-1' }) } as never,
      {
        validatePasswordStrength: () => { },
        validatePasswordLength: (value: string) => {
          lengthChecked = true;
          if (new TextEncoder().encode(value).length > 72) throw new Error('too long');
        },
        checkEmailUnique: async () => { },
        checkUserIdIsUnique: async () => { },
        checkPhoneUnique: async () => { },
      } as never,
      { hashPassword: async () => 'hash' } as never,
      {} as never,
      resolveAuthConfig({ jwt }),
    );

    await expect(service.create({
      email: 'fatima@example.ma',
      password: `a1${'x'.repeat(71)}`,
    }, { validatePasswordStrength: false })).rejects.toThrow('too long');
    expect(lengthChecked).toBe(true);
  });
});
