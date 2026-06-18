// PostgreSQL schema for najm-auth
import { pgTable, text, boolean, timestamp, pgEnum, primaryKey, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { USER_STATUS, TOKEN_STATUS, TOKEN_TYPE } from './constants';

// ============================================================================
// Base Fields Factory
// ============================================================================

export const baseFields = (idLength = 5) => ({
  id: text('id').primaryKey().$defaultFn(() => nanoid(idLength)),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// PostgreSQL Enums
// ============================================================================

export const userStatusEnum = pgEnum('userStatus', USER_STATUS);
export const tokenStatusEnum = pgEnum('tokenStatus', TOKEN_STATUS);
export const tokenTypeEnum = pgEnum('tokenType', TOKEN_TYPE);

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * Roles table - Defines user roles in the system
 */
export const rolesTable = pgTable('roles', {
  ...baseFields(5),
  name: text('name').notNull(),
  description: text('description'),
});

/**
 * Users table - Core user authentication data
 */
export const usersTable = pgTable('users', {
  ...baseFields(8),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  phone: text('phone').unique(),
  phoneVerified: boolean('phone_verified').default(false),
  password: text('password').notNull(),
  image: text('image').default('noavatar.png'),
  status: userStatusEnum('status').default('pending'),
  roleId: text('role_id').references(() => rolesTable.id),
  lastLogin: timestamp('last_login', { mode: 'string' }),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockoutUntil: timestamp('lockout_until', { mode: 'string' }),
}, (table) => ({
  roleIdx: index('users_role_id_idx').on(table.roleId),
}));

/**
 * Permissions table - Defines granular permissions
 */
export const permissionsTable = pgTable('permissions', {
  ...baseFields(5),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
});

/**
 * Tokens table - Manages refresh tokens
 */
export const tokensTable = pgTable('tokens', {
  ...baseFields(10),
  userId: text('user_id').references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull(),
  tokenFamily: text('token_family').notNull().unique(),
  previousHash: text('previous_hash'),
  previousValidUntil: timestamp('previous_valid_until', { mode: 'string' }),
  previousUsedAt: timestamp('previous_used_at', { mode: 'string' }),
  type: tokenTypeEnum('type').default('refresh'),
  status: tokenStatusEnum('status').default('active'),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
}, (table) => ({
  userIdIdx: index('tokens_user_id_idx').on(table.userId),
  expiresAtIdx: index('tokens_expires_at_idx').on(table.expiresAt),
}));

/**
 * Junction table for many-to-many relationship between roles and permissions
 */
export const rolePermissionsTable = pgTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => rolesTable.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissionsTable.id, { onDelete: 'cascade' }),
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
