import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';
import { AuthSessionService } from '../src/auth/AuthSessionService';
import { OAuthService } from '../src/oauth/OAuthService';
import { PasswordSetupService } from '../src/credentialSetup/PasswordSetupService';
import { defaultCredentialSetupPasswordSchema } from '../src/credentialSetup/CredentialSetupDto';
import { moroccanCinTemporaryCredential } from '../src/identity/ma';

const FAMILY = {
  id: 'user-1',
  email: 'fatima@example.ma',
  password: 'hash(ab123456)',
  status: 'active',
  emailVerified: true,
  role: 'family',
  failedLoginAttempts: 0,
  lockoutUntil: null,
};

const REQUIREMENT = {
  userId: 'user-1',
  purpose: 'password',
  temporaryCredentialKind: 'ma-cin',
  required: true,
  completedAt: null,
};

/**
 * Wires AuthService against fakes, mirroring the DI graph: the comparison is
 * recorded so tests can assert exactly which credential reached bcrypt.
 */
function authService(options: {
  user?: Record<string, unknown> | undefined;
  requirement?: Record<string, unknown> | undefined;
  storedCredential?: string;
} = {}) {
  const user = 'user' in options ? options.user : FAMILY;
  const compared: string[] = [];
  const established: unknown[] = [];
  const setupBegun: string[] = [];
  const requirementLookups: string[] = [];
  const storedCredential = options.storedCredential ?? 'ab123456';

  const userService = {
    findByEmailInsensitive: async () => user,
    findByEmail: async () => user,
    findByPhone: async () => undefined,
    resetFailedAttempts: async () => undefined,
    incrementFailedAttempts: async () => 1,
    setLockout: async () => undefined,
  };

  const service = new AuthService(
    {} as never,
    userService as never,
    {
      comparePassword: async (candidate: string, hash: string) => {
        compared.push(candidate);
        return hash === `hash(${storedCredential})` && candidate === storedCredential;
      },
    } as never,
    { hashPassword: async () => 'hash(dummy)' } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      establish: async (sessionUser: unknown) => {
        established.push(sessionUser);
        return { accessToken: 'access', refreshToken: 'refresh', user: sessionUser };
      },
    } as never,
    {
      find: async (userId: string) => {
        requirementLookups.push(userId);
        return options.requirement;
      },
    } as never,
    {
      begin: async (userId: string) => {
        setupBegun.push(userId);
        return {
          nextStep: 'credential_setup' as const,
          setupRequired: true as const,
          purpose: 'password',
          expiresAt: '2026-08-08T00:10:00.000Z',
        };
      },
    } as never,
  );

  (service as any).config = {
    lockout: { maxAttempts: 5, duration: '15m' },
    requireVerifiedEmail: false,
  };
  (service as any).t = (key: string) => key;
  (service as any).logger = { error() { }, warn() { } };

  return { service, compared, established, setupBegun, requirementLookups };
}

describe('login with an outstanding password requirement', () => {
  test('returns a setup step and no usable tokens', async () => {
    const { service, established, setupBegun } = authService({ requirement: REQUIREMENT });

    const result = await service.loginUser({ identifier: 'fatima@example.ma', password: 'ab123456' });

    expect(result).toEqual({
      nextStep: 'credential_setup',
      setupRequired: true,
      purpose: 'password',
      expiresAt: '2026-08-08T00:10:00.000Z',
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(established).toHaveLength(0);
    expect(setupBegun).toEqual(['user-1']);
  });

  test('accepts either case of the temporary CIN', async () => {
    for (const typed of ['AB123456', 'ab123456', '  Ab123456  ']) {
      const { service, compared, setupBegun } = authService({ requirement: REQUIREMENT });
      await service.loginUser({ identifier: 'fatima@example.ma', password: typed });
      expect(compared).toEqual(['ab123456']);
      expect(setupBegun).toEqual(['user-1']);
    }
  });

  test('a user-chosen password is still compared byte-for-byte', async () => {
    const { service, compared, established } = authService({
      user: { ...FAMILY, password: 'hash(fatima2026)' },
      storedCredential: 'fatima2026',
    });

    await service.loginUser({ identifier: 'fatima@example.ma', password: 'fatima2026' });
    expect(compared).toEqual(['fatima2026']);
    expect(established).toHaveLength(1);

    const uppercase = authService({
      user: { ...FAMILY, password: 'hash(fatima2026)' },
      storedCredential: 'fatima2026',
    });
    await expect(uppercase.service.loginUser({
      identifier: 'fatima@example.ma',
      password: 'Fatima2026',
    })).rejects.toBeDefined();
    expect(uppercase.compared).toEqual(['Fatima2026']);
  });

  test('CIN normalization applies only while the requirement is active', async () => {
    const { service, compared } = authService({
      requirement: undefined,
      user: { ...FAMILY, password: 'hash(AB123456)' },
      storedCredential: 'AB123456',
    });

    await service.loginUser({ identifier: 'fatima@example.ma', password: 'AB123456' });
    expect(compared).toEqual(['AB123456']);
  });

  test('the requirement is looked up even for an unknown identifier', async () => {
    const { service, requirementLookups, setupBegun } = authService({
      user: undefined,
      requirement: undefined,
    });

    await expect(service.loginUser({
      identifier: 'nobody@example.ma',
      password: 'ab123456',
    })).rejects.toBeDefined();
    expect(requirementLookups).toEqual(['']);
    expect(setupBegun).toHaveLength(0);
  });

  test('invalid credentials reveal no requirement', async () => {
    const { service, established, setupBegun } = authService({ requirement: REQUIREMENT });

    await expect(service.loginUser({
      identifier: 'fatima@example.ma',
      password: 'wrong-credential',
    })).rejects.toMatchObject({ message: 'errors.invalidCredentials' });
    expect(established).toHaveLength(0);
    expect(setupBegun).toHaveLength(0);
  });

  test('an inactive account is refused before any setup session starts', async () => {
    const { service, setupBegun } = authService({
      user: { ...FAMILY, status: 'inactive' },
      requirement: REQUIREMENT,
    });

    await expect(service.loginUser({
      identifier: 'fatima@example.ma',
      password: 'ab123456',
    })).rejects.toMatchObject({ message: 'errors.accountInactive' });
    expect(setupBegun).toHaveLength(0);
  });

  test('an unresolvable stored kind fails closed rather than falling back', async () => {
    const { service, compared, setupBegun } = authService({
      requirement: { ...REQUIREMENT, temporaryCredentialKind: 'removed-in-a-downgrade' },
    });

    await expect(service.loginUser({
      identifier: 'fatima@example.ma',
      password: 'ab123456',
    })).rejects.toMatchObject({ message: 'errors.invalidCredentials' });
    // Compared against the dummy hash, never against a different normalizer.
    expect(compared).toEqual(['ab123456']);
    expect(setupBegun).toHaveLength(0);
  });
});

describe('provisioning with a required password setup', () => {
  function provisioningService() {
    const created: any[] = [];
    const createOptions: any[] = [];
    const marked: any[] = [];

    const service = new AuthService(
      {} as never,
      {
        create: async (data: any, options: any) => {
          created.push(data);
          createOptions.push(options);
          return { id: 'user-1', email: data.email };
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        markRequired: async (userId: string, purpose: string, options: any) => {
          marked.push({ userId, purpose, ...options });
          return { userId, purpose, required: true };
        },
      } as never,
      {} as never,
    );
    (service as any).t = (key: string) => key;
    (service as any).logger = { error() { }, warn() { } };
    return { service, created, createOptions, marked };
  }

  test('normalizes and hashes the CIN, records the kind, and skips strength rules', async () => {
    const { service, created, createOptions, marked } = provisioningService();

    await service.provisionUser({
      email: 'fatima@example.ma',
      phone: '0612345678',
      role: 'family',
      temporaryCredential: moroccanCinTemporaryCredential('AB123456'),
      requireCredentialSetup: 'password',
    });

    expect(created[0]).toMatchObject({
      email: 'fatima@example.ma',
      phone: '0612345678',
      role: 'family',
      password: 'ab123456',
      status: 'active',
    });
    expect(createOptions[0]).toEqual({ validatePasswordStrength: false });
    expect(marked).toEqual([{
      userId: 'user-1',
      purpose: 'password',
      temporaryCredentialKind: 'ma-cin',
    }]);
  });

  test('a plain string temporary credential stays exact and case-sensitive', async () => {
    const { service, created, marked } = provisioningService();

    await service.provisionUser({
      email: 'student@example.test',
      role: 'student',
      temporaryCredential: 'REG-2026-0042',
      requireCredentialSetup: 'password',
    });

    expect(created[0].password).toBe('REG-2026-0042');
    expect(marked[0].temporaryCredentialKind).toBe('exact');
  });

  test('a structured ma-cin value is validated even without the public helper', async () => {
    const { service, created, marked } = provisioningService();

    await expect(service.provisionUser({
      email: 'student@example.test',
      temporaryCredential: { kind: 'ma-cin', value: 'not-a-cin' },
      requireCredentialSetup: 'password',
    })).rejects.toBeDefined();
    expect(created).toHaveLength(0);
    expect(marked).toHaveLength(0);
  });

  test('invite-based provisioning preserves the supplied phone', async () => {
    const created: any[] = [];
    const service = new AuthService(
      { generateInviteToken: async () => ({ token: 'invite-token' }) } as never,
      {
        create: async (data: any) => {
          created.push(data);
          return { id: 'user-1', email: data.email };
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendHtml: async () => undefined } as never,
    );
    (service as any).config = { frontendUrl: 'https://app.example.test' };
    (service as any).t = (key: string) => key;
    (service as any).logger = { error() { }, warn() { } };

    await service.provisionUser({
      email: 'family@example.ma',
      phone: '0612345678',
    });

    expect(created[0].phone).toBe('0612345678');
  });

  test('brands an invitation for the provisioned account role', async () => {
    const sent: Array<{ html: string; subject: string; to: string }> = [];
    const service = new AuthService(
      { generateInviteToken: async () => ({ token: 'invite-token' }) } as never,
      {
        create: async (data: any) => ({ id: 'user-1', name: data.name, email: data.email }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        sendHtml: async (to: string, subject: string, html: string) => {
          sent.push({ html, subject, to });
        },
      } as never,
    );
    (service as any).config = {
      appName: 'Kafil',
      frontendUrl: 'https://kafala360.ma',
    };
    (service as any).t = (
      _key: string,
      params: { accountLabel: string; appName: string },
    ) => `${params.appName}: activate your ${params.accountLabel}`;
    (service as any).logger = { error() { }, warn() { } };

    await service.provisionUser({
      email: 'sponsor@example.ma',
      name: 'Fatima Zahra',
      role: 'sponsor',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('sponsor@example.ma');
    expect(sent[0]?.subject).toBe('Kafil: activate your sponsor account');
    expect(sent[0]?.html).toContain('Activate your sponsor account');
    expect(sent[0]?.html).toContain('Kafil');
    expect(sent[0]?.html).not.toContain('Our App');
  });

  test('rejects a password and a temporary credential in the same call', async () => {
    const { service, created, marked } = provisioningService();

    await expect(service.provisionUser({
      email: 'fatima@example.ma',
      password: 'Permanent123',
      temporaryCredential: 'AB123456',
      requireCredentialSetup: 'password',
    } as never)).rejects.toBeDefined();
    expect(created).toHaveLength(0);
    expect(marked).toHaveLength(0);
  });

  test('rejects a temporary credential without the setup flag', async () => {
    const { service, created } = provisioningService();

    await expect(service.provisionUser({
      email: 'fatima@example.ma',
      temporaryCredential: 'AB123456',
    } as never)).rejects.toBeDefined();
    expect(created).toHaveLength(0);
  });

  test('requires a temporary credential when setup is required', async () => {
    const { service, created } = provisioningService();

    await expect(service.provisionUser({
      email: 'fatima@example.ma',
      requireCredentialSetup: 'password',
    } as never)).rejects.toBeDefined();
    expect(created).toHaveLength(0);
  });

  test('a failed requirement mark fails the whole provisioning call', async () => {
    // In production the two writes share one @Transaction, so the account
    // never survives a requirement that did not stick.
    const created: any[] = [];
    const service = new AuthService(
      {} as never,
      {
        create: async (data: any) => { created.push(data); return { id: 'user-1' }; },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { markRequired: async () => { throw new Error('requirement write failed'); } } as never,
      {} as never,
    );
    (service as any).t = (key: string) => key;
    (service as any).logger = { error() { }, warn() { } };

    await expect(service.provisionUser({
      email: 'fatima@example.ma',
      temporaryCredential: moroccanCinTemporaryCredential('AB123456'),
      requireCredentialSetup: 'password',
    })).rejects.toThrow('requirement write failed');
    expect(created).toHaveLength(1);
  });

  test('provisioning is refused when the requirement service is unavailable', async () => {
    const created: any[] = [];
    const service = new AuthService(
      {} as never,
      { create: async (data: any) => { created.push(data); return { id: 'user-1' }; } } as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    );
    (service as any).t = (key: string) => key;
    (service as any).logger = { error() { }, warn() { } };

    await expect(service.provisionUser({
      email: 'fatima@example.ma',
      temporaryCredential: 'AB123456',
      requireCredentialSetup: 'password',
    })).rejects.toBeDefined();
    expect(created).toHaveLength(0);
  });

  test('provisioning without the flag keeps normal strength validation', async () => {
    const { service, created, createOptions, marked } = provisioningService();

    await service.provisionUser({
      email: 'operator@example.ma',
      password: 'StrongPass123',
    });

    expect(created[0].password).toBe('StrongPass123');
    expect(createOptions[0]).toBeUndefined();
    expect(marked).toHaveLength(0);
  });
});

describe('session establishment refuses a required user', () => {
  function sessionService(required: boolean) {
    const minted: string[] = [];
    const service = new AuthSessionService(
      {
        deleteExpiredSessions: async () => { minted.push('prune'); },
        generateTokens: async () => {
          minted.push('tokens');
          return {
            accessToken: 'access',
            refreshToken: 'refresh',
            userId: 'user-1',
            tokenFamily: 'family',
            roles: [],
            permissions: [],
            sessionVersion: 1,
            tokenFamily: 'family-1',
          };
        },
      } as never,
      { updateLastLogin: async () => undefined } as never,
      { setRefreshToken: () => { }, setSessionCookie: () => { } } as never,
      { isRequired: async () => required } as never,
    );
    return { service, minted };
  }

  test('no normal session is minted while a requirement is outstanding', async () => {
    const { service, minted } = sessionService(true);

    await expect(service.establish({
      id: 'user-1',
      email: 'fatima@example.ma',
      status: 'active',
    } as never)).rejects.toMatchObject({ code: 'AUTH_CREDENTIAL_SETUP_REQUIRED' });
    expect(minted).toHaveLength(0);
  });

  test('a completed requirement lets the session through', async () => {
    const { service, minted } = sessionService(false);

    await expect(service.establish({
      id: 'user-1',
      email: 'fatima@example.ma',
      status: 'active',
    } as never)).resolves.toMatchObject({ accessToken: 'access' });
    expect(minted).toEqual(['prune', 'tokens']);
  });
});

describe('OAuth cannot bypass the requirement', () => {
  const attempt = {
    provider: 'google' as const,
    intent: 'login' as const,
    state: 'state',
    nonce: 'nonce',
    codeVerifier: 'verifier',
    returnTo: '/dashboard',
    createdAt: Date.now(),
  };

  test('a required user gets the stable redirect and no session', async () => {
    let established = 0;
    const service = new OAuthService(
      { consume: () => attempt, validateReturnTo: (value: string) => value } as never,
      {
        exchange: async () => ({
          provider: 'google',
          providerAccountId: 'sub',
          email: 'fatima@example.ma',
          emailVerified: true,
        }),
      } as never,
      {} as never,
      {
        resolveForLogin: async () => ({
          id: 'user-1',
          email: 'fatima@example.ma',
          status: 'active',
        }),
      } as never,
      { establish: async () => { established += 1; } } as never,
      {} as never,
      {} as never,
      { isRequired: async () => true } as never,
    );
    (service as any).config = {
      frontendUrl: 'https://app.test',
      oauth: {
        google: {
          frontendCallbackPath: '/auth/oauth/callback',
          errorRedirectPath: '/login',
        },
      },
    };
    (service as any).logger = { warn() { } };

    const redirect = await service.finishGoogleCallback({ code: 'code', state: 'state' });
    const url = new URL(redirect);

    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('oauthError')).toBe('oauth_credential_setup_required');
    expect(established).toBe(0);
  });
});

describe('replacement password policy', () => {
  test('accepts the lowercase-and-digits contract', () => {
    expect(defaultCredentialSetupPasswordSchema.safeParse('fatima2026').success).toBe(true);
    expect(defaultCredentialSetupPasswordSchema.safeParse('Fatima2026').success).toBe(true);
  });

  test('rejects short, letterless, and digitless replacements', () => {
    for (const candidate of ['fat26', '20260808', 'fatimafatima']) {
      expect(defaultCredentialSetupPasswordSchema.safeParse(candidate).success).toBe(false);
    }
  });

  test('rejects anything past bcrypt significance', () => {
    expect(defaultCredentialSetupPasswordSchema.safeParse(`a1${'x'.repeat(71)}`).success).toBe(false);
  });
});

describe('password replacement', () => {
  function passwordSetup(options: {
    requirement?: Record<string, unknown> | undefined;
    storedHash?: string;
    completes?: boolean;
  } = {}) {
    const updates: any[] = [];
    const completed: string[] = [];
    const consumptions: string[] = [];
    const consumedFor = 'user-1';
    const storedHash = options.storedHash ?? 'hash(ab123456)';

    const service = new PasswordSetupService(
      {
        begin: async () => ({ purpose: 'password', expiresAt: 'later' }),
        require: async () => ({ userId: consumedFor, purpose: 'password', expiresAt: 'later' }),
        consume: async (_options: unknown, complete: (session: any) => Promise<unknown>) => {
          consumptions.push(consumedFor);
          return complete({ userId: consumedFor, purpose: 'password', expiresAt: 'later' });
        },
        cancel: async () => ({ cancelled: true as const }),
      } as never,
      {
        find: async () => ('requirement' in options ? options.requirement : {
          userId: consumedFor,
          purpose: 'password',
          temporaryCredentialKind: 'ma-cin',
          required: true,
          completedAt: null,
        }),
        completeRequirement: async (userId: string) => {
          if (options.completes === false) return undefined;
          completed.push(userId);
          return { userId, purpose: 'password', required: false };
        },
      } as never,
      { getAuthRecordById: async () => ({ id: consumedFor, password: storedHash }) } as never,
      { update: async (id: string, data: any) => { updates.push({ id, ...data }); } } as never,
      {
        comparePassword: async (candidate: string, hash: string) =>
          hash === `hash(${candidate})`,
      } as never,
      { hashPassword: async (value: string) => `hash(${value})` } as never,
    );

    (service as any).config = {
      credentialSetup: {
        password: {
          ttlMs: 600_000,
          cookieName: 'najm.credential-setup',
          passwordSchema: defaultCredentialSetupPasswordSchema,
        },
      },
    };
    return { service, updates, completed, consumptions };
  }

  test('replaces the password and completes the requirement together', async () => {
    const { service, updates, completed, consumptions } = passwordSetup();

    await expect(service.change('fatima2026')).resolves.toEqual({
      changed: true,
      signInAgain: true,
    });
    expect(updates).toEqual([{ id: 'user-1', password: 'hash(fatima2026)' }]);
    expect(completed).toEqual(['user-1']);
    expect(consumptions).toEqual(['user-1']);
  });

  test('rejects a replacement that fails the policy', async () => {
    const { service, updates } = passwordSetup();
    await expect(service.change('short1')).rejects.toMatchObject({
      code: 'AUTH_CREDENTIAL_SETUP_PASSWORD_REJECTED',
    });
    expect(updates).toHaveLength(0);
  });

  test('a rejected replacement leaves the one-time session unspent', async () => {
    // Retrying a typo must not need a transaction rollback to work.
    for (const [candidate, storedHash] of [
      ['short1', undefined],
      ['cd987654', undefined],
      ['fatima2026', 'hash(fatima2026)'],
    ] as const) {
      const { service, consumptions, updates } = passwordSetup({ storedHash });
      await expect(service.change(candidate)).rejects.toBeDefined();
      expect(consumptions).toHaveLength(0);
      expect(updates).toHaveLength(0);
    }
  });

  test('rejects another CIN as a replacement', async () => {
    const { service, updates } = passwordSetup();
    await expect(service.change('cd987654')).rejects.toMatchObject({
      code: 'AUTH_CREDENTIAL_SETUP_PASSWORD_REJECTED',
    });
    expect(updates).toHaveLength(0);
  });

  test('rejects the current credential', async () => {
    const { service, updates } = passwordSetup({ storedHash: 'hash(fatima2026)' });
    await expect(service.change('fatima2026')).rejects.toMatchObject({
      code: 'AUTH_CREDENTIAL_SETUP_SAME_PASSWORD',
    });
    expect(updates).toHaveLength(0);
  });

  test('refuses when nothing is required any more', async () => {
    const { service, updates } = passwordSetup({ requirement: undefined });
    await expect(service.change('fatima2026')).rejects.toMatchObject({
      code: 'AUTH_CREDENTIAL_SETUP_ALREADY_COMPLETED',
    });
    expect(updates).toHaveLength(0);
  });

  test('a lost completion race aborts the whole replacement', async () => {
    const { service, completed } = passwordSetup({ completes: false });
    await expect(service.change('fatima2026')).rejects.toMatchObject({
      code: 'AUTH_CREDENTIAL_SETUP_ALREADY_COMPLETED',
    });
    expect(completed).toHaveLength(0);
  });
});
