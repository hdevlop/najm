// ============================================================================
// Auth Plugin Exports
// ============================================================================

// Plugin factory function
export { auth } from './AuthPlugin';

// Configuration types
export type {
  AuthConfig,
  AuthPluginConfig,
  AuthSchema,
  JwtConfig,
  JwtPayload,
  TokenPair,
  AuthUser,
  GoogleOAuthConfig,
  GitHubOAuthConfig,
  OAuthConfig,
  OAuthProvider,
} from './types';

// Configuration tokens
export {
  AUTH_CONFIG,
  AUTH_SCHEMA,
  AUTH_USER,
  AUTH_ROLE,
  AUTH_PERMISSIONS,
} from './auth.tokens';

// ============================================================================
// Locales Exports
// ============================================================================

// Default translations (can be extended/overridden by users)
export {
  AUTH_LOCALES,
  AUTH_EN,
  AUTH_SUPPORTED_LANGUAGES,
  getAuthLocale,
} from './locales';

// ============================================================================
// Module Exports
// ============================================================================

// Core modules
export * from './auth';
export * from './identity';
export * from './permissions';
export * from './roles';
export * from './ownership';
export * from './shared';
export * from './tokens';
export * from './users';
export * from './credentialSetup';

// Database schema aggregation
export { authSchema } from './schema';

// Individual table exports
export {
  usersTable,
  rolesTable,
  tokensTable,
  credentialSetupSessionsTable,
  credentialSetupRequirementsTable,
  permissionsTable,
  rolePermissionsTable,
  oauthAccountsTable,
} from './schema';

// PostgreSQL enum exports
export {
  userStatusEnum,
  tokenStatusEnum,
  tokenTypeEnum,
} from './schema';

// Schema types
export type {
  User,
  NewUser,
  RoleEntity,
  NewRoleEntity,
  Token,
  NewToken,
  CredentialSetupSession,
  NewCredentialSetupSession,
  CredentialSetupRequirement,
  NewCredentialSetupRequirement,
  Permission,
  NewPermission,
  RolePermission,
  NewRolePermission,
  OAuthAccount,
  NewOAuthAccount,
} from './schema';

// Shared base schema utilities
export { baseFields, USER_STATUS, TOKEN_STATUS, TOKEN_TYPE } from './shared/BaseSchema';

// ============================================================================
// Seed Factory & Standalone Seeding
// ============================================================================

// Low-level factory (for use with SeedService)
export { authSeed } from './seed';

// High-level standalone seeding function
export { seedAuthData } from './seedAuthData';

// Seed types
export type {
  AuthSeedConfig,
  SeedUserConfig,
  SeedAuthDataConfig,
  SeedAuthDataResult,
} from './seed.types';
