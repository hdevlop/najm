
import { eq, and } from 'drizzle-orm';
import { Repository, Inject } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import type { Permission, NewPermission, RolePermission, RoleEntity } from '../schema/pg';


@Repository()
export class PermissionRepository {
  @DB() db: TDb;
  @Inject(AUTH_SCHEMA) private schema: AuthSchema;

  private get permissions() { return this.schema.permissions; }
  private get rolePermissions() { return this.schema.rolePermissions; }
  private get roles() { return this.schema.roles; }

  async getAll(): Promise<Permission[]> {
    return await this.db.select().from(this.permissions);
  }

  async getById(id: string): Promise<Permission | undefined> {
    const [existingPermission] = await this.db
      .select()
      .from(this.permissions)
      .where(eq(this.permissions.id, id));
    return existingPermission;
  }

  async getByName(name: string): Promise<Permission | undefined> {
    const [existingPermission] = await this.db
      .select()
      .from(this.permissions)
      .where(eq(this.permissions.name, name));
    return existingPermission;
  }

  async getByResource(resource: string): Promise<Permission[]> {
    return await this.db
      .select()
      .from(this.permissions)
      .where(eq(this.permissions.resource, resource));
  }

  async create(data: NewPermission): Promise<Permission> {
    const [newPermission] = await this.db
      .insert(this.permissions)
      .values(data)
      .returning();
    return newPermission;
  }

  async update(id: string, data: Partial<NewPermission>): Promise<Permission> {
    const [updatedPermission] = await this.db
      .update(this.permissions)
      .set(data)
      .where(eq(this.permissions.id, id))
      .returning();
    return updatedPermission;
  }

  async delete(id: string): Promise<Permission> {
    const [deletedPermission] = await this.db
      .delete(this.permissions)
      .where(eq(this.permissions.id, id))
      .returning();
    return deletedPermission;
  }

  async getPermissionsByRole(roleId: string): Promise<Array<Pick<Permission, 'id' | 'name' | 'description' | 'resource' | 'action'>>> {
    return await this.db
      .select({
        id: this.permissions.id,
        name: this.permissions.name,
        description: this.permissions.description,
        resource: this.permissions.resource,
        action: this.permissions.action,
      })
      .from(this.rolePermissions)
      .leftJoin(this.permissions, eq(this.rolePermissions.permissionId, this.permissions.id))
      .where(eq(this.rolePermissions.roleId, roleId));
  }

  async getRolesByPermission(permissionId: string): Promise<Array<Pick<RoleEntity, 'id' | 'name' | 'description'>>> {
    return await this.db
      .select({
        id: this.roles.id,
        name: this.roles.name,
        description: this.roles.description,
      })
      .from(this.rolePermissions)
      .leftJoin(this.roles, eq(this.rolePermissions.roleId, this.roles.id))
      .where(eq(this.rolePermissions.permissionId, permissionId));
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const [newRolePermission] = await this.db
      .insert(this.rolePermissions)
      .values({ roleId, permissionId })
      .returning();
    return newRolePermission;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const [deletedRolePermission] = await this.db
      .delete(this.rolePermissions)
      .where(and(eq(this.rolePermissions.roleId, roleId), eq(this.rolePermissions.permissionId, permissionId)))
      .returning();
    return deletedRolePermission;
  }

  async checkRoleHasPermission(roleId: string, permissionId: string): Promise<boolean> {
    const [rolePermission] = await this.db
      .select()
      .from(this.rolePermissions)
      .where(and(eq(this.rolePermissions.roleId, roleId), eq(this.rolePermissions.permissionId, permissionId)));
    return !!rolePermission;
  }

  async deleteAll(): Promise<Permission[]> {
    await this.db.delete(this.rolePermissions);

    const deletedPermissions = await this.db
      .delete(this.permissions)
      .returning();

    return deletedPermissions;
  }
}
