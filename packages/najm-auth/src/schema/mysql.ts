// MySQL schema for najm-auth
import { mysqlTable, varchar, boolean, timestamp, mysqlEnum, primaryKey, int, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { USER_STATUS, TOKEN_STATUS, TOKEN_TYPE } from './constants';

// ============================================================================
// Base Fields Factory
// ============================================================================

export const baseFields = (idLength = 5) => ({
  id: varchar('id', { length: 21 }).primaryKey().$defaultFn(() => nanoid(idLength)),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// Table Definitions
// Note: MySQL enums are defined inline (mysqlEnum creates columns, not reusable types like pgEnum)
// ============================================================================

/**
 * Roles table - Defines user roles in the system
 */
export const rolesTable = mysqlTable('roles', {
  ...baseFields(5),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
});

/**
 * Users table - Core user authentication data
 */
export const usersTable = mysqlTable('users', {
  ...baseFields(8),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  phone: varchar('phone', { length: 255 }).unique(),
  phoneVerified: boolean('phone_verified').default(false),
  password: varchar('password', { length: 255 }).notNull(),
  image: varchar('image', { length: 255 }).default('noavatar.png'),
  status: mysqlEnum('status', [...USER_STATUS]).default('pending'),
  roleId: varchar('role_id', { length: 21 }).references(() => rolesTable.id),
  lastLogin: timestamp('last_login', { mode: 'string' }),
  failedLoginAttempts: int('failed_login_attempts').default(0),
  lockoutUntil: timestamp('lockout_until', { mode: 'string' }),
}, (table) => ({
  roleIdx: index('users_role_id_idx').on(table.roleId),
}));

/**
 * Permissions table - Defines granular permissions
 */
export const permissionsTable = mysqlTable('permissions', {
  ...baseFields(5),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 1000 }),
  resource: varchar('resource', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
});

/**
 * Tokens table - Manages refresh tokens
 */
export const tokensTable = mysqlTable('tokens', {
  ...baseFields(10),
  userId: varchar('user_id', { length: 21 }).references(() => usersTable.id, { onDelete: 'cascade' }).unique().notNull(),
  token: varchar('token', { length: 500 }).notNull(),
  tokenFamily: varchar('token_family', { length: 16 }),
  previousHash: varchar('previous_hash', { length: 500 }),
  previousValidUntil: timestamp('previous_valid_until', { mode: 'string' }),
  previousUsedAt: timestamp('previous_used_at', { mode: 'string' }),
  type: mysqlEnum('type', [...TOKEN_TYPE]).default('refresh'),
  status: mysqlEnum('status', [...TOKEN_STATUS]).default('active'),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
}, (table) => ({
  expiresAtIdx: index('tokens_expires_at_idx').on(table.expiresAt),
}));

/**
 * Junction table for many-to-many relationship between roles and permissions
 */
export const rolePermissionsTable = mysqlTable('role_permissions', {
  roleId: varchar('role_id', { length: 21 }).notNull().references(() => rolesTable.id, { onDelete: 'cascade' }),
  permissionId: varchar('permission_id', { length: 21 }).notNull().references(() => permissionsTable.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
},
(table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// ============================================================================
// Schema Aggregation
// ============================================================================

export const authSchema = {
  users: usersTable,
  tokens: tokensTable,
  roles: rolesTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type RoleEntity = typeof rolesTable.$inferSelect;
export type NewRoleEntity = typeof rolesTable.$inferInsert;

export type Permission = typeof permissionsTable.$inferSelect;
export type NewPermission = typeof permissionsTable.$inferInsert;

export type Token = typeof tokensTable.$inferSelect;
export type NewToken = typeof tokensTable.$inferInsert;

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type NewRolePermission = typeof rolePermissionsTable.$inferInsert;
