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
import { CredentialSetupRequirementRepository } from '../credentialSetup/CredentialSetupRequirementRepository';
import { PASSWORD_SETUP_PURPOSE } from '../credentialSetup/types';
import { Err } from 'najm-core';

@Injectable()
export class TokenService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @I18n("auth") private t!: TFn;

  constructor(
    private tokenRepository: TokenRepository,
    private cookieManager: CookieManager,
    private cache: CacheService,
    // The repository, not the service: CredentialSetupRequirementService
    // depends on TokenService, and this side of the pair only needs a read.
    private credentialSetupRequirements?: CredentialSetupRequirementRepository,
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
    Err(this.t('errors.tokenMissing'), 401);
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
      Err(this.t('errors.tokenVerificationFailed'), 401);
    }

    const sessionKey = this.sessionVersionKey(payload.userId);
    const blacklistKey = payload.jti ? `${this.blacklistPrefix}${payload.jti}` : null;
    const familyKey = payload.tokenFamily ? this.revokedFamilyKey(payload.tokenFamily) : null;

    // Single batched cache read: blacklist (if jti), session version, and
    // family-revocation marker (if the token carries a family).
    const keys = [
      ...(blacklistKey ? [blacklistKey] : []),
      sessionKey,
      ...(familyKey ? [familyKey] : []),
    ];
    const values = await this.getCacheValues(keys);
    const valueByKey = new Map(keys.map((key, i) => [key, values[i]]));

    if (blacklistKey && valueByKey.get(blacklistKey) != null) {
      Err(this.t('errors.tokenRevoked'), 401);
    }
    if (familyKey && valueByKey.get(familyKey) != null) {
      Err(this.t('errors.tokenRevoked'), 401);
    }

    const activeSessionVersion = this.parseSessionVersion(valueByKey.get(sessionKey) ?? null);
    const tokenSessionVersion = payload.sessionVersion ?? 0;
    if (tokenSessionVersion !== activeSessionVersion) {
      Err(this.t('errors.tokenRevoked'), 401);
    }

    return payload;
  }

  verifyRefreshToken(token: string): { userId: string; tokenFamily: string } {
    let decoded: JwtPayload & { type?: string };
    try {
      decoded = jwt.verify(token, this.config.jwt.refreshSecret) as JwtPayload & { type?: string };
    } catch {
      Err(this.t('errors.tokenVerificationFailed'), 401);
    }
    if (decoded.type && decoded.type !== 'refresh') {
      Err(this.t('errors.tokenVerificationFailed'), 401);
    }
    // Pre-multi-session refresh tokens carry no family — reject so the user
    // re-authenticates into the family-aware model (see MULTI_SESSION_PLAN.md
    // migration notes).
    if (!decoded.tokenFamily) {
      Err(this.t('errors.tokenVerificationFailed'), 401);
    }
    return { userId: decoded.userId, tokenFamily: decoded.tokenFamily };
  }

  private static readonly PREVIOUS_GRACE_SECONDS = 120;

  private clearRefreshSessionCookies(): void {
    this.cookieManager.clearRefreshToken();
    this.cookieManager.clearSessionCookie();
  }

  private rejectRefreshSession(messageKey = 'errors.refreshTokenInvalid'): never {
    this.clearRefreshSessionCookies();
    Err(this.t(messageKey), 401);
  }

  private readRefreshSessionCookie(): {
    refreshToken: string;
    userId: string;
    tokenFamily: string;
  } {
    const refreshToken = this.cookieManager.getRefreshToken();
    if (!refreshToken) {
      this.rejectRefreshSession('errors.refreshTokenMissing');
    }

    try {
      return { refreshToken, ...this.verifyRefreshToken(refreshToken) };
    } catch (error) {
      // A malformed, expired, or legacy refresh cookie cannot become valid on
      // retry. Remove the signed snapshot with it so SSR hydration cannot keep
      // sending the browser back into refresh.
      this.clearRefreshSessionCookies();
      throw error;
    }
  }

  /**
   * Read the refresh cookie and return the userId it belongs to.
   * Validates against current/previous token state with bounded recovery.
   * Throws if the cookie is missing, invalid, or outside the grace window.
   *
   * Intentionally does not revoke on a mismatch: unlike refreshTokens(), this
   * is a read path (e.g. GET /auth/me), so a stray stale cookie must not be
   * able to destroy server-side session state. Definitively invalid browser
   * cookies are still cleared so a signed snapshot cannot cause a redirect
   * loop.
   */
  private async resolveRefreshSessionFromCookie(): Promise<{
    userId: string;
    tokenFamily: string;
  }> {
    const { refreshToken, userId, tokenFamily } = this.readRefreshSessionCookie();

    const stored = await this.tokenRepository.getByFamily(tokenFamily);
    if (!stored || stored.userId !== userId) {
      this.rejectRefreshSession();
    }

    const presentedHash = this.hashToken(refreshToken);

    if (presentedHash === stored.token) {
      return { userId, tokenFamily };
    }

    const canRecover =
      stored.previousHash &&
      presentedHash === stored.previousHash &&
      stored.previousValidUntil &&
      new Date(stored.previousValidUntil).getTime() > Date.now() &&
      !stored.previousUsedAt;

    if (canRecover) {
      return { userId, tokenFamily };
    }

    this.rejectRefreshSession();
  }

  async resolveUserFromCookie(): Promise<string> {
    return (await this.resolveRefreshSessionFromCookie()).userId;
  }

  /**
   * Resolve authoritative claims for signed-session recovery.
   *
   * This deliberately bypasses the 30-second user cache so status, role, and
   * permission changes are reflected when the short session snapshot expires.
   * It validates but never rotates or consumes the refresh token.
   */
  async recoverSessionFromCookie() {
    const { userId, tokenFamily } = await this.resolveRefreshSessionFromCookie();
    const user = await this.requireActiveRefreshUser(userId, tokenFamily);
    const sessionVersion = await this.getUserSessionVersion(userId);

    return {
      user,
      roles: user.role ? [user.role] : [],
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      sessionVersion,
    };
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
    tokenFamily?: string;
  }): Promise<{ token: string; expiresAt: number; sessionVersion: number }> {
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
    return { token, expiresAt, sessionVersion };
  }

  /**
   * Current per-user session version (0 when never invalidated). The signed
   * session cookie stamps this so a fast-path reader can reject a cookie whose
   * session was invalidated after it was written.
   */
  async getSessionVersion(userId: string): Promise<number> {
    return this.getUserSessionVersion(userId);
  }

  /**
   * Generate access token with unique jti for blacklist support.
   * Includes roles/permissions for client-side RBAC/PBAC.
   */
  async generateAccessToken(data: { userId: string; roles?: string[]; permissions?: string[]; tokenFamily?: string }): Promise<string> {
    return (await this.signAccessToken(data)).token;
  }

  /**
   * Generate refresh token with unique jti. The token carries its session's
   * family so rotation/revocation can target a single session.
   */
  private signRefreshToken(data: { userId: string; tokenFamily: string }): { token: string; expiresAt: number } {
    const jti = nanoid(16);
    const expiresAt = this.expiresAt(this.config.jwt.refreshExpiresIn);
    const token = jwt.sign(
      { ...data, jti, type: 'refresh', exp: expiresAt },
      this.config.jwt.refreshSecret,
    );
    return { token, expiresAt };
  }

  generateRefreshToken(data: { userId: string; tokenFamily?: string }): string {
    return this.signRefreshToken({ userId: data.userId, tokenFamily: data.tokenFamily ?? nanoid(16) }).token;
  }

  private async createTokenPair(userId: string, family: string) {
    const { roleName, permissions } = await this.tokenRepository.getRoleAndPermissions(userId);

    const accessTokenData = {
      userId,
      roles: roleName ? [roleName] : [],
      permissions: permissions ?? [],
      tokenFamily: family,
    };
    const access = await this.signAccessToken(accessTokenData);
    const refresh = this.signRefreshToken({ userId, tokenFamily: family });

    return {
      userId,
      tokenFamily: family,
      roles: accessTokenData.roles,
      permissions: accessTokenData.permissions,
      sessionVersion: access.sessionVersion,
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async generateTokens(userId: string, tokenFamily?: string) {
    const family = tokenFamily ?? nanoid(16);
    const generated = await this.createTokenPair(userId, family);
    await this.storeRefreshToken(userId, generated.refreshToken, family);
    return generated;
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

    // Carry over the *current* hash of THIS family as the grace-window
    // previous. Reading by family (not userId) keeps a fresh login on device B
    // from inheriting device A's previous hash / grace window.
    const existing = await this.tokenRepository.getByFamily(tokenFamily);
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
   * Rotate only the family row observed by refreshTokens(). This conditional
   * update fails closed if logout deleted the family or another refresh won.
   */
  private async rotateTokens(userId: string, tokenFamily: string, expectedCurrentHash: string) {
    const generated = await this.createTokenPair(userId, tokenFamily);
    const expireInSecond = timestring(this.config.jwt.refreshExpiresIn, 's');
    const rotated = await this.tokenRepository.rotateRefreshToken({
      userId,
      token: this.hashToken(generated.refreshToken),
      tokenFamily,
      expiresAt: new Date(Date.now() + expireInSecond * 1000).toISOString(),
      previousHash: expectedCurrentHash,
      previousValidUntil: new Date(
        Date.now() + TokenService.PREVIOUS_GRACE_SECONDS * 1000,
      ).toISOString(),
      previousUsedAt: null,
    }, expectedCurrentHash);

    if (!rotated?.length) {
      Err(this.t('errors.refreshTokenInvalid'), 401);
    }

    return generated;
  }

  /**
   * Refresh tokens with secure token comparison
   * Compares provided token with hashed version in database
   */
  async refreshTokens() {
    const { refreshToken, userId, tokenFamily } = this.readRefreshSessionCookie();
    const stored = await this.tokenRepository.getByFamily(tokenFamily);

    if (!stored || stored.userId !== userId) {
      this.rejectRefreshSession();
    }

    const presentedHash = this.hashToken(refreshToken);
    await this.requireActiveRefreshUser(userId, tokenFamily);

    if (presentedHash === stored.token) {
      return this.rotateTokens(userId, tokenFamily, stored.token);
    }

    const canRecover =
      stored.previousHash &&
      presentedHash === stored.previousHash &&
      stored.previousValidUntil &&
      new Date(stored.previousValidUntil).getTime() > Date.now() &&
      !stored.previousUsedAt;

    if (canRecover) {
      // Atomically claim the grace slot for THIS family, keyed on the presented
      // previous hash.
      const claimed = await this.tokenRepository.markPreviousUsed(tokenFamily, presentedHash);
      if (!claimed?.length) {
        // Lost the race: a concurrent request already claimed the grace slot
        // and rotated. Do not revoke — the winner's session is legitimate.
        Err(this.t('errors.refreshTokenInvalid'), 401);
      }
      return this.rotateTokens(userId, tokenFamily, stored.token);
    }

    // Reuse outside the grace window: revoke only this suspect family.
    await this.revokeSuspectRefreshFamily(userId, tokenFamily);
    this.rejectRefreshSession();
  }

  private async requireActiveRefreshUser(userId: string, tokenFamily: string) {
    const user = await this.tokenRepository.getUser(userId);
    if (!user || user.status !== 'active') {
      await this.revokeFamily(tokenFamily);
      this.rejectRefreshSession();
    }

    // Covers refresh and signed-session recovery alike: a requirement marked
    // after a session was minted must end that session, not ride along on it.
    const requirement = await this.credentialSetupRequirements
      ?.find(userId, PASSWORD_SETUP_PURPOSE);
    if (requirement?.required) {
      await this.revokeFamily(tokenFamily);
      this.clearRefreshSessionCookies();
      Err(this.t('errors.credentialSetupRequired'), 403);
    }

    return user;
  }

  /** Revoke every refresh session for a user (password change/reset, logout-all). */
  async revokeAllForUser(userId: string) {
    return this.tokenRepository.revokeAllForUser(userId);
  }

  /** Revoke a single refresh session (one family). */
  async revokeFamily(tokenFamily: string) {
    await this.markFamilyRevoked(tokenFamily);
    return this.tokenRepository.revokeFamily(tokenFamily);
  }

  /**
   * Opportunistic cleanup of expired/abandoned sessions. With one row per
   * family (no unique userId), abandoned logins would otherwise accumulate.
   * Best-effort — never let cleanup failure break the calling flow.
   */
  async deleteExpiredSessions(): Promise<void> {
    try {
      await this.tokenRepository.deleteExpired();
    } catch {
      // non-fatal
    }
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
      Err(this.t('errors.refreshTokenInvalid'), 401);
    }
    return user;
  }

  private get revokedFamilyPrefix(): string {
    return 'auth:revoked-family:';
  }

  private revokedFamilyKey(tokenFamily: string): string {
    return `${this.revokedFamilyPrefix}${tokenFamily}`;
  }

  /**
   * Mark a family as revoked in cache for the access-token TTL, so every
   * access token minted for that family (not just the presented one) is
   * rejected by verifyAccessToken until it would have expired anyway.
   */
  private async markFamilyRevoked(tokenFamily: string): Promise<void> {
    await this.cache.set(this.revokedFamilyKey(tokenFamily), '1', this.accessTokenTtlMs());
  }

  /**
   * Revoke only the suspect family — NOT the whole user. Bumping the global
   * per-user session version here would kill every device's access tokens on a
   * single family's reuse detection. Instead drop the family's refresh row and
   * mark the family revoked so its access tokens stop verifying.
   */
  private async revokeSuspectRefreshFamily(userId: string, tokenFamily: string | null): Promise<void> {
    if (tokenFamily) {
      await this.revokeFamily(tokenFamily);
      return;
    }
    // No family context — fall back to revoke-all for safety.
    await this.invalidateUserAccessTokens(userId);
    await this.revokeAllForUser(userId);
  }

  /**
   * Logout the CURRENT session only — blacklist the presented access token,
   * mark its family revoked, and delete that family's refresh row. Other
   * devices/sessions for the same user keep working. Use a password change or
   * reset (revoke-all) to terminate every session.
   *
   * The family is resolved from, in order: a verified Bearer access token's
   * `tokenFamily` claim, then a verified refresh cookie whose hash still
   * matches the current family row. If neither is available, fall back to
   * revoke-all.
   */
  async logout(userId: string, authorization?: string): Promise<void> {
    let tokenFamily: string | null = null;

    // A presented Bearer token is authoritative for this request. Use its
    // verified family first so a stray cookie cannot revoke a different session.
    if (authorization) {
      let accessToken: string | null = null;
      try {
        accessToken = this.extractAccessToken(authorization);
      } catch {
        // Token extraction failed, skip blacklisting/family resolution.
      }

      if (accessToken) {
        try {
          const decoded = await this.verifyAccessToken(accessToken);
          if (decoded.userId === userId && decoded.tokenFamily) {
            tokenFamily = decoded.tokenFamily;
          }
        } catch {
          // Invalid/expired/revoked access token — fall through to refresh cookie.
        }

        await this.blacklistCurrentToken(accessToken);
      }
    }

    if (!tokenFamily) {
      tokenFamily = await this.resolveRefreshCookieFamily(userId);
    }

    if (tokenFamily) {
      await this.revokeFamily(tokenFamily);
      return;
    }

    // No family resolvable — revoke every session for safety.
    await this.invalidateUserAccessTokens(userId);
    await this.revokeAllForUser(userId);
  }

  /**
   * Resolve a logout target from the refresh cookie only if the cookie maps to
   * the user's current/valid family row. This mirrors resolveUserFromCookie()
   * without throwing, because logout can still fall back to revoke-all.
   */
  private async resolveRefreshCookieFamily(userId: string): Promise<string | null> {
    const refreshToken = this.cookieManager.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      if (decoded.userId !== userId) return null;

      const stored = await this.tokenRepository.getByFamily(decoded.tokenFamily);
      if (!stored || stored.userId !== userId) return null;

      const presentedHash = this.hashToken(refreshToken);
      if (presentedHash === stored.token) {
        return decoded.tokenFamily;
      }

      const canRecover =
        stored.previousHash &&
        presentedHash === stored.previousHash &&
        stored.previousValidUntil &&
        new Date(stored.previousValidUntil).getTime() > Date.now() &&
        !stored.previousUsedAt;

      return canRecover ? decoded.tokenFamily : null;
    } catch {
      return null;
    }
  }

  // ============ PASSWORD RESET TOKENS ============

  /**
   * Generate a one-time set-password token (used by both password reset and
   * account invites). Stores the jti in cache so the token can only be used
   * once, with a TTL matching the JWT expiry.
   */
  private async generateSetPasswordToken(
    userId: string,
    type: 'reset' | 'invite',
    expiresIn: string,
  ): Promise<{ token: string; userId: string }> {
    const jti = nanoid(16);
    const data = {
      userId,
      type,
      jti,
      timestamp: Date.now(),
    };

    const token = jwt.sign(data, this.config.jwt.refreshSecret, {
      expiresIn
    } as any);

    // Cache TTL mirrors the token expiry so a consumed/expired token can't be reused.
    await this.cache.set(`${this.resetTokenPrefix}${userId}`, jti, timestring(expiresIn, 'ms'));

    return { token, userId };
  }

  /**
   * Generate secure password reset token
   * Returns both the plain token (to send via email) and userId for identification
   */
  async generateResetToken(userId: string): Promise<{ token: string; userId: string }> {
    // Short expiry (1h): the user is actively waiting for the email.
    return this.generateSetPasswordToken(userId, 'reset', '1h');
  }

  /**
   * Generate secure account-invite token.
   * Longer expiry (3d) than reset because an invited user may not check
   * their email immediately. Consumed via the same reset-password endpoint.
   */
  async generateInviteToken(userId: string): Promise<{ token: string; userId: string }> {
    return this.generateSetPasswordToken(userId, 'invite', '3d');
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

    // Accept both reset and invite tokens — both grant a one-time password set.
    if ((decoded.type !== 'reset' && decoded.type !== 'invite') || !decoded.jti) {
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
