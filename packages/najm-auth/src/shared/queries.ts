import { eq } from 'drizzle-orm';
import type { AuthSchema } from '../types';

/**
 * Shared query builders used across auth repositories.
 * Eliminates duplication between UserRepository and TokenRepository.
 */
export class AuthQueries {
  constructor(
    private db: any,
    private schema: AuthSchema,
  ) {}

  /**
   * Standard user selection fields with role join
   */
  userSelection() {
    return {
      id: this.schema.users.id,
      name: this.schema.users.name,
      email: this.schema.users.email,
      emailVerified: this.schema.users.emailVerified,
      image: this.schema.users.image,
      status: this.schema.users.status,
      roleId: this.schema.users.roleId,
      lastLogin: this.schema.users.lastLogin,
      role: this.schema.roles.name,
      createdAt: this.schema.users.createdAt,
      updatedAt: this.schema.users.updatedAt,
    };
  }

  /**
   * Get permissions for a user by their userId
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const [user] = await this.db
      .select({ roleId: this.schema.users.roleId })
      .from(this.schema.users)
      .where(eq(this.schema.users.id, userId))
      .limit(1);

    if (!user?.roleId) return [];

    const perms = await this.db
      .select({ name: this.schema.permissions.name })
      .from(this.schema.rolePermissions)
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id),
      )
      .where(eq(this.schema.rolePermissions.roleId, user.roleId));

    return perms.map((p: any) => p.name).filter(Boolean);
  }

  /**
   * Get role name for a user
   */
  async getRoleName(userId: string): Promise<string | null> {
    const [role] = await this.db
      .select({ roleName: this.schema.roles.name })
      .from(this.schema.users)
      .leftJoin(this.schema.roles, eq(this.schema.users.roleId, this.schema.roles.id))
      .where(eq(this.schema.users.id, userId))
      .limit(1);

    return role?.roleName ?? null;
  }

  /**
   * Get role name and permissions for a user in a single query chain.
   * Returns { roleName: string | null, permissions: string[] }
   */
  async getRoleAndPermissions(userId: string): Promise<{ roleName: string | null; permissions: string[] }> {
    const [user] = await this.db
      .select({ roleId: this.schema.users.roleId })
      .from(this.schema.users)
      .where(eq(this.schema.users.id, userId))
      .limit(1);

    if (!user?.roleId) {
      const [roleRow] = await this.db
        .select({ roleName: this.schema.roles.name })
        .from(this.schema.users)
        .leftJoin(this.schema.roles, eq(this.schema.users.roleId, this.schema.roles.id))
        .where(eq(this.schema.users.id, userId))
        .limit(1);
      return { roleName: roleRow?.roleName ?? null, permissions: [] };
    }

    const [roleRow] = await this.db
      .select({ roleName: this.schema.roles.name })
      .from(this.schema.roles)
      .where(eq(this.schema.roles.id, user.roleId))
      .limit(1);

    const perms = await this.db
      .select({ name: this.schema.permissions.name })
      .from(this.schema.rolePermissions)
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id),
      )
      .where(eq(this.schema.rolePermissions.roleId, user.roleId));

    return {
      roleName: roleRow?.roleName ?? null,
      permissions: perms.map((p: any) => p.name).filter(Boolean),
    };
  }

  /**
   * Batch load permissions for multiple users (fixes N+1 query problem)
   * Returns a Map of roleId -> permissions[]
   */
  async batchLoadPermissionsByRole(): Promise<Map<string, string[]>> {
    const allPermissions = await this.db
      .select({
        roleId: this.schema.rolePermissions.roleId,
        name: this.schema.permissions.name,
      })
      .from(this.schema.rolePermissions)
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id)
      );

    const permissionsByRole = new Map<string, string[]>();
    for (const p of allPermissions) {
      if (!p.name) continue;
      const list = permissionsByRole.get(p.roleId) || [];
      list.push(p.name);
      permissionsByRole.set(p.roleId, list);
    }

    return permissionsByRole;
  }
}
