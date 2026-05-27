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
} from './types';
import { AuthError } from './types';

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

  async login(credentials: { email: string; password: string }): Promise<AuthUser> {
    const res = await this.api.post<ServerResponse<TokenPair & { user?: AuthUser }>>(
      `${this.prefix}/login`,
      { body: credentials, skipAuth: true },
    );
    this.applyTokens(res.data);

    if (res.data.user) {
      this.state = { ...this.state, user: res.data.user };
      this.notify();
    } else {
      await this.fetchUser();
    }

    this.tabSync?.broadcastSync(this.getSyncPayload());
    this.emit('login', this.state.user!);
    return this.state.user!;
  }

  async register(data: Record<string, unknown>): Promise<AuthUser> {
    const res = await this.api.post<ServerResponse<AuthUser>>(
      `${this.prefix}/register`,
      { body: data, skipAuth: true },
    );
    return res.data;
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
}

/**
 * Factory function to create an auth client.
 */
export function createAuthClient(config: AuthClientConfig): NajmAuthClient {
  return new NajmAuthClient(config);
}
