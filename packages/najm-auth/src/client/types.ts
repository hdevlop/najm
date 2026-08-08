// ============================================================================
// najm-auth/client — Type Definitions
// ============================================================================

/**
 * User data from the auth server
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string | null;
  permissions?: string[];
  [key: string]: unknown;
}

/**
 * Full auth state snapshot
 */
export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  roles: string[];
  permissions: string[];
}

/**
 * Decoded JWT payload (client-side, no verification)
 */
export interface DecodedToken {
  userId: string;
  jti?: string;
  sessionVersion?: number;
  roles?: string[];
  permissions?: string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Server response envelope
 */
export interface ServerResponse<T = unknown> {
  data: T;
  message?: string;
  status?: string;
}

/**
 * Token pair from login/refresh (internal — refresh token is httpOnly cookie)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
}

/**
 * Login credentials. `identifier` accepts an email address or a phone number;
 * `email` stays supported for existing callers.
 */
export interface LoginCredentials {
  identifier?: string;
  email?: string;
  password: string;
  /** Persist the auth cookies past the browser closing. */
  rememberMe?: boolean;
  [key: string]: unknown;
}

/** The account must replace its credential before it gets a session. */
export interface CredentialSetupPending {
  nextStep: 'credential_setup';
  setupRequired: true;
  purpose: string;
  expiresAt: string;
}

export interface AuthenticatedLogin {
  nextStep: 'authenticated';
  user: AuthUser;
}

/**
 * Login answer. Branch on `nextStep`: `credential_setup` carries no tokens and
 * leaves the client unauthenticated.
 */
export type LoginResult = AuthenticatedLogin | CredentialSetupPending;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  backoff?: 'exponential' | 'linear';
  baseDelay?: number;
}

/**
 * Auth client configuration
 */
export interface AuthClientConfig {
  /** API base URL (e.g., '/api' or 'https://api.example.com') */
  baseURL: string;
  /** Auth endpoints prefix (default: '/auth') */
  authPrefix?: string;
  /** Proactive refresh at this fraction of token lifetime (default: 0.8) */
  refreshThreshold?: number;
  /** Enable multi-tab sync via BroadcastChannel (default: true) */
  tabSync?: boolean;
  /** BroadcastChannel name (default: 'najm-auth') */
  channelName?: string;
  /** Network retry configuration */
  retry?: RetryConfig;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export type OAuthProvider = 'google';

export interface OAuthLoginOptions {
  /** Same-origin frontend path after OAuth completes. */
  returnTo?: string;
}

/**
 * Auth event types
 */
export interface AuthEventMap {
  login: AuthUser;
  logout: null;
  /** Emitted when server-side logout invalidation fails (state was already cleared) */
  logoutError: unknown;
  tokenRefresh: null;
  sessionExpired: null;
  stateChange: AuthState;
  userUpdated: AuthUser;
}

export type AuthEvent = keyof AuthEventMap;

export type AuthEventHandler<K extends AuthEvent = AuthEvent> = (data: AuthEventMap[K]) => void;

/**
 * Tab sync message types
 */
export type TabSyncMessage =
  | { type: 'logout' }
  | { type: 'sync'; state: SyncPayload };

export interface SyncPayload {
  accessToken: string | null;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
}

/**
 * FetchClient request options
 */
export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
  /** Skip auth header attachment (for public endpoints like /login, /register) */
  skipAuth?: boolean;
  /** @internal Prevents 401-refresh loop after a single retry */
  _retried?: boolean;
}

/**
 * Auth error thrown by the client
 */
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
