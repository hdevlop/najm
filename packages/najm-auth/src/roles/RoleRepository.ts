
import { eq } from 'drizzle-orm';
import { Repository, Inject } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import type { RoleEntity, NewRoleEntity } from '../schema/pg';

@Repository()
export class RoleRepository {
  @DB() db: TDb;
  @Inject(AUTH_SCHEMA) private schema: AuthSchema;

  private get roles() { return this.schema.roles; }
  private get users() { return this.schema.users; }

  /** True if any user currently references this role (blocks deletion). */
  async hasUsers(roleId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: this.users.id })
      .from(this.users)
      .where(eq(this.users.roleId, roleId))
      .limit(1);
    return rows.length > 0;
  }

  async getAll(): Promise<RoleEntity[]> {
    return await this.db.select().from(this.roles);
  }

  async getById(id: string): Promise<RoleEntity | undefined> {
    const [existingRole] = await this.db.select().from(this.roles).where(eq(this.roles.id, id));
    return existingRole;
  }

  async getByName(name: string): Promise<RoleEntity | undefined> {
    const [existingRole] = await this.db.select().from(this.roles).where(eq(this.roles.name, name));
    return existingRole
  }

  async create(data: NewRoleEntity): Promise<RoleEntity> {
    const [newRole] = await this.db.insert(this.roles).values(data).returning();
    return newRole
  }

  async update(id: string, data: Partial<NewRoleEntity>): Promise<RoleEntity> {
    const [updatedRole] = await this.db.update(this.roles)
      .set(data)
      .where(eq(this.roles.id, id))
      .returning();

    return updatedRole
  }

  async delete(id: string): Promise<RoleEntity> {
    const [deletedRole] = await this.db.delete(this.roles)
      .where(eq(this.roles.id, id))
      .returning();
    return deletedRole
  }
}
