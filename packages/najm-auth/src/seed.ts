import type { SeedEntry } from 'najm-database';
import { createRoleDto } from './roles/RoleDto';
import { createUserDto } from './users/UserDto';
import { createPermissionDto } from './permissions/PermissionDto';
import { hash } from 'bcryptjs';
import type { AuthSeedConfig } from './seed.types';

const toSeedId = (prefix: string, value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return `${prefix}_${normalized || 'item'}`;
};

/**
 * Composable seed definition factory for najm-auth plugin.
 *
 * Provides default roles, permissions, and admin user with proper validation and password hashing.
 *
 * @example
 * ```typescript
 * const seeder = server.container.get(SeedService);
 *
 * await seeder.run({
 *   ...authSeed({ adminEmail: 'admin@test.com', adminPass: 'Admin123!' }),
 *   // ... your app-specific seeds
 * });
 * ```
 */
export const authSeed = (config: AuthSeedConfig): Record<string, SeedEntry> => ({
  roles: {
    schema: createRoleDto,
    rows: (config.roles ?? [
      { name: 'admin', description: 'System administrator with full access' },
      { name: 'user', description: 'Regular user with limited access' },
    ]).map((role) => ({
      id: toSeedId('role', role.name),
      ...role,
    })),
  },

  permissions: {
    schema: createPermissionDto,
    by: ['name'],
    onConflict: 'replace', // Permissions are code-defined, always sync
    rows: config.permissions ?? [
      { action: 'read', resource: 'users', name: 'read:users', description: 'View user information' },
      { action: 'create', resource: 'users', name: 'create:users', description: 'Create new users' },
      { action: 'update', resource: 'users', name: 'update:users', description: 'Update user information' },
      { action: 'delete', resource: 'users', name: 'delete:users', description: 'Delete users' },
      { action: 'manage', resource: 'roles', name: 'manage:roles', description: 'Manage roles and permissions' },
    ],
  },

  rolePermissions: {
    by: ['roleId', 'permissionId'],
    rows: (seeded) => {
      const admin = seeded.roles.find((r: any) => r.name === 'admin')!;
      return seeded.permissions.map((p: any) => ({
        roleId: admin.id,
        permissionId: p.id,
      }));
    },
  },

  // No schema on entry — validation + hashing handled inside resolver
  users: {
    by: ['email'],
    rows: async (seeded) => {
      // Validate admin email and password BEFORE hashing (bcrypt hash would fail strength rules)
      createUserDto.pick({ email: true, password: true }).parse({
        email: config.adminEmail,
        password: config.adminPass,
      });

      const adminRole = seeded.roles.find((r: any) => r.name === 'admin')!;

      const users = [
        {
          email: config.adminEmail,
          password: await hash(config.adminPass, 10),
          roleId: adminRole.id,
          emailVerified: true,
          status: 'active' as 'active' | 'inactive' | 'pending',
          image: undefined,
          name: undefined,
        },
      ];

      // Add additional users
      if (config.additionalUsers) {
        for (const user of config.additionalUsers) {
          // Validate each user's email and password
          createUserDto.pick({ email: true, password: true }).parse({
            email: user.email,
            password: user.password,
          });

          // Find the role for this user
          const role = seeded.roles.find((r: any) => r.name === user.roleName);
          if (!role) {
            throw new Error(`Role '${user.roleName}' not found for user ${user.email}`);
          }

          users.push({
            email: user.email,
            password: await hash(user.password, 10),
            roleId: role.id,
            emailVerified: user.emailVerified ?? true,
            status: (user.status ?? 'active') as 'active' | 'inactive' | 'pending',
            image: user.image,
            name: user.name || user.username,
          });
        }
      }

      return users;
    },
  },
});
