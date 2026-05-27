import { eq, ne } from 'drizzle-orm';
import { Repository, Inject } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import { AuthQueries } from '../shared/queries';
import { ROLES } from '../roles/constants';
import type { User, NewUser } from '../schema/pg';

export interface UserWithPermissions extends Omit<User, 'password'> {
  role?: string | null;
  permissions: string[];
}

@Repository()
export class UserRepository {
  @DB() db: TDb;
  @Inject(AUTH_SCHEMA) private schema: AuthSchema;

  private get users() { return this.schema.users; }
  private get roles() { return this.schema.roles; }

  /** Shared query helper */
  private get q() { return new AuthQueries(this.db, this.schema); }

  async getAll(): Promise<UserWithPermissions[]> {
    // Fix N+1: Load users in one query
    const allUsers = await this.db
      .select(this.q.userSelection())
      .from(this.users)
      .leftJoin(this.roles, eq(this.users.roleId, this.roles.id));

    // Fix N+1: Batch load ALL permissions at once (1 query instead of N)
    const permissionsByRole = await this.q.batchLoadPermissionsByRole();

    // Map in memory (O(n), no extra queries)
    return allUsers.map(user => ({
      ...user,
      permissions: user.roleId ? (permissionsByRole.get(user.roleId) ?? []) : [],
    }));
  }

  async getById(id: string): Promise<UserWithPermissions | undefined> {
    const [user] = await this.db
      .select(this.q.userSelection())
      .from(this.users)
      .leftJoin(this.roles, eq(this.users.roleId, this.roles.id))
      .where(eq(this.users.id, id))
      .limit(1);

    if (!user) return user;

    return {
      ...user,
      permissions: await this.q.getUserPermissions(user.id)
    };
  }

  async getRawById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(this.users)
      .where(eq(this.users.id, id))
      .limit(1);
    return user;
  }

  async getByEmail(email: string): Promise<(User & { role?: string | null }) | undefined> {
    const [existingUser] = await this.db
      .select({
        ...this.q.userSelection(),
        password: this.users.password,
        failedLoginAttempts: this.users.failedLoginAttempts,
        lockoutUntil: this.users.lockoutUntil,
      })
      .from(this.users)
      .leftJoin(this.roles, eq(this.users.roleId, this.roles.id))
      .where(eq(this.users.email, email));
    return existingUser;
  }

  async create(data: NewUser): Promise<User> {
    const [newUser] = await this.db.insert(this.users).values(data).returning();
    return newUser;
  }

  async update(id: string, data: Partial<NewUser>): Promise<User> {
    const [updatedUser] = await this.db.update(this.users).set(data).where(eq(this.users.id, id)).returning();
    return updatedUser;
  }

  async updateLastLogin(id: string): Promise<User> {
    const [updatedUser] = await this.db
      .update(this.users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(this.users.id, id))
      .returning();
    return updatedUser;
  }

  async incrementFailedAttempts(id: string): Promise<User> {
    const user = await this.getRawById(id);
    const [updatedUser] = await this.db
      .update(this.users)
      .set({ failedLoginAttempts: (user?.failedLoginAttempts ?? 0) + 1 })
      .where(eq(this.users.id, id))
      .returning();
    return updatedUser;
  }

  async resetFailedAttempts(id: string): Promise<User> {
    const [updatedUser] = await this.db
      .update(this.users)
      .set({ failedLoginAttempts: 0, lockoutUntil: null })
      .where(eq(this.users.id, id))
      .returning();
    return updatedUser;
  }

  async setLockout(id: string, until: string): Promise<User> {
    const [updatedUser] = await this.db
      .update(this.users)
      .set({ lockoutUntil: until })
      .where(eq(this.users.id, id))
      .returning();
    return updatedUser;
  }

  async delete(id: string): Promise<User> {
    const [deletedUser] = await this.db.delete(this.users).where(eq(this.users.id, id)).returning();
    return deletedUser;
  }

  async deleteAll(): Promise<User[]> {
    const adminRole = await this.db
      .select({ id: this.roles.id })
      .from(this.roles)
      .where(eq(this.roles.name, ROLES.ADMIN))
      .limit(1);

    if (adminRole.length === 0) {
      const deletedUsers = await this.db.delete(this.users).returning();
      return deletedUsers;
    }
    const deletedUsers = await this.db
      .delete(this.users)
      .where(ne(this.users.roleId, adminRole[0].id))
      .returning();

    return deletedUsers;
  }

  async getRoleNameById(userId: string): Promise<string | null> {
    return this.q.getRoleName(userId);
  }

  async findByPhone(phone: string): Promise<UserWithPermissions | undefined> {
    const [user] = await this.db
      .select(this.q.userSelection())
      .from(this.users)
      .leftJoin(this.roles, eq(this.users.roleId, this.roles.id))
      .where(eq(this.users.phone, phone))
      .limit(1);

    if (!user) return undefined;

    return {
      ...user,
      permissions: await this.q.getUserPermissions(user.id),
    };
  }

  async getUserPassword(email: string): Promise<string | undefined> {
    const [user] = await this.db
      .select({
        id: this.users.id,
        email: this.users.email,
        password: this.users.password
      })
      .from(this.users)
      .where(eq(this.users.email, email))
      .limit(1);
    return user?.password;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    return this.q.getUserPermissions(userId);
  }

  async updatePhone(id: string, phone: string): Promise<User> {
    const [updatedUser] = await this.db
      .update(this.users)
      .set({ phone, phoneVerified: true })
      .where(eq(this.users.id, id))
      .returning();
    return updatedUser;
  }

}
