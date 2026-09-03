// Core framework surface
export * from 'najm-core';

// Common plugin factories and decorators
export { guards, GuardPlugin, createGuard, composeGuards } from 'najm-guard';
export { Validate, validation } from 'najm-validation';
export { cache, CacheService, MemoryDriver, RedisDriver, isRedisAvailable } from 'najm-cache';
export { rateLimit, RateLimit, SkipRateLimit, RateLimitService } from 'najm-rate';
export { cors, CorsService } from 'najm-cors';
export { cookies, Cookies, Cookie, CookieService, getCookiesOptions } from 'najm-cookies';
export { i18n, I18n, I18nService, t } from 'najm-i18n';
export { mcp, Tool, McpTool, ToolGroup } from 'najm-mcp';
export { events, Events, On, EventService } from 'najm-event';
export { database, DB, Transaction, DatabaseService, TransactionService, SeedService } from 'najm-database';
export { storage, StorageService, StorageController, StorageMcpTools, StorageStudioController, AuditService } from 'najm-storage';
export { email, EmailService } from 'najm-email';
export { auth, authSchema, authSeed, seedAuthData } from 'najm-auth';

// Frequently used auth guards and policy helpers
export {
  isAuth,
  AuthGuard,
  Can,
  PermissionGuard,
  Role,
  RoleGuard,
  isAdmin,
  isAdministrator,
  defineRoles,
  own,
  join,
  where,
  Policy,
  CanList,
  CanRead,
  CanCreate,
  CanUpdate,
  CanDelete,
  configureOwnership,
} from 'najm-auth';

// Common token/config exports
export {
  USER,
  OWNER,
  INFO,
  DATA,
  FILTER,
  ROLE,
  PERMISSIONS,
  GUARD_PARAMS,
} from 'najm-guard';

export {
  AUTH_CONFIG,
  AUTH_SCHEMA,
  AUTH_USER,
  AUTH_ROLE,
  AUTH_PERMISSIONS,
} from 'najm-auth';

// Common types
export type {
  GuardMetadata,
  CreateGuardOptions,
  GuardPluginConfig,
  GuardResult,
  GuardReturnType,
} from 'najm-guard';

export type { ValidationPluginConfig, ValidateInput } from 'najm-validation';
export type { CachePluginConfig, CacheConfig, RedisOptions } from 'najm-cache';
export type { TimeWindow, KeyStrategy, CustomRateLimitKey, RateLimitKeyContext, RateLimitOptions, RateLimitPluginConfig } from 'najm-rate';
export type { CorsPluginConfig } from 'najm-cors';
export type { CookiePluginConfig, CookieOptions } from 'najm-cookies';
export type { I18nPluginConfig } from 'najm-i18n';
export type { McpConfig, RegisteredTool } from 'najm-mcp';
export type { DatabaseConfig, TransactionalOptions } from 'najm-database';
export type { StorageConfig } from 'najm-storage';
export type { EmailConfig, EmailPluginConfig, EmailMessage, SendResult } from 'najm-email';
export type {
  AuthConfig,
  AuthPluginConfig,
  AuthUser,
  JwtPayload,
  TokenPair,
  GoogleOAuthConfig,
  OAuthConfig,
  OAuthProvider,
} from 'najm-auth';
