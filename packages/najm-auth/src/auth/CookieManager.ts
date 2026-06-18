import { Service, Inject } from 'najm-core';
import { CookieService } from 'najm-cookies';
import timestring from 'timestring';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';

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
    this.cookieService.set(this.cookieName, refreshToken, { maxAge });
  }

  clearRefreshToken(): void {
    this.cookieService.delete(this.cookieName);
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
   * The cookie is HMAC-signed with the access secret so it is tamper-proof
   * but readable without a database query. Short TTL (5 min) ensures freshness.
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

    try {
      const data = JSON.parse(raw) as SessionCookieData;
      // Extra TTL guard — belt-and-suspenders with cookie maxAge
      const age = Date.now() - data.iat;
      if (age > this.sessionMaxAge * 1000) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Clear the session cookie (on logout, password change, etc.)
   */
  clearSessionCookie(): void {
    this.cookieService.delete(this.sessionCookieName);
  }
}
