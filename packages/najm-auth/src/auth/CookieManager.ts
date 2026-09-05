import { Service, Inject } from 'najm-core';
import { CookieService } from 'najm-cookies';
import timestring from 'timestring';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import {
  parseSessionCookiePayload,
} from '../client/sessionCookie';

export interface SessionCookieData {
  /** Must satisfy the AuthUser contract — see AuthUser in ../types. */
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
    status?: string;
  };
  roles: string[];
  permissions: string[];
  /**
   * Per-user session version captured when the cookie was written. Lets the
   * fast-path reader reject a cookie whose session has since been invalidated
   * (password change/reset, logout-all) without hitting the database.
   */
  sessionVersion: number;
  /**
   * The refresh session this snapshot belongs to, so a single-device logout —
   * which deliberately leaves the per-user version alone — can still reach it.
   */
  tokenFamily: string;
  /** Epoch ms when the cookie was written */
  iat: number;
}

@Service()
export class CookieManager {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @Inject(CookieService) private cookieService!: CookieService;

  private get cookieName(): string {
    return this.config.refreshCookieName || 'refreshToken';
  }

  private get refreshCookiePath(): string {
    return this.config.refreshCookiePath || '/';
  }

  private get sessionCookieName(): string {
    return this.config.session.name;
  }

  private get sessionMaxAge(): number {
    return this.config.session.maxAge;
  }

  private get sessionSecret(): string {
    return this.config.session.secret || this.config.jwt.accessSecret;
  }

  // =========================================================================
  // Refresh Token Cookie
  // =========================================================================

  setRefreshToken(refreshToken: string): void {
    const maxAge = timestring(this.config.jwt.refreshExpiresIn, 's');
    this.cookieService.set(this.cookieName, refreshToken, { maxAge, path: this.refreshCookiePath });
  }

  clearRefreshToken(): void {
    // Path must match how the cookie was set, or the browser won't clear it.
    this.cookieService.delete(this.cookieName, { path: this.refreshCookiePath });
  }

  getRefreshToken(): string | undefined {
    return this.cookieService.get(this.cookieName);
  }

  hasRefreshToken(): boolean {
    return this.cookieService.has(this.cookieName);
  }

  getCookieName(): string {
    return this.cookieName;
  }

  // =========================================================================
  // Session Cookie Cache (HMAC-signed, short-lived)
  // =========================================================================

  /**
   * Write a signed session cookie containing user data, roles, and permissions.
   * The cookie is HMAC-signed with the configured session secret, so its claims
   * can be parsed without a database query. Authorization still verifies the
   * session version and positive family liveness; a valid signature alone is
   * never a revocation check. Short TTL (5 min) bounds claim staleness.
   */
  setSessionCookie(data: Omit<SessionCookieData, 'iat'>): void {
    const payload: SessionCookieData = { ...data, iat: Date.now() };
    this.cookieService.setSigned(
      this.sessionCookieName,
      JSON.stringify(payload),
      this.sessionSecret,
      {
        maxAge: this.sessionMaxAge,
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
      },
    );
  }

  /**
   * Read and verify the session cookie. Returns null if missing, expired,
   * or signature verification fails.
   */
  getSessionCookie(): SessionCookieData | null {
    const raw = this.cookieService.getSigned(
      this.sessionCookieName,
      this.sessionSecret,
    );
    if (!raw) return null;

    return parseSessionCookiePayload(raw, this.sessionMaxAge) as SessionCookieData | null;
  }

  /**
   * Clear the session cookie (on logout, password change, etc.)
   */
  clearSessionCookie(): void {
    this.cookieService.delete(this.sessionCookieName);
  }
}
