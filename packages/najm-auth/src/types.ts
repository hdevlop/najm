// ============================================================================
// types.ts - Auth Plugin Type Definitions
// ============================================================================

import type { ValidationPluginConfig } from 'najm-validation';
import type { RateLimitPluginConfig } from 'najm-rate';
import type { EmailPluginConfig } from 'najm-email';

/**
 * JWT configuration for token generation and verification
 */
export interface JwtConfig {
  /** Secret key for access token signing */
  accessSecret: string;
  /** Access token expiration time (e.g., '15m', '1h') */
  accessExpiresIn: string;
  /** Secret key for refresh token signing */
  refreshSecret: string;
  /** Refresh token expiration time (e.g., '7d', '30d') */
  refreshExpiresIn: string;
}

export interface LockoutConfig {
  /** Failed attempts before the account is temporarily locked */
  maxAttempts: number;
  /** Lockout duration (e.g. '15m') */
  duration: string;
}

/**
 * Session cookie cache configuration.
 * A short-lived, HMAC-signed cookie that caches user/roles/permissions for
 * instant SSR reads (skips the /auth/me round-trip).
 */
export interface SessionCookieConfig {
  /** Cookie name (default: 'najm.session') */
  name: string;
  /** Max age in seconds (default: 300 = 5 min) */
  maxAge: number;
  /** Secret used to HMAC-sign the cookie. Defaults to jwt.accessSecret. */
  secret?: string;
}

export type OAuthProvider = 'google';

export interface GoogleOAuthConfig {
  /** Google OAuth web client ID. Falls back to GOOGLE_CLIENT_ID. */
  clientId?: string;
  /** Google OAuth web client secret. Falls back to GOOGLE_CLIENT_SECRET. */
  clientSecret?: string;
  /**
   * Absolute backend callback URL registered in Google Cloud. Falls back to
   * GOOGLE_CALLBACK_URL, then `${frontendUrl}/api/auth/oauth/google/callback`.
   */
  callbackUrl?: string;
  /** Frontend route that completes the Najm client session. */
  frontendCallbackPath?: string;
  /** Frontend route that receives stable OAuth errors. */
  errorRedirectPath?: string;
  /** Create a Najm user for a new Google identity (default: true). */
  allowSignup?: boolean;
  /** Link an existing user by verified email (default: false). */
  autoLinkVerifiedEmail?: boolean;
  /** Optional Google Workspace hosted-domain allowlist. */
  allowedHostedDomains?: string[];
}

export interface OAuthConfig {
  /**
   * Enable Google with environment defaults (`google: true`), or override
   * individual settings for split-origin deployments and policy changes.
   */
  google?: true | GoogleOAuthConfig;
}

export interface ResolvedGoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendCallbackPath: string;
  errorRedirectPath: string;
  allowSignup: boolean;
  autoLinkVerifiedEmail: boolean;
  allowedHostedDomains: string[];
}

export interface ResolvedOAuthConfig {
  google?: ResolvedGoogleOAuthConfig;
}

/**
 * Complete auth plugin configuration (internal)
 */
export interface AuthConfig {
  /** JWT configuration */
  jwt: JwtConfig;
  /** Refresh token cookie name (default: 'refreshToken') */
  refreshCookieName: string;
  /** Database name to use (default: 'default') */
  database: string;
  /** Cache key prefix for blacklist (default: 'auth:blacklist:') */
  blacklistPrefix: string;
  /** Default role name for new user registration (default: null - no role assigned) */
  defaultRole: string | null;
  /** Frontend URL for password reset links (default: 'http://localhost:3000') */
  frontendUrl: string;
  /** Registration mode: 'active' auto-activates, 'pending' requires admin approval (default: 'active') */
  registrationMode: 'active' | 'pending';
  /** When true, users with emailVerified=false are blocked from logging in (default: false) */
  requireVerifiedEmail: boolean;
  /** Cookie path for the refresh token. Scope to the refresh endpoint to limit exposure (default: '/') */
  refreshCookiePath: string;
  /** Per-account lockout settings */
  lockout: LockoutConfig;
  /** Bcrypt work factor (default: 10) */
  bcryptRounds: number;
  /** Session cookie cache settings */
  session: SessionCookieConfig;
  /** Resolved external identity-provider configuration. */
  oauth?: ResolvedOAuthConfig;
}

/**
 * Auth plugin configuration options
 * Cache is provided by najm-cache plugin (auto-dependency)
 */
/**
 * Auth schema shape (dialect-agnostic)
 * Import from 'najm-auth/pg' or 'najm-auth/sqlite'.
 */
export interface AuthSchema {
  users: any;
  tokens: any;
  roles: any;
  permissions: any;
  rolePermissions: any;
  /** Required when an OAuth provider is enabled. */
  oauthAccounts?: any;
}

export type AuthPluginConfig = {
  /**
   * Database dialect (default: 'pg'). Auto-selects the correct schema.
   * Only RETURNING-capable engines are supported — the auth data layer
   * relies on `.returning()` for every write. MySQL is not supported.
   */
  dialect?: 'pg' | 'sqlite';
  /**
   * Database schema tables (optional, overrides dialect). Use authSchema
   * from 'najm-auth/pg' or 'najm-auth/sqlite'. A custom schema must still be
   * backed by a RETURNING-capable engine (Postgres or SQLite).
   */
  schema?: AuthSchema;
  /** JWT configuration (secrets can be set via env vars) */
  jwt?: Partial<JwtConfig>;
  /** Refresh token cookie name (default: 'refreshToken') */
  refreshCookieName?: string;
  /** Database name to use (default: 'default') */
  database?: string;
  /** Cache key prefix for blacklist (default: 'auth:blacklist:') */
  blacklistPrefix?: string;
  /** Default role name for new user registration (default: null - no role assigned). Set to 'user' for auto-assignment. */
  defaultRole?: string | null;
  /** Frontend URL for password reset links. Falls back to FRONTEND_URL env var, then 'http://localhost:3000' */
  frontendUrl?: string;
  /** Registration mode: 'active' auto-activates new users, 'pending' requires admin approval (default: 'active') */
  registrationMode?: 'active' | 'pending';
  /** Block login for users whose email is not verified (default: false) */
  requireVerifiedEmail?: boolean;
  /** Cookie path for the refresh token (default: '/'). Set e.g. '/auth' to keep it off unrelated routes. */
  refreshCookiePath?: string;
  /** Per-account lockout settings */
  lockout?: Partial<LockoutConfig>;
  /** Bcrypt work factor (default: 10, valid range: 4-31) */
  bcryptRounds?: number;
  /** Session cookie cache settings (optional — sensible defaults applied) */
  session?: Partial<SessionCookieConfig>;
  /** Optional config forwarded to validation() dependency */
  validation?: ValidationPluginConfig;
  /** Optional config forwarded to rateLimit() dependency */
  rateLimit?: RateLimitPluginConfig;
  /** Email transport used by password reset and verification flows. */
  email?: EmailPluginConfig;
  /** AES-256-GCM key for reversible encryption (e.g. API keys). Falls back to NAJM_ENCRYPTION_KEY env var. */
  encryptionKey?: string;
  /** External identity providers. */
  oauth?: OAuthConfig;
};

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  /** Unique token ID for blacklist-based revocation */
  jti: string;
  /**
   * Refresh-token session/family identifier. Present on both refresh tokens
   * (required) and access tokens (so a single family's revocation can reject
   * every access token minted for that session, not just the presented one).
   */
  tokenFamily?: string;
  /** Per-user access token generation version for mass invalidation */
  sessionVersion?: number;
  /** User roles (included for client-side RBAC) */
  roles?: string[];
  /** User permissions (included for client-side PBAC) */
  permissions?: string[];
  exp?: number;
  iat?: number;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
}

/**
 * User data structure for authentication.
 *
 * This is the minimal contract the `USER` ALS token is guaranteed to satisfy
 * on every resolution path (Bearer token, refresh cookie, and the signed
 * session-cookie hot path). Guards and handlers must not rely on fields
 * outside this contract — the DB-backed paths include more, the session
 * cookie does not.
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  status?: string;
  permissions?: string[];
}
