import { Injectable, Inject } from 'najm-core';
import { Err, Log, type ILogger } from 'najm-core';
import { I18n, I18nService, type TFn } from 'najm-i18n';
import { EmailService, passwordResetTemplate, accountInviteTemplate } from 'najm-email';
import { nanoid } from 'nanoid';
import { UserService, type SanitizedUser } from '../users/UserService';
import { UserValidator } from '../users/UserValidator';
import { CookieManager } from './CookieManager';
import { TokenService } from '../tokens/TokenService';
import { EncryptionService } from './EncryptionService';
import type { TokenPair, AuthUser, AuthConfig } from '../types';
import type { RegisterDto, LoginDto } from '../users/UserDto';
import { AUTH_CONFIG } from '../auth.tokens';
import timestring from 'timestring';
import { AuthSessionService } from './AuthSessionService';

/**
 * Identity fields for creating a user behind a person record (parent, student,
 * teacher, staff…). Role can be given by name (`role`) or id (`roleId`).
 */
export type ProvisionUserInput = {
  id?: string;
  name?: string;
  email: string;
  role?: string;
  roleId?: string;
  image?: string | null;
  status?: 'active' | 'inactive' | 'pending';
};

@Injectable()
export class AuthService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @I18n("auth") private t!: TFn;
  @Log() private logger!: ILogger;

  private dummyHash?: Promise<string>;

  constructor(
    private tokenService: TokenService,
    private userService: UserService,
    private userValidator: UserValidator,
    private encryptionService: EncryptionService,
    private cookieManager: CookieManager,
    private i18nService: I18nService,
    private emailService: EmailService,
    private authSessionService?: AuthSessionService,
  ) { }

  private isLockoutActive(lockoutUntil?: string | null): boolean {
    if (!lockoutUntil) return false;
    return new Date(lockoutUntil).getTime() > Date.now();
  }

  private nextLockoutUntil(): string {
    const durationMs = timestring(this.config.lockout.duration, 'ms');
    return new Date(Date.now() + durationMs).toISOString();
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.encryptionService.hashPassword('najm-auth-dummy-password');
    return this.dummyHash;
  }

  async warmupPasswordHash(): Promise<void> {
    await this.getDummyHash();
  }


  async registerUser(body: RegisterDto): Promise<SanitizedUser> {
    // Self-registration must never carry privileged fields. registerDto already
    // strips roleId/status/emailVerified, but we re-assert the safe shape here so
    // the service is not implicitly trusting its caller: role comes from the
    // configured defaultRole, status from registrationMode, verification stays false.
    return await this.userService.create({
      name: body.name,
      email: body.email,
      password: body.password,
      image: body.image,
      emailVerified: false,
    });
  }

  /**
   * Admin-initiated account creation. The user is created with a random,
   * unusable password (the schema requires one) and then emailed a one-time
   * link to set their own. They can't log in until they do, since they never
   * learn the random password.
   *
   * Email is best-effort: a send failure logs a warning but never rolls back
   * account creation (and with the console provider, nothing is actually sent).
   */
  async inviteUser(body: ProvisionUserInput): Promise<SanitizedUser & { emailSent: boolean }> {
    // Random password satisfies the NOT NULL column + strength check; the
    // invitee never receives it and overwrites it via the invite link.
    const randomPassword = `${nanoid(24)}Aa1!`;

    const user = await this.userService.create({
      id: body.id,
      name: body.name,
      email: body.email,
      role: body.role,
      roleId: body.roleId,
      image: body.image,
      password: randomPassword,
      status: body.status ?? 'active',
      emailVerified: false,
    });

    const { token } = await this.tokenService.generateInviteToken(user.id);
    const inviteLink = `${this.config.frontendUrl}/reset-password?token=${token}`;

    // Unlike forgot-password (which stays silent to prevent enumeration), invite
    // is an admin action — surface whether the mail actually left so the caller
    // can resend or fall back to sharing the link out-of-band.
    let emailSent = false;
    try {
      await this.emailService.sendHtml(
        body.email,
        this.t('emails.accountInvite.subject'),
        accountInviteTemplate({
          inviteLink,
          userName: (user as any).name || body.email,
        })
      );
      emailSent = true;
    } catch (error) {
      this.logger.warn('Account invite email failed', { email: body.email, error });
    }

    return { ...user, emailSent };
  }

  /**
   * Create a login for a person record. The branch is intentional and is the
   * single rule callers rely on:
   *   - password provided  → set it directly, NO email (seeding / imports)
   *   - no password        → random password + emailed set-password invite
   *
   * Returns the created (sanitized) user so the caller can link `userId`.
   */
  async provisionUser(body: ProvisionUserInput & { password?: string | null }): Promise<SanitizedUser> {
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (password) {
      return this.userService.create({
        id: body.id,
        name: body.name,
        email: body.email,
        role: body.role,
        roleId: body.roleId,
        image: body.image,
        password,
        status: body.status ?? 'active',
      });
    }

    return this.inviteUser(body);
  }

  async loginUser(body: LoginDto): Promise<TokenPair & { user: SanitizedUser }> {
    const { email, password } = body;
    // Note: @Validate(loginDto) decorator ensures email/password are valid

    const user = await this.userService.findByEmail(email);

    if (user?.lockoutUntil && !this.isLockoutActive(user.lockoutUntil)) {
      await this.userService.resetFailedAttempts(user.id);
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }

    if (user && this.isLockoutActive(user.lockoutUntil)) {
      Err(this.t('errors.accountLocked'), 423);
    }

    const storedHash = user?.password ?? await this.getDummyHash();
    const isValid = await this.userValidator.comparePassword(password, storedHash);

    if (!user || !isValid) {
      if (user) {
        const attempts = await this.userService.incrementFailedAttempts(user.id);
        if (attempts >= this.config.lockout.maxAttempts) {
          await this.userService.setLockout(user.id, this.nextLockoutUntil());
          Err(this.t('errors.accountLocked'), 423);
        }
      }
      Err(this.t('errors.invalidCredentials'));
    }

    if (user.status !== 'active') {
      Err(this.t('errors.accountInactive'));
    }

    if (this.config.requireVerifiedEmail && !user.emailVerified) {
      Err(this.t('errors.emailNotVerified'), 403);
    }

    if ((user.failedLoginAttempts ?? 0) > 0 || user.lockoutUntil) {
      await this.userService.resetFailedAttempts(user.id);
    }

    const { password: _, failedLoginAttempts: __, lockoutUntil: ___, ...sanitized } = user;
    this.authSessionService ??= new AuthSessionService(
      this.tokenService,
      this.userService,
      this.cookieManager,
    );
    return this.authSessionService.establish(sanitized);
  }

  async refreshTokens(): Promise<TokenPair> {
    const generated = await this.tokenService.refreshTokens();
    this.cookieManager.setRefreshToken(generated.refreshToken);

    // Refresh the session cookie so SSR reads stay fresh.
    const user = await this.tokenService.getUserById(generated.userId);
    if (user) {
      this.cookieManager.setSessionCookie({
        user: { id: user.id, email: user.email, name: (user as any).name, role: (user as any).role, status: (user as any).status ?? undefined },
        roles: generated.roles,
        permissions: generated.permissions,
        sessionVersion: generated.sessionVersion,
      });
    }

    const { userId: _userId, tokenFamily: _tokenFamily, roles: _roles, permissions: _permissions, sessionVersion: _sv, ...tokens } = generated;
    return tokens;
  }

  /**
   * Reissue the short-lived signed session snapshot from a fully validated
   * refresh session. This path never creates or returns access/refresh tokens
   * and never rotates the refresh family.
   */
  async recoverSession(): Promise<{ recovered: true }> {
    const recovered = await this.tokenService.recoverSessionFromCookie();
    this.cookieManager.setSessionCookie({
      user: {
        id: recovered.user.id,
        email: recovered.user.email,
        name: recovered.user.name,
        role: recovered.user.role ?? undefined,
        status: recovered.user.status ?? undefined,
      },
      roles: recovered.roles,
      permissions: recovered.permissions,
      sessionVersion: recovered.sessionVersion,
    });
    return { recovered: true };
  }

  async logoutUser(userId: string, authorization?: string) {
    await this.tokenService.logout(userId, authorization);
    this.cookieManager.clearRefreshToken();
    this.cookieManager.clearSessionCookie();

    return { data: null, message: this.t('auth.success.logout') };
  }

  /**
   * Prune expired refresh sessions for every user. Login already prunes
   * opportunistically; expose this so consumers can also run it from a
   * scheduled job (cron / queue) to reclaim rows from users who never return.
   * Best-effort — safe to call repeatedly.
   */
  async pruneExpiredSessions(): Promise<void> {
    await this.tokenService.deleteExpiredSessions();
  }

  async getUserProfile(userData: AuthUser): Promise<AuthUser & { language: string }> {
    const lang = this.i18nService.getCurrentLanguage();
    return {
      ...userData,
      language: lang,
    };
  }

  async getUserFromCookie(): Promise<SanitizedUser & { language: string }> {
    const user = await this.tokenService.getUserFromCookie();
    const lang = this.i18nService.getCurrentLanguage();
    return { ...user, language: lang };
  }

  /**
   * Get current user — prefer access token (no cookie rotation risk),
   * fall back to cookie when no Authorization header is present.
   *
   * Refreshes the session cookie cache only when authoritative roles/permissions
   * are available from the access token.
   */
  async getMe(authorization?: string): Promise<SanitizedUser & { language: string }> {
    let result: SanitizedUser & { language: string };
    let cachePayload: { roles: string[]; permissions: string[]; sessionVersion: number } | null = null;

    if (authorization) {
      const user = await this.tokenService.getUser(authorization);
      if (user) {
        const lang = this.i18nService.getCurrentLanguage();
        result = { ...user, language: lang };
        const token = this.tokenService.decodeAccessToken(authorization.replace(/^Bearer\s+/i, ''));
        cachePayload = { roles: token?.roles ?? [], permissions: token?.permissions ?? [], sessionVersion: token?.sessionVersion ?? 0 };
      } else {
        result = await this.getUserFromCookie();
      }
    } else {
      result = await this.getUserFromCookie();
    }

    // Refresh the session cookie only when we have fresh JWT-derived data
    if (cachePayload) {
      this.cookieManager.setSessionCookie({
        user: { id: result.id, email: result.email, name: (result as any).name, role: (result as any).role, status: (result as any).status ?? undefined },
        roles: cachePayload.roles,
        permissions: cachePayload.permissions,
        sessionVersion: cachePayload.sessionVersion,
      });
    }

    return result;
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (user) {
      const { token } = await this.tokenService.generateResetToken(user.id);
      const resetLink = `${this.config.frontendUrl}/reset-password?token=${token}`;

      try {
        await this.emailService.sendHtml(
          email,
          this.t('emails.passwordReset.subject'),
          passwordResetTemplate({
            resetLink,
            userName: (user as any).name || email,
          })
        );
      } catch (error) {
        // Log at warn level for operational monitoring
        // Return same message for security (prevent email enumeration)
        this.logger.warn('Password reset email failed', { email, error });
      }
    }

    // Same message regardless - prevents email enumeration
    return { message: this.t('success.passwordResetSent') };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userService.getAuthRecordById(userId);
    if (!user?.password) {
      Err(this.t('errors.invalidCredentials'));
    }

    const isValid = await this.userValidator.comparePassword(currentPassword, user.password);
    if (!isValid) {
      Err(this.t('errors.invalidCredentials'));
    }

    this.userValidator.validatePasswordStrength(newPassword);
    await this.userService.update(userId, { password: newPassword });
    await this.tokenService.invalidateUserAccessTokens(userId);
    await this.tokenService.revokeAllForUser(userId);
    this.cookieManager.clearRefreshToken();
    this.cookieManager.clearSessionCookie();

    return { message: this.t('success.passwordChanged') };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.tokenService.verifyResetToken(token);
    this.userValidator.validatePasswordStrength(newPassword);
    await this.userService.update(userId, { password: newPassword });
    await this.tokenService.invalidateUserAccessTokens(userId);
    await this.tokenService.revokeAllForUser(userId);
    this.cookieManager.clearRefreshToken();
    this.cookieManager.clearSessionCookie();

    return { message: this.t('success.passwordReset') };
  }
}
