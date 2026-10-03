
import { eq, and, sql } from 'drizzle-orm';
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

  /**
   * Capture grants and mutate their parent in one database transaction. A
   * PostgreSQL parent-row lock conflicts with the FK check of a concurrent
   * grant. SQLite executes the whole callback synchronously under its write
   * lock; an async callback would commit before its awaited queries finish.
   */
  private async mutateWithRoles(id: string | undefined, mutation: (db: any) => any) {
    const grants = (db: any) => {
      const query = db.selectDistinct({ roleId: this.rolePermissions.roleId }).from(this.rolePermissions);
      return id === undefined ? query : query.where(eq(this.rolePermissions.permissionId, id));
    };
    const probe = this.db.select().from(this.permissions).limit(0);
    const sqlite = typeof probe.for !== 'function';
    if (sqlite && this.db.resultKind === 'sync') {
      return this.db.transaction((tx: any) => {
        const roleIds = grants(tx).all().map((row: { roleId: string }) => row.roleId);
        const rows: Permission[] = mutation(tx).returning().all();
        return { rows, roleIds };
      });
    }
    return this.db.transaction(async (tx: any) => {
      if (!sqlite && id === undefined) {
        // Also prevent a new permission + grant from appearing during deleteAll.
        await tx.execute(sql`LOCK TABLE ${this.permissions} IN EXCLUSIVE MODE`);
      } else if (!sqlite) {
        await tx.select({ id: this.permissions.id }).from(this.permissions)
          .where(eq(this.permissions.id, id)).for('update');
      }
      const roleIds = (await grants(tx)).map((row: { roleId: string }) => row.roleId);
      const rows: Permission[] = await mutation(tx).returning();
      return { rows, roleIds };
    });
  }

  async updateWithRoles(id: string, data: Partial<NewPermission>) {
    const { rows, roleIds } = await this.mutateWithRoles(id,
      db => db.update(this.permissions).set(data).where(eq(this.permissions.id, id)));
    return { permission: rows[0], roleIds };
  }

  async deleteWithRoles(id: string) {
    const { rows, roleIds } = await this.mutateWithRoles(id,
      db => db.delete(this.permissions).where(eq(this.permissions.id, id)));
    return { permission: rows[0], roleIds };
  }

  async deleteAllWithRoles() {
    return this.mutateWithRoles(undefined, db => db.delete(this.permissions));
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
