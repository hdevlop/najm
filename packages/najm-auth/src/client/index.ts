// ============================================================================
// najm-auth/client — Client Auth SDK
// ============================================================================
// Zero server dependencies. Native fetch only.
// Works in browser, edge runtimes, Bun, Node 18+.

export { NajmAuthClient, createAuthClient, type HydrateSession } from './NajmAuthClient';
export { FetchClient } from './FetchClient';
export { decodeToken, isTokenExpired, getTokenTTL } from './tokenDecoder';
export { matchPermission, hasRole, hasAnyRole } from './permissions';
export { TabSync } from './tabSync';
export { AuthError } from './types';

export type {
  AuthClientConfig,
  AuthEventMap,
  AuthState,
  AuthUser,
  AuthEvent,
  AuthEventHandler,
  DecodedToken,
  ServerResponse,
  TokenPair,
  RetryConfig,
  RequestOptions,
  SyncPayload,
  TabSyncMessage,
  OAuthProvider,
  OAuthLoginOptions,
} from './types';
