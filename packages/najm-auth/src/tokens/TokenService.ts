// TokenService.ts
import { Injectable, Inject } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { CacheService } from 'najm-cache';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { TokenRepository } from './TokenRepository';
import timestring from 'timestring';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig, JwtPayload } from '../types';
import { CookieManager } from '../auth/CookieManager';
import { Err } from 'najm-core';

@Injectable()
export class TokenService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @I18n("auth") private t!: TFn;

  constructor(
    private tokenRepository: TokenRepository,
    private cookieManager: CookieManager,
    private cache: CacheService
  ) { }

  /**
   * Get blacklist key prefix
   */
  private get blacklistPrefix(): string {
    return this.config.blacklistPrefix ?? 'auth:blacklist:';
  }

  private get resetTokenPrefix(): string {
    return 'auth:reset:';
  }

  private get sessionVersionPrefix(): string {
    return 'auth:session-version:';
  }

  private sessionVersionKey(userId: string): string {
    return `${this.sessionVersionPrefix}${userId}`;
  }

  private accessTokenTtlMs(): number {
    return timestring(this.config.jwt.accessExpiresIn, 'ms');
  }

  private expiresAt(expiresIn: string): number {
    return Math.floor((Date.now() + timestring(expiresIn, 'ms')) / 1000);
  }

  private async getCacheValues(keys: string[]): Promise<Array<string | null>> {
    const cache = this.cache as CacheService & { getMany?: (keys: string[]) => Promise<Array<string | null>> };
    if (cache.getMany) return cache.getMany(keys);
    return Promise.all(keys.map((key) => cache.get(key)));
  }

  private parseSessionVersion(raw: string | null): number {
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  // ============ TOKEN VALIDATION ============

  extractAccessToken(authorization: string): string {
    if (authorization?.startsWith('Bearer ')) {
      return authorization.split(' ')[1];
    }
    Err(this.t('errors.tokenMissing'));
  }

  /**
   * Verify access token and check blacklist
   * Throws error if token is invalid, expired, or blacklisted
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, this.config.jwt.accessSecret) as JwtPayload;
    } catch {
      Err(this.t('errors.tokenVerificationFailed'));
    }

    const sessionKey = this.sessionVersionKey(payload.userId);
    let activeSessionVersion: number;

    if (payload.jti) {
      const [blacklisted, sessionVersion] = await this.getCacheValues([
        `${this.blacklistPrefix}${payload.jti}`,
        sessionKey,
      ]);
      if (blacklisted !== null) {
        Err(this.t('errors.tokenRevoked'));
      }
      activeSessionVersion = this.parseSessionVersion(sessionVersion);
    } else {
      activeSessionVersion = this.parseSessionVersion(await this.cache.get(sessionKey));
    }

    const tokenSessionVersion = payload.sessionVersion ?? 0;
    if (tokenSessionVersion !== activeSessionVersion) {
      Err(this.t('errors.tokenRevoked'));
    }

    return payload;
  }

  verifyRefreshToken(token: string): string {
    try {
      const decoded = jwt.verify(token, this.config.jwt.refreshSecret) as JwtPayload & { type?: string };
      if (decoded.type && decoded.type !== 'refresh') {
        Err(this.t('errors.tokenVerificationFailed'));
      }
      return decoded.userId;
    } catch {
      Err(this.t('errors.tokenVerificationFailed'));
    }
  }

  private static readonly PREVIOUS_GRACE_SECONDS = 120;

  /**
   * Read the refresh cookie and return the userId it belongs to.
   * Validates against current/previous token state with bounded recovery.
   * Throws if the cookie is missing, invalid, or outside the grace window.
   *
   * Intentionally side-effect-free: unlike refreshTokens(), a mismatch here
   * does NOT revoke the suspect family. This is a read path (e.g. GET
   * /auth/me) — a stray stale cookie on a read must not be able to destroy
   * the active session. Reuse detection and revocation belong to the
   * rotation path only.
   */
  async resolveUserFromCookie(): Promise<string> {
    const refreshToken = this.cookieManager.getRefreshToken();
    if (!refreshToken) {
      Err(this.t('errors.refreshTokenMissing'));
    }
    const userId = this.verifyRefreshToken(refreshToken);

    const stored = await this.tokenRepository.getRefreshTokenWithFamily(userId);
    if (!stored) {
      Err(this.t('errors.refreshTokenInvalid'));
    }

    const presentedHash = this.hashToken(refreshToken);

    if (presentedHash === stored.token) {
      return userId;
    }

    const canRecover =
      stored.previousHash &&
      presentedHash === stored.previousHash &&
      stored.previousValidUntil &&
      new Date(stored.previousValidUntil).getTime() > Date.now() &&
      !stored.previousUsedAt;

    if (canRecover) {
      return userId;
    }

    Err(this.t('errors.refreshTokenInvalid'));
  }

  // ============ USER RETRIEVAL (MAIN METHOD) ============

  async getUser(auth: string) {
    if (!auth) return null;

    const token = this.extractAccessToken(auth);
    const { userId } = await this.verifyAccessToken(token);

    return this.getUserById(userId);
  }

  async getUserById(userId: string) {
    const cacheKey = `auth:user:${userId}`;
    if (typeof (this.cache as any).getOrSet === 'function') {
      return this.cache.getOrSet(cacheKey, () => this.tokenRepository.getUser(userId), 30_000);
    }

    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const user = await this.tokenRepository.getUser(userId);
    if (user) await this.cache.set(cacheKey, JSON.stringify(user), 30_000);
    return user;
  }

  // ============ TOKEN GENERATION ============

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getTokenExpire(token: string): number | undefined {
    return (jwt.decode(token) as JwtPayload | null)?.exp;
  }

  decodeAccessToken(token: string): JwtPayload | null {
    return jwt.decode(token) as JwtPayload | null;
  }

  private async signAccessToken(data: {
    userId: string;
    roles?: string[];
    permissions?: string[];
  }): Promise<{ token: string; expiresAt: number }> {
    const jti = nanoid(16);
    const sessionVersion = await this.getUserSessionVersion(data.userId);
    const expiresAt = this.expiresAt(this.config.jwt.accessExpiresIn);
    if (sessionVersion > 0) {
      await this.cache.set(this.sessionVersionKey(data.userId), String(sessionVersion), this.accessTokenTtlMs());
    }
    const token = jwt.sign(
      { ...data, jti, sessionVersion, exp: expiresAt },
      this.config.jwt.accessSecret,
    );
    return { token, expiresAt };
  }

  /**
   * Generate access token with unique jti for blacklist support.
   * Includes roles/permissions for client-side RBAC/PBAC.
   */
  async generateAccessToken(data: { userId: string; roles?: string[]; permissions?: string[] }): Promise<string> {
    return (await this.signAccessToken(data)).token;
  }

  /**
   * Generate refresh token with unique jti
   */
  private signRefreshToken(data: { userId: string }): { token: string; expiresAt: number } {
    const jti = nanoid(16);
    const expiresAt = this.expiresAt(this.config.jwt.refreshExpiresIn);
    const token = jwt.sign(
      { ...data, jti, type: 'refresh', exp: expiresAt },
      this.config.jwt.refreshSecret,
    );
    return { token, expiresAt };
  }

  generateRefreshToken(data: { userId: string }): string {
    return this.signRefreshToken(data).token;
  }

  async generateTokens(userId: string, tokenFamily?: string) {
    const family = tokenFamily ?? nanoid(16);

    const { roleName, permissions } = await this.tokenRepository.getRoleAndPermissions(userId);

    const accessTokenData = {
      userId,
      roles: roleName ? [roleName] : [],
      permissions: permissions ?? [],
    };
    const access = await this.signAccessToken(accessTokenData);
    const refresh = this.signRefreshToken({ userId });

    await this.storeRefreshToken(userId, refresh.token, family);

    return {
      userId,
      roles: accessTokenData.roles,
      permissions: accessTokenData.permissions,
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  // ============ TOKEN BLACKLIST (Cache) ============

  /**
   * Blacklist an access token by its jti
   * Token will be rejected until it naturally expires
   */
  async blacklistToken(jti: string, expiresInSeconds: number): Promise<void> {
    const key = `${this.blacklistPrefix}${jti}`;
    await this.cache.set(key, '1', expiresInSeconds * 1000); // Convert to ms
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const key = `${this.blacklistPrefix}${jti}`;
    return this.cache.exists(key);
  }

  /**
   * Blacklist the current access token (for logout)
   * Extracts jti and remaining TTL from the token
   */
  async blacklistCurrentToken(token: string): Promise<void> {
    try {
      // Decode without verification to get jti and exp
      const decoded = jwt.decode(token) as JwtPayload | null;

      if (!decoded?.jti) {
        // Token doesn't have jti (old token format), skip blacklisting
        return;
      }

      // Calculate remaining TTL
      const now = Math.floor(Date.now() / 1000);
      const exp = decoded.exp ?? (now + 60);
      const ttl = Math.max(60, exp - now);

      await this.blacklistToken(decoded.jti, ttl);
    } catch {
      // If we can't decode the token, just skip blacklisting
      // The token is likely already invalid
    }
  }

  // ============ REFRESH TOKEN ============

  /**
   * Store hashed refresh token in database for security
   * This prevents token theft in case of database breach
   */
  async storeRefreshToken(userId: string, refreshToken: string, tokenFamily: string): Promise<void> {
    const expireInSecond = timestring(this.config.jwt.refreshExpiresIn, 's');
    const hashedToken = this.hashToken(refreshToken);

    const existing = await this.tokenRepository.getRefreshTokenWithFamily(userId);
    const previousHash = existing?.token ?? null;
    const previousValidUntil = previousHash
      ? new Date(Date.now() + TokenService.PREVIOUS_GRACE_SECONDS * 1000).toISOString()
      : null;

    await this.tokenRepository.storeRefreshToken({
      userId,
      token: hashedToken,
      tokenFamily,
      expiresAt: new Date(Date.now() + expireInSecond * 1000).toISOString(),
      previousHash,
      previousValidUntil,
      previousUsedAt: null,
    });
  }

  /**
   * Refresh tokens with secure token comparison
   * Compares provided token with hashed version in database
   */
  async refreshTokens() {
    const refreshToken = this.cookieManager.getRefreshToken();
    if (!refreshToken) {
      Err(this.t('errors.refreshTokenMissing'));
    }

    const userId = this.verifyRefreshToken(refreshToken);
    const stored = await this.tokenRepository.getRefreshTokenWithFamily(userId);

    if (!stored) {
      Err(this.t('errors.refreshTokenInvalid'));
    }

    const presentedHash = this.hashToken(refreshToken);

    if (presentedHash === stored.token) {
      return this.generateTokens(userId, stored.tokenFamily ?? undefined);
    }

    const canRecover =
      stored.previousHash &&
      presentedHash === stored.previousHash &&
      stored.previousValidUntil &&
      new Date(stored.previousValidUntil).getTime() > Date.now() &&
      !stored.previousUsedAt;

    if (canRecover) {
      // Atomically claim the grace slot keyed on the presented previous hash.
      const claimed = await this.tokenRepository.markPreviousUsed(userId, presentedHash);
      if (!claimed?.length) {
        // Lost the race: a concurrent request already claimed the grace slot
        // and rotated. Do not revoke — the winner's session is legitimate.
        Err(this.t('errors.refreshTokenInvalid'));
      }
      return this.generateTokens(userId, stored.tokenFamily ?? undefined);
    }

    await this.revokeSuspectRefreshFamily(userId, stored.tokenFamily ?? null);
    Err(this.t('errors.refreshTokenInvalid'));
  }

  async revokeToken(userId: string) {
    return this.tokenRepository.revokeToken(userId);
  }

  async invalidateUserAccessTokens(userId: string): Promise<number> {
    const nextVersion = (await this.getUserSessionVersion(userId)) + 1;
    await this.cache.set(this.sessionVersionKey(userId), String(nextVersion), this.accessTokenTtlMs());
    await this.cache.del(`auth:user:${userId}`);
    return nextVersion;
  }

  async getUserFromCookie() {
    const userId = await this.resolveUserFromCookie();
    const user = await this.getUserById(userId);
    if (!user) {
      Err(this.t('errors.refreshTokenInvalid'));
    }
    return user;
  }

  private async revokeSuspectRefreshFamily(userId: string, tokenFamily: string | null): Promise<void> {
    await this.invalidateUserAccessTokens(userId);
    if (tokenFamily) {
      await this.tokenRepository.revokeByFamily(tokenFamily);
      return;
    }
    await this.revokeToken(userId);
  }

  /**
   * Logout user - blacklist access token and revoke refresh token
   */
  async logout(userId: string, authorization?: string): Promise<void> {
    // Blacklist current access token if authorization header present
    if (authorization) {
      try {
        const accessToken = this.extractAccessToken(authorization);
        await this.blacklistCurrentToken(accessToken);
      } catch {
        // Token extraction failed, skip blacklisting
      }
    }

    await this.invalidateUserAccessTokens(userId);

    // Revoke refresh token from database
    await this.revokeToken(userId);
  }

  // ============ PASSWORD RESET TOKENS ============

  /**
   * Generate secure password reset token
   * Returns both the plain token (to send via email) and userId for identification
   */
  async generateResetToken(userId: string): Promise<{ token: string; userId: string }> {
    const jti = nanoid(16);
    const resetData = {
      userId,
      type: 'reset',
      jti,
      timestamp: Date.now(),
    };

    // Generate token with short expiration (1 hour)
    const token = jwt.sign(resetData, this.config.jwt.refreshSecret, {
      expiresIn: '1h'
    } as any);

    await this.cache.set(`${this.resetTokenPrefix}${userId}`, jti, 3_600_000);

    return { token, userId };
  }

  /**
   * Verify password reset token
   * Returns userId if valid, throws error if expired/invalid
   */
  async verifyResetToken(token: string): Promise<string> {
    let decoded: JwtPayload & { type?: string; jti?: string };

    try {
      decoded = jwt.verify(token, this.config.jwt.refreshSecret) as JwtPayload & { type?: string; jti?: string };
    } catch {
      Err(this.t('errors.resetTokenExpired'));
    }

    if (decoded.type !== 'reset' || !decoded.jti) {
      Err(this.t('errors.invalidResetToken'));
    }

    const key = `${this.resetTokenPrefix}${decoded.userId}`;
    const storedJti = await this.cache.get(key);
    if (!storedJti || storedJti !== decoded.jti) {
      Err(this.t('errors.invalidResetToken'));
    }

    await this.cache.del(key);
    return decoded.userId;
  }

  private async getUserSessionVersion(userId: string): Promise<number> {
    return this.parseSessionVersion(await this.cache.get(this.sessionVersionKey(userId)));
  }
}
