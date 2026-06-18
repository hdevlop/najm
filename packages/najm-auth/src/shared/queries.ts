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

  async getUserWithPermissions(where: any): Promise<any | undefined> {
    const rows = await this.db
      .select({
        ...this.userSelection(),
        permissionName: this.schema.permissions.name,
      })
      .from(this.schema.users)
      .leftJoin(this.schema.roles, eq(this.schema.users.roleId, this.schema.roles.id))
      .leftJoin(
        this.schema.rolePermissions,
        eq(this.schema.users.roleId, this.schema.rolePermissions.roleId),
      )
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id),
      )
      .where(where);

    if (rows.length === 0) return undefined;

    const { permissionName: _permissionName, ...user } = rows[0];
    const permissions = [...new Set(
      rows.map((row: any) => row.permissionName).filter(Boolean),
    )] as string[];

    return { ...user, permissions };
  }

  /**
   * Get permissions for a user by their userId
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const perms = await this.db
      .select({ name: this.schema.permissions.name })
      .from(this.schema.users)
      .leftJoin(
        this.schema.rolePermissions,
        eq(this.schema.users.roleId, this.schema.rolePermissions.roleId),
      )
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id),
      )
      .where(eq(this.schema.users.id, userId));

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
    const rows = await this.db
      .select({
        roleName: this.schema.roles.name,
        permissionName: this.schema.permissions.name,
      })
      .from(this.schema.users)
      .leftJoin(this.schema.roles, eq(this.schema.users.roleId, this.schema.roles.id))
      .leftJoin(
        this.schema.rolePermissions,
        eq(this.schema.users.roleId, this.schema.rolePermissions.roleId),
      )
      .leftJoin(
        this.schema.permissions,
        eq(this.schema.rolePermissions.permissionId, this.schema.permissions.id),
      )
      .where(eq(this.schema.users.id, userId));

    return {
      roleName: rows[0]?.roleName ?? null,
      permissions: [...new Set(
        rows.map((row: any) => row.permissionName).filter(Boolean),
      )] as string[],
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
