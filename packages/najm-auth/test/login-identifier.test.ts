import { describe, expect, test } from 'bun:test';
import { AuthService } from '../src/auth/AuthService';

const activeUser = {
  id: 'user-1',
  email: 'alice@example.test',
  password: 'stored-hash',
  status: 'active',
  emailVerified: true,
  role: 'operator',
  failedLoginAttempts: 0,
  lockoutUntil: null,
};

describe('login identifier resolution', () => {
  test('can verify credentials without establishing a normal session', async () => {
    const { service, established } = authService({
      findByEmailInsensitive: async () => activeUser,
    });

    await expect(service.verifyCredentials({
      identifier: 'alice@example.test',
      password: 'StrongPass123',
    })).resolves.toMatchObject({ id: 'user-1', role: 'operator' });
    expect(established.count).toBe(0);
  });

  test('can narrowly verify pending credentials for one exact role', async () => {
    const pendingSponsor = {
      ...activeUser,
      status: 'pending',
      emailVerified: false,
      role: 'sponsor',
    };
    const { service, established } = authService({
      findByEmailInsensitive: async () => pendingSponsor,
    });

    await expect(service.verifyPendingCredentials({
      identifier: 'alice@example.test',
      password: 'StrongPass123',
    }, 'sponsor')).resolves.toMatchObject({ id: 'user-1', role: 'sponsor' });
    expect(established.count).toBe(0);
  });

  test('pending verification rejects active, verified, or different-role accounts', async () => {
    for (const candidate of [
      activeUser,
      { ...activeUser, status: 'pending', emailVerified: false, role: 'operator' },
      { ...activeUser, status: 'pending', emailVerified: true, role: 'sponsor' },
    ]) {
      const { service, established } = authService({
        findByEmailInsensitive: async () => candidate,
      });

      await expect(service.verifyPendingCredentials({
        identifier: 'alice@example.test',
        password: 'StrongPass123',
      }, 'sponsor')).rejects.toBeDefined();
      expect(established.count).toBe(0);
    }
  });

  test('normalizes email identifiers case-insensitively', async () => {
    const lookups: string[] = [];
    const { service } = authService({
      findByEmailInsensitive: async (email) => {
        lookups.push(email);
        return activeUser;
      },
    });

    await expect(service.loginUser({
      identifier: '  Alice@Example.Test  ',
      password: 'StrongPass123',
    })).resolves.toMatchObject({ accessToken: 'access' });
    expect(lookups).toEqual(['alice@example.test']);
  });

  test('supports the existing email payload', async () => {
    const lookups: string[] = [];
    const { service } = authService({
      findByEmailInsensitive: async (email) => {
        lookups.push(email);
        return activeUser;
      },
    });

    await expect(service.loginUser({
      email: 'Alice@Example.Test',
      password: 'StrongPass123',
    })).resolves.toMatchObject({ accessToken: 'access' });
    expect(lookups).toEqual(['alice@example.test']);
  });

  test('normalizes an international phone before resolving the account', async () => {
    const phoneLookups: string[] = [];
    const emailLookups: string[] = [];
    const { service } = authService({
      findByPhone: async (phone) => {
        phoneLookups.push(phone);
        return { id: activeUser.id, email: activeUser.email };
      },
      findByEmail: async (email) => {
        emailLookups.push(email);
        return activeUser;
      },
    });

    await expect(service.loginUser({
      identifier: '00 212 (612) 34-56-78',
      password: 'StrongPass123',
    })).resolves.toMatchObject({ accessToken: 'access' });
    expect(phoneLookups).toEqual(['+212612345678']);
    expect(emailLookups).toEqual(['alice@example.test']);
  });
});

function authService(overrides: {
  findByEmailInsensitive?: (email: string) => Promise<any>;
  findByEmail?: (email: string) => Promise<any>;
  findByPhone?: (phone: string) => Promise<any>;
} = {}) {
  const established = { count: 0 };
  const userService = {
    findByEmailInsensitive: overrides.findByEmailInsensitive ?? (async () => undefined),
    findByEmail: overrides.findByEmail ?? (async () => undefined),
    findByPhone: overrides.findByPhone ?? (async () => undefined),
    resetFailedAttempts: async () => undefined,
    incrementFailedAttempts: async () => 1,
    setLockout: async () => undefined,
  };
  const authSessionService = {
    establish: async (user: Record<string, unknown>) => {
      established.count += 1;
      return {
        accessToken: 'access',
        refreshToken: 'refresh',
        user,
      };
    },
  };
  const service = new AuthService(
    {} as never,
    userService as never,
    { comparePassword: async () => true } as never,
    { hashPassword: async () => 'dummy-hash' } as never,
    {} as never,
    {} as never,
    {} as never,
    authSessionService as never,
  );
  (service as any).config = {
    lockout: { maxAttempts: 5, duration: '15m' },
    requireVerifiedEmail: false,
  };
  (service as any).t = (key: string) => key;
  return { service, established };
}
