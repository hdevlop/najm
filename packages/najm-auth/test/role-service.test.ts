import { describe, expect, test } from 'bun:test';
import { RoleService } from '../src/roles/RoleService';

function createRoleService(overrides: {
  role?: Record<string, any> | undefined;
  hasUsers?: boolean;
} = {}) {
  const role = overrides.role ?? { id: 'r1', name: 'editor' };
  const deleted: string[] = [];
  const updated: Array<{ id: string; data: any }> = [];

  const roleRepository = {
    hasUsers: async () => overrides.hasUsers ?? false,
    delete: async (id: string) => { deleted.push(id); return role; },
    update: async (id: string, data: any) => { updated.push({ id, data }); return { ...role, ...data }; },
    getByName: async () => undefined,
  };
  const roleValidator = {
    checkRoleExists: async () => role,
    checkNameUnique: async () => undefined,
  };

  const service = new RoleService(roleRepository as any, roleValidator as any);
  (service as any).t = (key: string) => key;

  return { service, deleted, updated };
}

describe('RoleService protections', () => {
  test('deletes an ordinary, unreferenced role', async () => {
    const { service, deleted } = createRoleService({ role: { id: 'r1', name: 'editor' }, hasUsers: false });
    await service.delete('r1');
    expect(deleted).toEqual(['r1']);
  });

  test('refuses to delete the built-in admin role', async () => {
    const { service, deleted } = createRoleService({ role: { id: 'r_admin', name: 'admin' } });
    await expect(service.delete('r_admin')).rejects.toMatchObject({ status: 403 });
    expect(deleted).toEqual([]);
  });

  test('refuses to delete a role that is assigned to users (409, not a raw FK 500)', async () => {
    const { service, deleted } = createRoleService({ role: { id: 'r1', name: 'editor' }, hasUsers: true });
    await expect(service.delete('r1')).rejects.toMatchObject({ status: 409 });
    expect(deleted).toEqual([]);
  });

  test('refuses to rename the built-in admin role', async () => {
    const { service, updated } = createRoleService({ role: { id: 'r_admin', name: 'admin' } });
    await expect(service.update('r_admin', { name: 'superadmin' })).rejects.toMatchObject({ status: 403 });
    expect(updated).toEqual([]);
  });

  test('allows updating the admin role description without renaming', async () => {
    const { service, updated } = createRoleService({ role: { id: 'r_admin', name: 'admin' } });
    await service.update('r_admin', { description: 'Full access' });
    expect(updated).toHaveLength(1);
    expect(updated[0].data).toEqual({ description: 'Full access' });
  });
});
