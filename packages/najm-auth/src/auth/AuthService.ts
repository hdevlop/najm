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

/** Outcome of an administrative reset to a system-issued temporary credential. */
export type TemporaryCredentialReset = {
  userId: string;
  purpose: typeof PASSWORD_SETUP_PURPOSE;
  temporaryCredentialKind: string;
};

/**
 * Outcome of an administrative mail-out. `emailSent` is what the provider
 * actually reported — never an assumption that sending succeeded.
 *
 * `undeliveredLinkLive` is the one case a caller cannot infer: the mail did not
 * leave AND the link minted for it could not be taken out of circulation, so a
 * usable link exists that no one received. It is false whenever the mail left
 * — that link is live on purpose — and false when an undelivered one was
 * successfully discarded.
 */
export type AdministrativeDelivery = {
  userId: string;
  emailSent: boolean;
  undeliveredLinkLive: boolean;
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

    // Unlike forgot-password (which stays silent to prevent enumeration), invite
    // is an admin action — surface whether the mail actually left so the caller
    // can resend.
    const { emailSent } = await this.deliverInvitation(
      user.id,
      body.email,
      (user as any).name,
      body.role,
    );

    return { ...user, emailSent };
  }

  /**
   * Mint an invite token and send the activation mail. Shared by first-time
   * invitation and re-invitation, so both rest on one token contract and one
   * template and neither can drift into an ad hoc message.
   *
   * Nothing here logs the token, the link, the message body, or the recipient.
   */
  private async deliverInvitation(
    userId: string,
    email: string,
    userName: string | null | undefined,
    role: string | null | undefined,
  ): Promise<{ emailSent: boolean; jti: string }> {
    const { token, jti } = await this.tokenService.generateInviteToken(userId);
    const inviteLink = `${this.config.frontendUrl}/reset-password?token=${token}`;
    const accountType = role?.trim().toLowerCase() || undefined;
    const accountLabel = accountType ? `${accountType} account` : 'account';

    let emailSent = false;
    try {
      const logo = this.config.accountInviteLogo;
      const logoCid = logo ? 'najm-account-invite-logo' : undefined;
      const result = await this.emailService.send({
        to: email,
        subject: this.t('emails.accountInvite.subject', {
          accountLabel,
          appName: this.config.appName,
        }),
        html: accountInviteTemplate({
          accountType,
          appName: this.config.appName,
          inviteLink,
          logoAlt: logo?.alt,
          logoSrc: logoCid ? `cid:${logoCid}` : undefined,
          userName: userName || email,
        }),
        attachments: logo ? [{
          filename: logo.filename,
          content: logo.contentBase64,
          contentType: logo.contentType,
          cid: logoCid,
          disposition: 'inline',
          encoding: 'base64',
        }] : undefined,
      });
      emailSent = result.success;
    } catch (error) {
      this.logger.warn('Account invite email failed', { userId, error });
    }

    return { emailSent, jti };
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
        tokenFamily: generated.tokenFamily,
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
      tokenFamily: recovered.tokenFamily,
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
    let cachePayload: {
      roles: string[];
      permissions: string[];
      sessionVersion: number;
      tokenFamily: string;
    } | null = null;

    if (authorization) {
      const user = await this.tokenService.getUser(authorization);
      if (user) {
        const lang = this.i18nService.getCurrentLanguage();
        result = { ...user, language: lang };
        const token = this.tokenService.decodeAccessToken(authorization.replace(/^Bearer\s+/i, ''));
        cachePayload = token?.tokenFamily
          ? {
            roles: token.roles ?? [],
            permissions: token.permissions ?? [],
            sessionVersion: token.sessionVersion ?? 0,
            tokenFamily: token.tokenFamily,
          }
          // A token with no family cannot produce a revocable snapshot, so
          // /me answers without refreshing the cookie rather than writing one
          // that revocation could not reach.
          : null;
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
        tokenFamily: cachePayload.tokenFamily,
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
    // Order matters: consuming the token is irreversible, so everything that
    // can legitimately reject the request runs first. A weak replacement
    // password must not burn a link the user would otherwise still be able to
    // use. Only the caller that wins the atomic consumption proceeds to the
    // mutation — and once consumed, the token stays consumed even if the
    // mutation below fails; that user requests a new link.
    this.userValidator.validatePasswordStrength(newPassword);
    const consumed = await this.tokenService.consumeSetPasswordToken(token);
    const user = await this.userService.getById(consumed.userId);
    const acceptsInvitation = consumed.type === 'invite';
    await this.userService.update(consumed.userId, {
      password: newPassword,
      ...(acceptsInvitation
        ? {
            emailVerified: true,
            ...(user.status === 'pending' ? { status: 'active' as const } : {}),
          }
        : {}),
    });
    await this.tokenService.invalidateUserAccessTokens(consumed.userId);
    await this.tokenService.revokeAllForUser(consumed.userId);
    this.cookieManager.clearRefreshToken();
    this.cookieManager.clearSessionCookie();

    return { message: this.t('success.passwordReset') };
  }

  // ==========================================================================
  // Administrative recovery for an account that already exists
  //
  // Three operations an application's own admin surface composes. Each is
  // bound to a user id, never to a submitted email; none creates a user,
  // issues a session, or returns a credential, token, or link. Who may call
  // them, which targets are eligible, how often, and what is audited belong to
  // the application — this package owns only the credential, token, and
  // session mechanics underneath.
  // ==========================================================================

  /**
   * Replace an existing account's stored credential with a system-issued
   * temporary one and durably require the holder to replace it at their next
   * login.
   *
   * The hash write and the durable requirement commit together, so no failure
   * can leave the temporary credential accepted with nothing forcing its
   * replacement, nor the requirement standing over an unchanged password.
   * Session revocation runs inside that same transaction: a cache or session
   * failure rolls the credential back rather than reporting a reset that a
   * still-live browser could sail past. No session is issued.
   *
   * Strength validation is deliberately skipped — the value is issued by the
   * system, not chosen by the user — but bcrypt's 72-byte boundary is not.
   */
  @Transaction()
  async resetToTemporaryCredential(
    userId: string,
    credential: TemporaryCredentialInput,
  ): Promise<TemporaryCredentialReset> {
    if (!this.credentialSetupRequirements) {
      Err.invalidOperation('Credential setup is unavailable: CredentialSetupRequirementService is not registered');
    }

    // Resolve the account first, so an unknown id fails as a 404 before
    // anything is hashed rather than as a silent no-op.
    const user = await this.userService.getById(userId);

    const temporary = toTemporaryCredential(credential);
    const kind = resolveTemporaryCredentialKind(temporary.kind);
    if (kind.isTemporaryShape && !kind.isTemporaryShape(temporary.value)) {
      Err(`Invalid temporary credential for kind '${kind.name}'`, 400);
    }
    const password = kind.normalize(temporary.value);
    if (!password?.trim()) {
      Err('resetToTemporaryCredential requires a non-empty temporaryCredential', 400);
    }

    await this.userService.update(user.id, { password }, { validatePasswordStrength: false });
    await this.credentialSetupRequirements.markRequired(user.id, PASSWORD_SETUP_PURPOSE, {
      temporaryCredentialKind: kind.name,
    });

    return {
      userId: user.id,
      purpose: PASSWORD_SETUP_PURPOSE,
      temporaryCredentialKind: kind.name,
    };
  }

  /**
   * Send one password-reset link to an account selected by id. The recipient is
   * read from that account at command time, so neither an administrator nor a
   * stale client can redirect the link by supplying an address.
   *
   * Delivery is reported truthfully: unlike `forgotPassword` there is no email
   * enumeration to protect against, because the caller already knows the
   * account exists. Account status and email verification are left exactly as
   * they were, and requesting the link does not end the user's current session
   * — `resetPassword` revokes it when the new password is actually saved.
   *
   * Minting supersedes any earlier link for this user. A failed send discards
   * the fresh token too, so a failure never leaves a live link nobody received.
   */
  async sendPasswordReset(userId: string): Promise<AdministrativeDelivery> {
    const user = await this.userService.getById(userId);
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    if (!email) {
      Err('This account has no email address to send a password reset to', 409);
    }

    const { token, jti } = await this.tokenService.generateResetToken(user.id);
    const resetLink = `${this.config.frontendUrl}/reset-password?token=${token}`;

    let emailSent = false;
    try {
      const result = await this.emailService.sendHtml(
        email,
        this.t('emails.passwordReset.subject'),
        passwordResetTemplate({
          resetLink,
          userName: (user as any).name || email,
        }),
      );
      emailSent = result.success;
    } catch (error) {
      this.logger.warn('Administrative password reset email failed', { userId: user.id, error });
    }

    const undeliveredLinkLive = emailSent
      ? false
      : !(await this.discardUndeliveredToken(user.id, jti));

    return { userId: user.id, emailSent, undeliveredLinkLive };
  }

  /**
   * Re-send the activation link for an account that is still pending.
   *
   * It creates no second user and no second profile — that is the whole reason
   * it exists beside `inviteUser`, which does create one. Only a `pending`
   * account qualifies: an active or inactive account is reset or reactivated,
   * never re-invited. Whether a given pending account is genuinely an invited
   * one rather than an application awaiting a decision is the caller's to
   * decide; this package cannot see an application.
   */
  async resendInvitation(userId: string): Promise<AdministrativeDelivery> {
    const user = await this.userService.getById(userId);
    if (user.status !== 'pending') {
      Err('Only a pending account can be re-invited', 409);
    }
    const email = typeof user.email === 'string' ? user.email.trim() : '';
    if (!email) {
      Err('This account has no email address to send an invitation to', 409);
    }

    const { emailSent, jti } = await this.deliverInvitation(
      user.id,
      email,
      (user as any).name,
      (user as any).role,
    );

    const undeliveredLinkLive = emailSent
      ? false
      : !(await this.discardUndeliveredToken(user.id, jti));

    return { userId: user.id, emailSent, undeliveredLinkLive };
  }

  /**
   * Take a link that was minted but never delivered out of circulation, and
   * answer whether it is really gone.
   *
   * A `false` from the store is not a failure: compare-and-delete only refuses
   * when the stored jti is no longer this one, which means a newer mint already
   * superseded this link and it can no longer be consumed either way. A throw
   * is the failure — the store was unreachable, the jti it holds is still ours,
   * and a usable link now exists that nobody received. That does not change
   * what the caller is told about delivery, but it must not be swallowed: it is
   * logged as an error and reported up, so the result stays truthful about more
   * than the mail.
   */
  private async discardUndeliveredToken(userId: string, jti: string): Promise<boolean> {
    try {
      await this.tokenService.discardSetPasswordToken(userId, jti);
      return true;
    } catch (error) {
      this.logger.error('Undelivered set-password token is still live', { userId, error });
      return false;
    }
  }
}
