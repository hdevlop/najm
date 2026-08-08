import { createHash, randomBytes } from 'node:crypto';
import { CookieService } from 'najm-cookies';
import { Err, Injectable } from 'najm-core';
import { Transaction } from 'najm-database';
import { I18n, type TFn } from 'najm-i18n';
import { CookieManager } from '../auth/CookieManager';
import { TokenService } from '../tokens/TokenService';
import { CredentialSetupRepository } from './CredentialSetupRepository';
import { CREDENTIAL_SETUP_CODES, credentialSetupError } from './errors';
import { normalizeSetupPurpose } from './purpose';
import type {
  CredentialSetupOptions,
  CredentialSetupSessionInfo,
  CredentialSetupStarted,
} from './types';

export const DEFAULT_CREDENTIAL_SETUP_COOKIE_NAME = 'najm.credential-setup';
export const DEFAULT_CREDENTIAL_SETUP_TTL_MS = 10 * 60 * 1_000;

const MAX_TTL_MS = 24 * 60 * 60 * 1_000;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

type ResolvedCredentialSetupOptions = Required<CredentialSetupOptions>;

@Injectable()
export class CredentialSetupService {
  @I18n('auth') private t?: TFn;

  constructor(
    private readonly repository: CredentialSetupRepository,
    private readonly tokens: TokenService,
    private readonly authCookies: CookieManager,
    private readonly cookies: CookieService,
  ) { }

  /**
   * Revoke normal auth sessions and issue a single-purpose, short-lived,
   * browser-session cookie. No access or refresh token is minted.
   */
  @Transaction({ retries: 2 })
  async begin(userId: string, options: CredentialSetupOptions): Promise<CredentialSetupStarted> {
    const resolved = this.resolveOptions(options);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + resolved.ttlMs).toISOString();

    await this.repository.deleteExpired();
    await this.repository.replaceActive({
      userId,
      purpose: resolved.purpose,
      tokenHash: this.hashToken(token),
      expiresAt,
    });

    await this.tokens.invalidateUserAccessTokens(userId);
    await this.tokens.revokeAllForUser(userId);
    this.authCookies.clearRefreshToken();
    this.authCookies.clearSessionCookie();
    this.setCookie(token, resolved);

    return { purpose: resolved.purpose, expiresAt };
  }

  /** Validate and return the current active setup session without consuming it. */
  async require(options: CredentialSetupOptions): Promise<CredentialSetupSessionInfo> {
    const resolved = this.resolveOptions(options);
    const token = this.cookies.get(resolved.cookieName);
    if (!token) this.sessionRequired();

    const session = await this.repository.findActive(
      this.hashToken(token),
      resolved.purpose,
    );
    if (!session) {
      this.clearCookie(resolved);
      this.sessionInvalid();
    }
    return session;
  }

  /**
   * Atomically consume the setup session and execute the application-owned
   * credential mutation in the same database transaction. If the callback
   * fails, consumption rolls back and the browser may safely retry.
   */
  @Transaction({ retries: 2 })
  async consume<T>(
    options: CredentialSetupOptions,
    complete: (session: CredentialSetupSessionInfo) => Promise<T> | T,
  ): Promise<T> {
    const resolved = this.resolveOptions(options);
    const token = this.cookies.get(resolved.cookieName);
    if (!token) this.sessionRequired();

    const session = await this.repository.consume(
      this.hashToken(token),
      resolved.purpose,
    );
    if (!session) {
      this.clearCookie(resolved);
      this.sessionInvalid();
    }

    const result = await complete(session);
    this.clearCookie(resolved);
    return result;
  }

  @Transaction({ retries: 2 })
  async cancel(options: CredentialSetupOptions): Promise<{ cancelled: true }> {
    const resolved = this.resolveOptions(options);
    const token = this.cookies.get(resolved.cookieName);
    if (token) {
      await this.repository.revoke(this.hashToken(token), resolved.purpose);
    }
    this.clearCookie(resolved);
    return { cancelled: true };
  }

  async pruneExpired(): Promise<void> {
    await this.repository.deleteExpired();
  }

  /** Tolerates direct construction outside DI, where `t` is not injected. */
  private message(key: string, fallback: string): string {
    try {
      return this.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  }

  private sessionRequired(): never {
    return credentialSetupError(
      CREDENTIAL_SETUP_CODES.SESSION_REQUIRED,
      this.message('errors.credentialSetupSessionRequired', 'Credential setup session is required'),
      401,
    );
  }

  private sessionInvalid(): never {
    return credentialSetupError(
      CREDENTIAL_SETUP_CODES.SESSION_INVALID,
      this.message('errors.credentialSetupSessionInvalid', 'Credential setup session is invalid or expired'),
      401,
    );
  }

  private resolveOptions(options: CredentialSetupOptions): ResolvedCredentialSetupOptions {
    const purpose = normalizeSetupPurpose(options.purpose);
    const cookieName = options.cookieName?.trim() || DEFAULT_CREDENTIAL_SETUP_COOKIE_NAME;
    const ttlMs = options.ttlMs ?? DEFAULT_CREDENTIAL_SETUP_TTL_MS;
    const cookiePath = options.cookiePath ?? '/';

    if (!COOKIE_NAME_PATTERN.test(cookieName) || cookieName.length > 128) {
      Err('Credential setup cookie name is invalid', 500);
    }
    if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) {
      Err('Credential setup ttlMs must be an integer between 1000 and 86400000', 500);
    }
    if (!cookiePath.startsWith('/') || cookiePath.includes(';') || cookiePath.includes('\\')) {
      Err('Credential setup cookiePath must be a same-origin path', 500);
    }

    return { purpose, cookieName, ttlMs, cookiePath };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private setCookie(token: string, options: ResolvedCredentialSetupOptions): void {
    this.cookies.setSession(options.cookieName, token, {
      httpOnly: true,
      path: options.cookiePath,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  private clearCookie(options: ResolvedCredentialSetupOptions): void {
    this.cookies.delete(options.cookieName, {
      path: options.cookiePath,
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
