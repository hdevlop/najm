import { Injectable, Inject } from 'najm-core';
import { Err, Log, type ILogger } from 'najm-core';
import { Transaction } from 'najm-database';
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
import { isEmailIdentifier, normalizeAuthIdentifier } from './authIdentity';
import {
  resolveTemporaryCredentialKind,
  toTemporaryCredential,
  type TemporaryCredentialInput,
} from '../identity/temporaryCredential';
import { CredentialSetupRequirementService } from '../credentialSetup/CredentialSetupRequirementService';
import { PasswordSetupService } from '../credentialSetup/PasswordSetupService';
import {
  PASSWORD_SETUP_PURPOSE,
  type CredentialSetupPending,
  type CredentialSetupRequirementRow,
} from '../credentialSetup/types';

/**
 * Identity fields for creating a user behind a person record (parent, student,
 * teacher, staff…). Role can be given by name (`role`) or id (`roleId`).
 */
export type ProvisionUserInput = {
  id?: string;
  name?: string;
  email: string;
  /** Normalized through the configured identity preset before it is stored. */
  phone?: string;
  role?: string;
  roleId?: string;
  image?: string | null;
  status?: 'active' | 'inactive' | 'pending';
};

/**
 * Provisioning that hands the user a temporary credential and durably requires
 * them to replace it at first login.
 *
 * Modelled as a union rather than optional fields on purpose: a caller must not
 * be able to set a permanent password and mark it temporary in the same call.
 */
export type ProvisionUserWithSetupInput = ProvisionUserInput & {
  temporaryCredential: TemporaryCredentialInput;
  requireCredentialSetup: typeof PASSWORD_SETUP_PURPOSE;
  password?: never;
};

export type ProvisionUserWithPasswordInput = ProvisionUserInput & {
  password?: string | null;
  temporaryCredential?: never;
  requireCredentialSetup?: never;
};

/** The two variants collapsed for the implementation; callers see the union. */
type ProvisionUserBody = ProvisionUserInput & {
  password?: string | null;
  temporaryCredential?: TemporaryCredentialInput;
  requireCredentialSetup?: typeof PASSWORD_SETUP_PURPOSE;
};

/** Login answer: either a complete session, or a pending credential setup. */
export type LoginResult =
  | (TokenPair & { nextStep: 'authenticated'; user: SanitizedUser })
  | CredentialSetupPending;

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
    private credentialSetupRequirements?: CredentialSetupRequirementService,
    private passwordSetup?: PasswordSetupService,
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
      phone: body.phone,
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
  async provisionUser(
    body: ProvisionUserWithPasswordInput | ProvisionUserWithSetupInput,
  ): Promise<SanitizedUser> {
    const input = body as ProvisionUserBody;

    if (input.requireCredentialSetup) {
      return this.provisionWithCredentialSetup(input);
    }

    if (input.temporaryCredential) {
      Err('provisionUser requires requireCredentialSetup when a temporaryCredential is supplied', 400);
    }

    const password = typeof input.password === 'string' ? input.password.trim() : '';

    if (password) {
      return this.userService.create({
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        roleId: input.roleId,
        image: input.image,
        password,
        status: input.status ?? 'active',
      });
    }

    return this.inviteUser(input);
  }

  /**
   * Create the account and mark the durable requirement in one transaction, so
   * a user never exists holding a temporary credential that nothing forces
   * them to replace. No session is issued here.
   */
  @Transaction()
  private async provisionWithCredentialSetup(
    body: ProvisionUserBody,
  ): Promise<SanitizedUser> {
    if (body.password != null) {
      Err('provisionUser cannot set a password and a temporaryCredential at the same time', 400);
    }
    if (!body.temporaryCredential) {
      Err('provisionUser requires a temporaryCredential when credential setup is required', 400);
    }
    if (!this.credentialSetupRequirements) {
      Err.invalidOperation('Credential setup is unavailable: CredentialSetupRequirementService is not registered');
    }

    const temporary = toTemporaryCredential(body.temporaryCredential);
    const kind = resolveTemporaryCredentialKind(temporary.kind);
    if (kind.isTemporaryShape && !kind.isTemporaryShape(temporary.value)) {
      Err(`Invalid temporary credential for kind '${kind.name}'`, 400);
    }
    const password = kind.normalize(temporary.value);
    if (!password?.trim()) {
      Err('provisionUser requires a non-empty temporaryCredential', 400);
    }

    const user = await this.userService.create({
      id: body.id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      roleId: body.roleId,
      image: body.image,
      password,
      status: body.status ?? 'active',
    }, { validatePasswordStrength: false });

    await this.credentialSetupRequirements.markRequired(user.id, body.requireCredentialSetup, {
      temporaryCredentialKind: kind.name,
    });

    return user;
  }

  async loginUser(body: LoginDto): Promise<LoginResult> {
    const { user, requirement } = await this.authenticate(body, { kind: 'active' });

    if (requirement) {
      if (!this.passwordSetup) {
        Err.invalidOperation('Credential setup is required but PasswordSetupService is not registered');
      }
      return this.passwordSetup.begin(user.id);
    }

    const session = await this.establishSession(user);
    return { ...session, nextStep: 'authenticated' };
  }

  /**
   * Verify credentials and account policy without minting access/refresh
   * tokens or writing normal auth cookies. Sensitive onboarding flows can use
   * this before issuing a purpose-bound CredentialSetupService session.
   */
  async verifyCredentials(body: LoginDto): Promise<SanitizedUser> {
    return (await this.authenticate(body, { kind: 'active' })).user;
  }

  /**
   * Verify a pending, unverified account for one exact application role.
   * This deliberately does not establish a normal auth session. Applications
   * should exchange the result for a short-lived, purpose-bound setup session.
   */
  async verifyPendingCredentials(body: LoginDto, expectedRole: string): Promise<SanitizedUser> {
    if (!expectedRole.trim()) {
      Err(this.t('errors.invalidCredentials'), 401);
    }
    return (await this.authenticate(body, {
      kind: 'pending',
      expectedRole: expectedRole.trim().toLowerCase(),
    })).user;
  }

  /**
   * The one credential path. Resolves identity, the durable setup requirement,
   * and the credential normalization that requirement implies — in that order —
   * before a single hash comparison decides the outcome. Nothing about the
   * requirement is revealed until credentials and account policy have passed.
   */
  private async authenticate(
    body: LoginDto,
    policy: { kind: 'active' } | { kind: 'pending'; expectedRole: string },
  ): Promise<{ user: SanitizedUser; requirement?: CredentialSetupRequirementRow }> {
    const rawIdentifier = 'identifier' in body ? body.identifier : body.email;
    const identifier = this.config.identity?.resolve(rawIdentifier)
      ?? normalizeAuthIdentifier(rawIdentifier);
    // Note: @Validate(loginDto) ensures an identifier/email and password are
    // present. The service repeats safe normalization for direct callers.
    let user;
    if (identifier && isEmailIdentifier(identifier)) {
      user = await this.userService.findByEmailInsensitive(identifier);
    } else if (identifier) {
      const phoneUser = await this.userService.findByPhone(identifier);
      user = phoneUser
        ? await this.userService.findByEmail(phoneUser.email)
        : undefined;
    }

    if (user?.lockoutUntil && !this.isLockoutActive(user.lockoutUntil)) {
      await this.userService.resetFailedAttempts(user.id);
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }

    const isLocked = Boolean(user && this.isLockoutActive(user.lockoutUntil));

    // Looked up for every attempt, including unknown identifiers: skipping the
    // query when no user matched would make account existence measurable.
    const requirement = await this.credentialSetupRequirements
      ?.find(user?.id ?? '', PASSWORD_SETUP_PURPOSE);

    const { credential, kindUnavailable } = this.resolveLoginCredential(body.password, requirement);

    // An unresolvable stored kind fails closed against the dummy hash rather
    // than falling back to a different normalizer.
    const storedHash = kindUnavailable || !user?.password
      ? await this.getDummyHash()
      : user.password;
    const isValid = await this.userValidator.comparePassword(credential, storedHash);

    if (!user || !isValid || isLocked) {
      if (user && !isLocked) {
        const attempts = await this.userService.incrementFailedAttempts(user.id);
        if (attempts >= this.config.lockout.maxAttempts) {
          await this.userService.setLockout(user.id, this.nextLockoutUntil());
        }
      }
      Err(this.t('errors.invalidCredentials'), 401);
    }

    if (policy.kind === 'pending') {
      const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
      if (user.status !== 'pending' || user.emailVerified || role !== policy.expectedRole) {
        Err(this.t('errors.invalidCredentials'), 401);
      }
    } else {
      if (user.status !== 'active') {
        Err(this.t('errors.accountInactive'), 403);
      }

      if (this.config.requireVerifiedEmail && !user.emailVerified) {
        Err(this.t('errors.emailNotVerified'), 403);
      }
    }

    if ((user.failedLoginAttempts ?? 0) > 0 || user.lockoutUntil) {
      await this.userService.resetFailedAttempts(user.id);
    }

    const { password: _, failedLoginAttempts: __, lockoutUntil: ___, ...sanitized } = user;
    return { user: sanitized, requirement };
  }

  /**
   * A user-chosen password is compared byte-for-byte. Only an active
   * requirement, and only its own stored kind, can transform the submitted
   * value — so lowercasing a CIN never leaks into normal logins.
   */
  private resolveLoginCredential(
    password: string,
    requirement?: CredentialSetupRequirementRow,
  ): { credential: string; kindUnavailable: boolean } {
    if (!requirement) return { credential: password, kindUnavailable: false };

    try {
      const kind = resolveTemporaryCredentialKind(requirement.temporaryCredentialKind);
      return { credential: kind.normalize(password), kindUnavailable: false };
    } catch (error) {
      this.logger.error('Unresolvable temporary credential kind on an active requirement', {
        userId: requirement.userId,
        purpose: requirement.purpose,
        kind: requirement.temporaryCredentialKind,
        error,
      });
      return { credential: password, kindUnavailable: true };
    }
  }

  /** Establish a complete normal auth session for an already verified user. */
  async establishSession(user: SanitizedUser): Promise<TokenPair & { user: SanitizedUser }> {
    this.authSessionService ??= new AuthSessionService(
      this.tokenService,
      this.userService,
      this.cookieManager,
      this.credentialSetupRequirements,
    );
    return this.authSessionService.establish(user);
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

  async logoutUser(userId: string | undefined, authorization?: string) {
    try {
      // Logout must remain reachable when authentication can no longer resolve
      // the user (inactive/deleted account, revoked family, expired token). If
      // an identity is still available, preserve the normal server-side
      // revocation; otherwise clearing this browser's cookies is sufficient.
      if (userId) {
        await this.tokenService.logout(userId, authorization);
      }
    } finally {
      // Cookie deletion is the terminal recovery contract. It must survive a
      // missing identity and even a best-effort revocation failure.
      this.cookieManager.clearRefreshToken();
      this.cookieManager.clearSessionCookie();
    }

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
      Err(this.t('errors.invalidCredentials'), 401);
    }

    const isValid = await this.userValidator.comparePassword(currentPassword, user.password);
    if (!isValid) {
      Err(this.t('errors.invalidCredentials'), 401);
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
