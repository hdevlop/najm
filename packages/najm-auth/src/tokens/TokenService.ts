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

    // Check if token is blacklisted
    if (payload.jti) {
      const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        Err(this.t('errors.tokenRevoked'));
      }
    }

    const activeSessionVersion = await this.getUserSessionVersion(payload.userId);
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
   * Validate a refresh token as an active session:
   * 1. Verify JWT signature and type claim
   * 2. Compare hash against current stored token
   * 3. If mismatch, check previous hash within short grace window
   * 4. Reject anything older or outside the grace window
   */
  async validateRefreshSession(refreshToken: string): Promise<{
    userId: string;
    rotatedTokens?: { refreshToken: string; tokenFamily: string };
  }> {
    const userId = this.verifyRefreshToken(refreshToken);

    const stored = await this.tokenRepository.getRefreshTokenWithFamily(userId);
    if (!stored) {
      Err(this.t('errors.refreshTokenInvalid'));
    }

    const presentedHash = this.hashToken(refreshToken);

    if (presentedHash === stored.token) {
      return { userId };
    }

    const canRecover =
      stored.previousHash &&
      presentedHash === stored.previousHash &&
      stored.previousValidUntil &&
      new Date(stored.previousValidUntil).getTime() > Date.now() &&
      !stored.previousUsedAt;

    if (canRecover) {
      await this.tokenRepository.markPreviousUsed(userId);
      const tokens = await this.generateTokens(userId, stored.tokenFamily ?? undefined);
      return {
        userId,
        rotatedTokens: { refreshToken: tokens.refreshToken, tokenFamily: stored.tokenFamily },
      };
    }

    Err(this.t('errors.refreshTokenInvalid'));
  }

  /**
   * Read the refresh cookie and return the userId it belongs to.
   * Validates against current/previous token state with bounded recovery.
   * Throws if the cookie is missing, invalid, or outside the grace window.
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

    const cacheKey = `auth:user:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const user = await this.tokenRepository.getUser(userId);
    if (user) {
      await this.cache.set(cacheKey, JSON.stringify(user), 30_000);
    }
    return user;
  }

  // ============ TOKEN GENERATION ============

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getTokenExpire(token: string): number | undefined {
    return (jwt.decode(token) as JwtPayload | null)?.exp;
  }

  /**
   * Generate access token with unique jti for blacklist support.
   * Includes roles/permissions for client-side RBAC/PBAC.
   */
  async generateAccessToken(data: { userId: string; roles?: string[]; permissions?: string[] }): Promise<string> {
    const jti = nanoid(16); // Unique token ID
    const sessionVersion = await this.getUserSessionVersion(data.userId);
    return jwt.sign({ ...data, jti, sessionVersion }, this.config.jwt.accessSecret, {
      expiresIn: this.config.jwt.accessExpiresIn
    } as any);
  }

  /**
   * Generate refresh token with unique jti
   */
  generateRefreshToken(data: { userId: string }): string {
    const jti = nanoid(16);
    return jwt.sign({ ...data, jti, type: 'refresh' }, this.config.jwt.refreshSecret, {
      expiresIn: this.config.jwt.refreshExpiresIn
    } as any);
  }

  async generateTokens(userId: string, tokenFamily?: string) {
    const family = tokenFamily ?? nanoid(16);

    const { roleName, permissions } = await this.tokenRepository.getRoleAndPermissions(userId);

    const accessTokenData = {
      userId,
      roles: roleName ? [roleName] : [],
      permissions: permissions ?? [],
    };
    const accessToken = await this.generateAccessToken(accessTokenData);
    const refreshToken = this.generateRefreshToken({ userId });

    await this.storeRefreshToken(userId, refreshToken, family);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: this.getTokenExpire(accessToken),
      refreshTokenExpiresAt: this.getTokenExpire(refreshToken),
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

      if (!decoded.jti) {
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
      await this.tokenRepository.markPreviousUsed(userId);
      return this.generateTokens(userId, stored.tokenFamily ?? undefined);
    }

    Err(this.t('errors.refreshTokenInvalid'));
  }

  async revokeToken(userId: string) {
    return this.tokenRepository.revokeToken(userId);
  }

  async invalidateUserAccessTokens(userId: string): Promise<number> {
    const nextVersion = (await this.getUserSessionVersion(userId)) + 1;
    await this.cache.set(`${this.sessionVersionPrefix}${userId}`, String(nextVersion));
    await this.cache.del(`auth:user:${userId}`);
    return nextVersion;
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
    const raw = await this.cache.get(`${this.sessionVersionPrefix}${userId}`);
    if (!raw) return 0;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}
