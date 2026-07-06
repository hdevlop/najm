// ============================================================================
// AuthPlugin.ts - Auth Plugin Factory (Fluent API)
// ============================================================================

import { Err, plugin } from 'najm-core';
import { cache } from 'najm-cache';
import { AUTH_CONFIG, AUTH_ENCRYPTION_KEY, AUTH_SCHEMA } from './auth.tokens';
import type { AuthPluginConfig, AuthConfig, AuthSchema } from './types';
import { authSchema as pgSchema } from './schema/pg';
import { authSchema as sqliteSchema } from './schema/sqlite';

import * as AuthModule from './auth';
import * as UserModule from './users';
import * as RoleModule from './roles';
import * as PermissionModule from './permissions';
import * as TokenModule from './tokens';
import { ScopeContext } from './ownership';
import { cookies } from 'najm-cookies';
import { i18n, I18N_CONTRIBUTIONS } from 'najm-i18n';
import { guards } from 'najm-guard';
import { validation } from 'najm-validation';
import { rateLimit } from 'najm-rate';
import { email } from 'najm-email';
import { AUTH_LOCALES } from './locales';

const DEFAULT_JWT = {
  accessSecret: process.env.JWT_ACCESS_SECRET || '',
  accessExpiresIn: process.env.ACCESS_EXPIRES_IN || '1h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || '',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
};

const mergeConfig = (config?: AuthPluginConfig): AuthConfig => {
  const bcryptRounds = config?.bcryptRounds ?? 10;
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 4 || bcryptRounds > 31) {
    throw new Error('auth.bcryptRounds must be an integer between 4 and 31');
  }

  const finalConfig: AuthConfig = {
    jwt: {
      ...DEFAULT_JWT,
      ...config?.jwt,
    },
    refreshCookieName: config?.refreshCookieName ?? 'refreshToken',
    database: config?.database ?? 'default',
    blacklistPrefix: config?.blacklistPrefix ?? 'auth:blacklist:',
    defaultRole: config?.defaultRole ?? null,
    frontendUrl: config?.frontendUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000',
    registrationMode: config?.registrationMode ?? 'active',
    requireVerifiedEmail: config?.requireVerifiedEmail ?? false,
    refreshCookiePath: config?.refreshCookiePath ?? '/',
    lockout: {
      maxAttempts: config?.lockout?.maxAttempts ?? 5,
      duration: config?.lockout?.duration ?? '15m',
    },
    bcryptRounds,
    session: {
      name: config?.session?.name ?? 'najm.session',
      maxAge: config?.session?.maxAge ?? 300,
      secret: config?.session?.secret, // fallback to jwt.accessSecret at use site
    },
  };

  if (!finalConfig.jwt.accessSecret) {
    throw Err.configRequired('auth', 'JWT_ACCESS_SECRET');
  }
  if (!finalConfig.jwt.refreshSecret) {
    throw Err.configRequired('auth', 'JWT_REFRESH_SECRET');
  }

  return finalConfig;
};

/**
 * Select auth schema based on dialect
 */
const selectSchema = (config?: AuthPluginConfig): AuthSchema => {
  // Explicit schema takes precedence
  if (config?.schema) return config.schema;

  // Auto-select based on dialect
  const dialect = config?.dialect ?? 'pg';
  switch (dialect) {
    case 'sqlite':
      return sqliteSchema;
    case 'pg':
    default:
      return pgSchema;
  }
};

export const auth = (config?: AuthPluginConfig) =>
  plugin('auth')
    .version('1.0.0')
    .depends(
      cache(),
      cookies(),
      i18n(),
      guards(),
      validation(config?.validation),
      rateLimit(config?.rateLimit),
      email()
    )
    .requires('database')
    .contributes(I18N_CONTRIBUTIONS, AUTH_LOCALES)
    .services(
      AuthModule.AUTH_MODULE,
      UserModule,
      RoleModule,
      PermissionModule,
      TokenModule,
      ScopeContext,
    )
    .config(AUTH_CONFIG, mergeConfig(config))
    .set(AUTH_SCHEMA, selectSchema(config))
    .set(AUTH_ENCRYPTION_KEY, config?.encryptionKey ?? null)
    .build();
