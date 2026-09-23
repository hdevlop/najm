import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { UserService } from '../src/users/UserService';
import { UserValidator } from '../src/users/UserValidator';

function adminSeedHarness(existingUser?: { id: string }) {
  const calls: string[] = [];
  const repository = {
    getByEmail: async () => {
      calls.push('getByEmail');
      return existingUser;
    },
  };
  const validator = new UserValidator(repository as any, {} as any);
  const service = new UserService(
    { checkAdminRoleExists: async () => {
      calls.push('checkAdminRoleExists');
      return { id: 'admin-role' };
    } } as any,
    {} as any,
    repository as any,
    validator,
    {} as any,
    {} as any,
    {} as any,
  );
  service.delete = async () => {
    calls.push('delete');
    return {} as any;
  };
  service.create = async (data) => {
    calls.push('create');
    return { ...data, id: 'new-admin' } as any;
  };
  return { service, calls };
}

describe('admin seed password', () => {
  test('accepts an eight-character password that meets the shared strength policy', async () => {
    const { service, calls } = adminSeedHarness();

    const admin = await service.seedAdminUser({ email: 'admin@example.test', password: 'Abcdefg1' });

    expect(admin.id).toBe('new-admin');
    expect('password' in admin).toBe(false);
    expect(calls).toEqual(['checkAdminRoleExists', 'getByEmail', 'create']);
  });

  test('rejects a weak password before touching an existing account', async () => {
    const { service, calls } = adminSeedHarness({ id: 'existing-admin' });

    await expect(service.seedAdminUser({
      email: 'admin@example.test',
      password: 'Abcdef1',
    })).rejects.toThrow('at least 8 characters');
    expect(calls).toEqual([]);
  });
});
