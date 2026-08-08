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
import { OAUTH_MODULE } from './oauth';
import { CREDENTIAL_SETUP_MODULE } from './credentialSetup';
import {
  DEFAULT_CREDENTIAL_SETUP_COOKIE_NAME,
  DEFAULT_CREDENTIAL_SETUP_TTL_MS,
} from './credentialSetup/CredentialSetupService';
import { defaultCredentialSetupPasswordSchema } from './credentialSetup/CredentialSetupDto';
import type { ResolvedCredentialSetupConfig } from './credentialSetup/types';
import { createIdentityResolver } from './identity/resolver';

const DEFAULT_JWT = {
  accessSecret: process.env.JWT_ACCESS_SECRET || '',
  accessExpiresIn: process.env.ACCESS_EXPIRES_IN || '1h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || '',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
};

const validateFrontendPath = (value: string, name: string): string => {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    throw new Error(`${name} must be a same-origin path starting with a single '/'`);
  }
  return value;
};

const resolveGoogleConfig = (config?: AuthPluginConfig) => {
  const configuredGoogle = config?.oauth?.google;
  if (!configuredGoogle) return undefined;
  const google = configuredGoogle === true ? {} : configuredGoogle;

  const clientId = google.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = google.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET ?? '';
  if (!clientId) throw Err.configRequired('auth.oauth.google', 'GOOGLE_CLIENT_ID');
  if (!clientSecret) throw Err.configRequired('auth.oauth.google', 'GOOGLE_CLIENT_SECRET');

  const frontendUrl = config?.frontendUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const callbackUrl = google.callbackUrl
    ?? process.env.GOOGLE_CALLBACK_URL
    ?? `${frontendUrl.replace(/\/$/, '')}/api/auth/oauth/google/callback`;

  let callback: URL;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new Error('auth.oauth.google.callbackUrl must be an absolute URL');
  }
  const local = callback.hostname === 'localhost'
    || callback.hostname === '127.0.0.1'
    || callback.hostname === '[::1]'
    || callback.hostname === '::1';
  if (callback.protocol !== 'https:' && !(local && callback.protocol === 'http:')) {
    throw new Error('auth.oauth.google.callbackUrl must use HTTPS (HTTP is allowed only for localhost)');
  }

  return {
    clientId,
    clientSecret,
    callbackUrl: callback.toString(),
    frontendCallbackPath: validateFrontendPath(
      google.frontendCallbackPath ?? '/auth/oauth/callback',
      'auth.oauth.google.frontendCallbackPath',
    ),
    errorRedirectPath: validateFrontendPath(
      google.errorRedirectPath ?? '/login',
      'auth.oauth.google.errorRedirectPath',
    ),
    allowSignup: google.allowSignup ?? true,
    autoLinkVerifiedEmail: google.autoLinkVerifiedEmail ?? false,
    allowedHostedDomains: [...new Set((google.allowedHostedDomains ?? [])
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean))],
  };
};

const resolveCredentialSetupConfig = (
  config?: AuthPluginConfig,
): ResolvedCredentialSetupConfig => {
  const password = config?.credentialSetup?.password ?? {};
  const ttlMs = password.ttlMs ?? DEFAULT_CREDENTIAL_SETUP_TTL_MS;
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 24 * 60 * 60 * 1_000) {
    throw new Error('auth.credentialSetup.password.ttlMs must be an integer between 1000 and 86400000');
  }

  return {
    password: {
      ttlMs,
      cookieName: password.cookieName?.trim() || DEFAULT_CREDENTIAL_SETUP_COOKIE_NAME,
      passwordSchema: password.passwordSchema ?? defaultCredentialSetupPasswordSchema,
    },
  };
};

export const resolveAuthConfig = (config?: AuthPluginConfig): AuthConfig => {
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
    identity: {
      resolve: createIdentityResolver(config?.identity),
    },
    session: {
      name: config?.session?.name ?? 'najm.session',
      maxAge: config?.session?.maxAge ?? 300,
      // Keep Edge/server readers aligned with the documented secret order.
      // CookieManager falls back to jwt.accessSecret when this is undefined.
      secret: config?.session?.secret ?? process.env.NAJM_SESSION_SECRET,
    },
    credentialSetup: resolveCredentialSetupConfig(config),
    oauth: {
      google: resolveGoogleConfig(config),
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
export const selectAuthSchema = (config?: AuthPluginConfig): AuthSchema => {
  // Explicit schema takes precedence
  if (config?.schema) {
    if (config.oauth?.google && !config.schema.oauthAccounts) {
      throw new Error('auth.schema.oauthAccounts is required when Google OAuth is enabled');
    }
    // The credential-setup flow is always mounted, so its two tables are part
    // of the contract rather than an opt-in. Failing at startup beats failing
    // at the first provisioned user's login.
    if (!config.schema.credentialSetupSessions) {
      throw new Error('auth.schema.credentialSetupSessions is required — re-export it from najm-auth/pg or najm-auth/sqlite');
    }
    if (!config.schema.credentialSetupRequirements) {
      throw new Error('auth.schema.credentialSetupRequirements is required — re-export it from najm-auth/pg or najm-auth/sqlite');
    }
    return config.schema;
  }

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
      email(config?.email)
    )
    .requires('database')
    .contributes(I18N_CONTRIBUTIONS, AUTH_LOCALES)
    .services(
      AuthModule.AUTH_MODULE,
      OAUTH_MODULE,
      UserModule,
      RoleModule,
      PermissionModule,
      TokenModule,
      CREDENTIAL_SETUP_MODULE,
      ScopeContext,
    )
    .config(AUTH_CONFIG, resolveAuthConfig(config))
    .set(AUTH_SCHEMA, selectAuthSchema(config))
    .set(AUTH_ENCRYPTION_KEY, config?.encryptionKey ?? null)
    .build();
