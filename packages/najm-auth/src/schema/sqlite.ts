// SQLite schema for najm-auth
import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { UserStatus, TokenStatus, TokenType } from './constants';

// ============================================================================
// Base Fields Factory
// ============================================================================

export const baseFields = (idLength = 5) => ({
  id: text('id').primaryKey().$defaultFn(() => nanoid(idLength)),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => sql`(datetime('now'))`),
});

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * Roles table - Defines user roles in the system
 */
export const rolesTable = sqliteTable('roles', {
  ...baseFields(5),
  name: text('name').notNull(),
  description: text('description'),
});

/**
 * Users table - Core user authentication data
 */
export const usersTable = sqliteTable('users', {
  ...baseFields(8),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  phone: text('phone').unique(),
  phoneVerified: integer('phone_verified', { mode: 'boolean' }).default(false),
  password: text('password').notNull(),
  image: text('image').default('noavatar.png'),
  status: text('status').$type<UserStatus>().default('pending'),
  roleId: text('role_id').references(() => rolesTable.id),
  lastLogin: text('last_login'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockoutUntil: text('lockout_until'),
}, (table) => ({
  roleIdx: index('users_role_id_idx').on(table.roleId),
}));

/** External identity-provider accounts linked to Najm users. */
export const oauthAccountsTable = sqliteTable('oauth_accounts', {
  ...baseFields(10),
  userId: text('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
}, (table) => ({
  providerAccountUnique: uniqueIndex('oauth_accounts_provider_account_unique')
    .on(table.provider, table.providerAccountId),
  userProviderUnique: uniqueIndex('oauth_accounts_user_provider_unique')
    .on(table.userId, table.provider),
  userIdIdx: index('oauth_accounts_user_id_idx').on(table.userId),
}));

/**
 * Permissions table - Defines granular permissions
 */
export const permissionsTable = sqliteTable('permissions', {
  ...baseFields(5),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
});

/**
 * Tokens table - Manages refresh tokens
 */
export const tokensTable = sqliteTable('tokens', {
  ...baseFields(10),
  userId: text('user_id').references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull(),
  tokenFamily: text('token_family').notNull().unique(),
  previousHash: text('previous_hash'),
  previousValidUntil: text('previous_valid_until'),
  previousUsedAt: text('previous_used_at'),
  type: text('type').$type<TokenType>().default('refresh'),
  status: text('status').$type<TokenStatus>().default('active'),
  expiresAt: text('expires_at').notNull(),
}, (table) => ({
  userIdIdx: index('tokens_user_id_idx').on(table.userId),
  expiresAtIdx: index('tokens_expires_at_idx').on(table.expiresAt),
}));

/**
 * Junction table for many-to-many relationship between roles and permissions
 */
export const rolePermissionsTable = sqliteTable('role_permissions', {
  ...baseFields(10),
  roleId: text('role_id').notNull().references(() => rolesTable.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissionsTable.id, { onDelete: 'cascade' }),
},
(table) => ({
  uniq: uniqueIndex('role_permission_unique').on(table.roleId, table.permissionId),
}));

// ============================================================================
// Schema Aggregation
// ============================================================================

export const authSchema = {
  users: usersTable,
  oauthAccounts: oauthAccountsTable,
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

export type OAuthAccount = typeof oauthAccountsTable.$inferSelect;
export type NewOAuthAccount = typeof oauthAccountsTable.$inferInsert;

export type RoleEntity = typeof rolesTable.$inferSelect;
export type NewRoleEntity = typeof rolesTable.$inferInsert;

export type Permission = typeof permissionsTable.$inferSelect;
export type NewPermission = typeof permissionsTable.$inferInsert;

export type Token = typeof tokensTable.$inferSelect;
export type NewToken = typeof tokensTable.$inferInsert;

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type NewRolePermission = typeof rolePermissionsTable.$inferInsert;
