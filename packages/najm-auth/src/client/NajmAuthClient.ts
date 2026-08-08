// ============================================================================
// NajmAuthClient — Core Auth Client (framework-agnostic)
// ============================================================================

import { FetchClient } from './FetchClient';
import { decodeToken, getTokenTTL } from './tokenDecoder';
import { matchPermission, hasRole as checkRole, hasAnyRole as checkAnyRole } from './permissions';
import { TabSync } from './tabSync';
import type {
  AuthClientConfig,
  AuthEventMap,
  AuthState,
  AuthUser,
  AuthEvent,
  AuthEventHandler,
  ServerResponse,
  TokenPair,
  SyncPayload,
  TabSyncMessage,
  OAuthProvider,
  OAuthLoginOptions,
  CredentialSetupPending,
  LoginCredentials,
  LoginResult,
} from './types';
import { AuthError } from './types';

/**
 * Najm answers a pending setup either at the top level or inside the standard
 * `{ data }` envelope, depending on how the route is wrapped.
 */
function isCredentialSetupPending(payload: unknown): payload is CredentialSetupPending {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { nextStep?: unknown }).nextStep === 'credential_setup'
  );
}

const INITIAL_STATE: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  roles: [],
  permissions: [],
};

export interface HydrateSession {
  user: AuthUser | null;
  accessToken?: string | null;
  roles?: string[];
  permissions?: string[];
}

export class NajmAuthClient {
  private static readonly MAX_REFRESH_FAILURES = 3;
  private static readonly CIRCUIT_RESET_MS = 60_000;

  private state: AuthState = { ...INITIAL_STATE };
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshCircuitTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private fetchUserPromise: Promise<AuthUser | null> | null = null;
  private refreshFailures = 0;
  private _hydrated = false;

  // Subscriptions (for React useSyncExternalStore)
  private listeners = new Set<(state: AuthState) => void>();
  private eventListeners = new Map<AuthEvent, Set<AuthEventHandler<any>>>();

  // Multi-tab sync
  private tabSync: TabSync | null = null;

  // Public fetch client
  public api: FetchClient;

  private readonly prefix: string;
  private readonly threshold: number;

  constructor(private config: AuthClientConfig) {
    this.prefix = config.authPrefix ?? '/auth';
    this.threshold = config.refreshThreshold ?? 0.8;

    this.api = new FetchClient({
      baseURL: config.baseURL,
      credentials: 'include',
      timeout: config.timeout ?? 30_000,
      getToken: () => this.state.accessToken,
      onUnauthorized: () => this.handleUnauthorized(),
      retry: config.retry,
    });

    // Init tab sync
    if (config.tabSync !== false && typeof BroadcastChannel !== 'undefined') {
      const name = config.channelName ?? 'najm-auth';
      this.tabSync = new TabSync(name, (msg) => this.handleTabMessage(msg));
    }
  }

  // =========================================================================
  // Auth Operations
  // =========================================================================

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const res = await this.api.post<
      | ServerResponse<(TokenPair & { user?: AuthUser }) | CredentialSetupPending>
      | CredentialSetupPending
    >(`${this.prefix}/login`, { body: credentials, skipAuth: true });

    // The server answered, so whatever opened the refresh circuit earlier is
    // no longer true — reset it before either branch.
    this.resetRefreshFailures();

    const setup = isCredentialSetupPending(res)
      ? res
      : isCredentialSetupPending(res.data)
        ? res.data
        : null;

    if (setup) {
      // No tokens, no user, no hydration: the browser holds only an opaque
      // setup cookie until it completes the flow.
      return { ...setup };
    }

    const authenticated = (res as ServerResponse<TokenPair & { user?: AuthUser }>).data;
    this.applyTokens(authenticated);

    if (authenticated.user) {
      this.state = { ...this.state, user: authenticated.user };
      this.notify();
    } else {
      await this.fetchUser();
    }

    this.tabSync?.broadcastSync(this.getSyncPayload());
    this.emit('login', this.state.user!);
    return { nextStep: 'authenticated', user: this.state.user! };
  }

  async register(data: Record<string, unknown>): Promise<AuthUser> {
    const res = await this.api.post<ServerResponse<AuthUser>>(
      `${this.prefix}/register`,
      { body: data, skipAuth: true },
    );
    return res.data;
  }

  getOAuthLoginUrl(provider: OAuthProvider, options: OAuthLoginOptions = {}): string {
    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const authPrefix = this.prefix.startsWith('/') ? this.prefix : `/${this.prefix}`;
    const raw = `${baseURL}${authPrefix}/oauth/${provider}/start`;
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
    const url = new URL(raw, absolute ? undefined : 'https://najm.invalid');
    if (options.returnTo) {
      url.searchParams.set('returnTo', this.validateReturnTo(options.returnTo));
    }
    return absolute ? url.toString() : `${url.pathname}${url.search}`;
  }

  loginWithOAuth(provider: OAuthProvider, options?: OAuthLoginOptions): void {
    if (typeof window === 'undefined') {
      throw new Error('OAuth login requires a browser environment');
    }
    window.location.assign(this.getOAuthLoginUrl(provider, options));
  }

  loginWithGoogle(options?: OAuthLoginOptions): void {
    this.loginWithOAuth('google', options);
  }

  async linkOAuthAccount(provider: OAuthProvider, options: OAuthLoginOptions = {}): Promise<void> {
    const query = options.returnTo
      ? `?${new URLSearchParams({ returnTo: this.validateReturnTo(options.returnTo) })}`
      : '';
    const res = await this.api.post<ServerResponse<{ authorizationUrl: string }>>(
      `${this.prefix}/oauth/${provider}/link${query}`,
    );
    if (!res.data?.authorizationUrl) throw new Error('OAuth provider did not return an authorization URL');
    if (typeof window === 'undefined') throw new Error('OAuth linking requires a browser environment');
    window.location.assign(res.data.authorizationUrl);
  }

  async completeOAuthLogin(): Promise<AuthUser> {
    await this.refresh();
    const user = await this.fetchUser();
    if (!user) throw new Error('OAuth session could not be completed');
    this.tabSync?.broadcastSync(this.getSyncPayload());
    this.emit('login', user);
    return user;
  }

  async logout(): Promise<void> {
    // Optimistic: clear state FIRST for instant UI update.
    // Then await server-side invalidation — callers can still `await logout()`
    // before navigating, but UI reflects the logged-out state immediately.
    this.resetState();
    this.tabSync?.broadcastLogout();
    this.emit('logout', null);

    try {
      await this.api.post(`${this.prefix}/logout`);
    } catch (err) {
      // Server invalidation failed — cache-based blacklist did not record
      // the token revocation. The refresh token will still expire naturally,
      // but the access token remains valid until its TTL elapses.
      // Emit so callers can surface a warning or retry if needed.
      this.emit('logoutError', err);
    }
  }

  async refresh(): Promise<void> {
    if (this.refreshFailures >= NajmAuthClient.MAX_REFRESH_FAILURES) {
      throw new Error('Session expired (circuit open)');
    }

    // Single promise lock — concurrent callers share one request
    if (!this.refreshPromise) {
      this.refreshPromise = this._refreshWithCircuit().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async fetchUser(): Promise<AuthUser | null> {
    if (!this.fetchUserPromise) {
      this.fetchUserPromise = this._doFetchUser().finally(() => {
        this.fetchUserPromise = null;
      });
    }
    return this.fetchUserPromise;
  }

  private async _doFetchUser(): Promise<AuthUser | null> {
    try {
      const res = await this.api.get<ServerResponse<AuthUser>>(`${this.prefix}/me`);
      this.state = { ...this.state, user: res.data };
      this.notify();
      this.emit('userUpdated', res.data);
      return res.data;
    } catch {
      return null;
    }
  }

  async forgotPassword(data: { email: string }): Promise<void> {
    await this.api.post(`${this.prefix}/forgot-password`, { body: data, skipAuth: true });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.api.post(`${this.prefix}/change-password`, { body: data });
    this.resetState();
    this.tabSync?.broadcastLogout();
    this.emit('logout', null);
  }

  async resetPassword(data: { token: string; newPassword: string }): Promise<void> {
    await this.api.post(`${this.prefix}/reset-password`, { body: data, skipAuth: true });
  }

  // =========================================================================
  // Permissions (decoded from JWT — instant, no round-trip)
  // =========================================================================

  can(permission: string): boolean {
    return matchPermission(this.state.permissions, permission);
  }

  hasRole(role: string): boolean {
    return checkRole(this.state.roles, role);
  }

  hasAnyRole(roles: string[]): boolean {
    return checkAnyRole(this.state.roles, roles);
  }

  hasPermission(permission: string): boolean {
    return this.can(permission);
  }

  // =========================================================================
  // State Access
  // =========================================================================

  getUser(): AuthUser | null {
    return this.state.user;
  }

  getAccessToken(): string | null {
    return this.state.accessToken;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  getState(): AuthState {
    return this.state;
  }

  // =========================================================================
  // Hydration (SSR)
  // =========================================================================

  /**
   * Hydrate the client with a session resolved server-side.
   * Use to skip the initial loading flicker on SSR-rendered pages.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  hydrate(session: HydrateSession | null): void {
    if (this._hydrated) return;
    this._hydrated = true;
    this.resetRefreshFailures();

    if (!session || !session.user) {
      // Authoritative "no session" from the server — skip the boot fetch.
      this.state = { ...INITIAL_STATE };
      this.notify();
      return;
    }

    this.state = {
      ...this.state,
      user: session.user,
      accessToken: session.accessToken ?? null,
      isAuthenticated: true,
      isLoading: false,
      roles: session.roles ?? (session.user.role ? [session.user.role] : []),
      permissions: session.permissions ?? session.user.permissions ?? [],
    };

    if (session.accessToken) {
      const decoded = decodeToken(session.accessToken);
      if (decoded) {
        if (!session.roles && decoded.roles) this.state.roles = decoded.roles;
        if (!session.permissions && decoded.permissions) this.state.permissions = decoded.permissions;
        this.scheduleRefresh(decoded);
      }
    }

    this.notify();
  }

  isHydrated(): boolean {
    return this._hydrated;
  }

  /**
   * A fresh client with the same config — unhydrated, and without tab sync.
   *
   * Server rendering needs one client per request. A single process serves
   * every user, so the hydration latch on a shared client would otherwise pin
   * every later render to the first request's session.
   */
  fork(): NajmAuthClient {
    return new NajmAuthClient({ ...this.config, tabSync: false });
  }

  // =========================================================================
  // Events
  // =========================================================================

  on<K extends AuthEvent>(event: K, handler: AuthEventHandler<K>): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
    this.eventListeners.get(event)!.add(handler);
  }

  off<K extends AuthEvent>(event: K, handler: AuthEventHandler<K>): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  // =========================================================================
  // Subscribe (for React useSyncExternalStore)
  // =========================================================================

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  destroy(): void {
    this.clearRefreshTimer();
    this.clearRefreshCircuitTimer();
    this.tabSync?.destroy();
    this.tabSync = null;
    this.refreshFailures = 0;
    this.state = { ...INITIAL_STATE };
    this.listeners.clear();
    this.eventListeners.clear();
  }

  // =========================================================================
  // Internals
  // =========================================================================

  private async _refreshWithCircuit(): Promise<void> {
    try {
      await this._doRefresh();
      this.resetRefreshFailures();
    } catch (err) {
      const shouldOpenCircuit = this.registerRefreshFailure(err);
      if (shouldOpenCircuit) {
        this.resetState();
        this.emit('sessionExpired', null);
        if (err instanceof AuthError && err.status === 401) {
          throw new Error('Session expired');
        }
        throw new Error('Session expired (circuit open)');
      }
      throw err;
    }
  }

  private async _doRefresh(): Promise<void> {
    const res = await this.api.post<ServerResponse<TokenPair>>(
      `${this.prefix}/refresh`,
      { skipAuth: true },
    );
    this.applyTokens(res.data);
    this.tabSync?.broadcastSync(this.getSyncPayload());
    this.emit('tokenRefresh', null);
  }

  private async handleUnauthorized(): Promise<string | null> {
    try {
      await this.refresh();
      return this.state.accessToken;
    } catch {
      return null;
    }
  }

  private applyTokens(tokens: TokenPair): void {
    this.resetRefreshFailures();
    const decoded = decodeToken(tokens.accessToken);
    this.state = {
      ...this.state,
      accessToken: tokens.accessToken,
      isAuthenticated: true,
      isLoading: false,
      roles: decoded?.roles ?? [],
      permissions: decoded?.permissions ?? [],
    };
    if (decoded) this.scheduleRefresh(decoded);
    this.notify();
  }

  private scheduleRefresh(decoded: { exp?: number }): void {
    this.clearRefreshTimer();
    // Only meaningful in a live tab. On a server it would hold one user's
    // token in process memory and fire a credential-less refresh.
    if (typeof window === 'undefined') return;
    const ttl = getTokenTTL(decoded as any);
    if (ttl <= 0) return;

    const delay = ttl * this.threshold * 1000;
    this.refreshTimer = setTimeout(() => this.refresh().catch(() => {}), delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private clearRefreshCircuitTimer(): void {
    if (this.refreshCircuitTimer) {
      clearTimeout(this.refreshCircuitTimer);
      this.refreshCircuitTimer = null;
    }
  }

  private resetRefreshFailures(): void {
    this.refreshFailures = 0;
    this.clearRefreshCircuitTimer();
  }

  private registerRefreshFailure(err: unknown): boolean {
    if (err instanceof AuthError && err.status === 401) {
      this.refreshFailures = NajmAuthClient.MAX_REFRESH_FAILURES;
    } else {
      this.refreshFailures += 1;
    }

    if (this.refreshFailures >= NajmAuthClient.MAX_REFRESH_FAILURES) {
      this.clearRefreshCircuitTimer();
      this.refreshCircuitTimer = setTimeout(() => {
        this.refreshFailures = 0;
        this.refreshCircuitTimer = null;
      }, NajmAuthClient.CIRCUIT_RESET_MS);
      return true;
    }

    return false;
  }

  private resetState(): void {
    this.clearRefreshTimer();
    this.state = { ...INITIAL_STATE };
    this.notify();
  }

  private getSyncPayload(): SyncPayload {
    return {
      accessToken: this.state.accessToken,
      user: this.state.user,
      roles: this.state.roles,
      permissions: this.state.permissions,
      isAuthenticated: this.state.isAuthenticated,
    };
  }

  private handleTabMessage(msg: TabSyncMessage): void {
    switch (msg.type) {
      case 'logout':
        this.clearRefreshTimer();
        this.state = { ...INITIAL_STATE };
        this.notify();
        this.emit('logout', null);
        break;
      case 'sync':
        this.state = {
          ...this.state,
          accessToken: msg.state.accessToken,
          user: msg.state.user,
          roles: msg.state.roles,
          permissions: msg.state.permissions,
          isAuthenticated: msg.state.isAuthenticated,
          isLoading: false,
        };
        if (msg.state.accessToken) {
          const decoded = decodeToken(msg.state.accessToken);
          if (decoded) this.scheduleRefresh(decoded);
        }
        this.notify();
        break;
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  private emit<K extends AuthEvent>(event: K, data: AuthEventMap[K]): void {
    this.eventListeners.get(event)?.forEach((h) => h(data));
    if (event !== 'stateChange') {
      this.eventListeners.get('stateChange')?.forEach((h) => h(this.state));
    }
  }

  private validateReturnTo(value: string): string {
    const candidate = value.trim();
    if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
      throw new Error('returnTo must be a same-origin path');
    }
    const base = new URL('https://najm.invalid');
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin || parsed.username || parsed.password) {
      throw new Error('returnTo must be a same-origin path');
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
}

/**
 * Factory function to create an auth client.
 */
export function createAuthClient(config: AuthClientConfig): NajmAuthClient {
  return new NajmAuthClient(config);
}
