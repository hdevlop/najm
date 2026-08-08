import { Inject, Injectable } from 'najm-core';
import { I18n, type TFn } from 'najm-i18n';
import { EncryptionService } from '../auth/EncryptionService';
import { resolveTemporaryCredentialKind } from '../identity/temporaryCredential';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import { UserRepository } from '../users/UserRepository';
import { UserService } from '../users/UserService';
import { UserValidator } from '../users/UserValidator';
import { CredentialSetupRequirementService } from './CredentialSetupRequirementService';
import { CredentialSetupService } from './CredentialSetupService';
import { CREDENTIAL_SETUP_CODES, credentialSetupError } from './errors';
import {
  PASSWORD_SETUP_PURPOSE,
  type CredentialSetupOptions,
  type CredentialSetupPending,
} from './types';

/**
 * The built-in `password` setup flow. Always mounted by `auth()`; inert until a
 * user actually owes the `password` purpose.
 */
@Injectable()
export class PasswordSetupService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @I18n('auth') private t?: TFn;

  constructor(
    private readonly setup: CredentialSetupService,
    private readonly requirements: CredentialSetupRequirementService,
    private readonly users: UserService,
    private readonly userRecords: UserRepository,
    private readonly validator: UserValidator,
    private readonly encryption: EncryptionService,
  ) { }

  /** Tolerates direct construction outside DI, where `t` is not injected. */
  private message(key: string, fallback: string): string {
    try {
      return this.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  }

  private get options(): CredentialSetupOptions {
    const { cookieName, ttlMs } = this.config.credentialSetup.password;
    return { purpose: PASSWORD_SETUP_PURPOSE, cookieName, ttlMs };
  }

  private pending(session: { purpose: string; expiresAt: string }): CredentialSetupPending {
    return {
      nextStep: 'credential_setup',
      setupRequired: true,
      purpose: session.purpose,
      expiresAt: session.expiresAt,
    };
  }

  /** Revoke normal sessions and hand the browser a short-lived setup cookie. */
  async begin(userId: string): Promise<CredentialSetupPending> {
    return this.pending(await this.setup.begin(userId, this.options));
  }

  /** Read the active setup session without consuming it. */
  async status(): Promise<CredentialSetupPending> {
    return this.pending(await this.setup.require(this.options));
  }

  /**
   * Everything that can fail on the user's input is checked against the
   * *unconsumed* session, so a mistyped replacement leaves the browser able to
   * retry. Only the two writes that must agree — the password and the
   * requirement — happen inside the one-time consumption.
   */
  async change(newPassword: string): Promise<{ changed: true; signInAgain: true }> {
    const { userId } = await this.setup.require(this.options);
    const password = await this.validateReplacement(userId, newPassword);
    const hashed = await this.encryption.hashPassword(password);

    await this.setup.consume(this.options, (session) => this.persist(session.userId, hashed));
    return { changed: true, signInAgain: true };
  }

  async cancel(): Promise<{ cancelled: true }> {
    return this.setup.cancel(this.options);
  }

  private async validateReplacement(userId: string, submitted: string): Promise<string> {
    const requirement = await this.requirements.find(userId, PASSWORD_SETUP_PURPOSE);
    if (!requirement) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.ALREADY_COMPLETED,
        this.message('errors.credentialSetupAlreadyCompleted', 'The password was already replaced. Please sign in again.'),
        409,
      );
    }

    const kind = resolveTemporaryCredentialKind(requirement.temporaryCredentialKind);
    const newPassword = this.validatePolicy(submitted);

    // "Replacing" a CIN with another CIN is not a replacement.
    if (kind.isTemporaryShape?.(newPassword)) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.PASSWORD_REJECTED,
        this.message('errors.credentialSetupTemporaryShape', 'Choose a password that is not your temporary credential.'),
        400,
      );
    }

    const user = await this.users.getAuthRecordById(userId);
    if (!user?.password) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.SESSION_INVALID,
        this.message('errors.invalidCredentials', 'Invalid email or password'),
        401,
      );
    }

    if (await this.isCurrentPassword(newPassword, kind.normalize(newPassword), user.password)) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.SAME_PASSWORD,
        this.message('errors.credentialSetupSamePassword', 'Choose a password different from your current one.'),
        400,
      );
    }

    return newPassword;
  }

  /**
   * Runs inside the setup-session consumption transaction, so the password
   * update, the requirement completion, and the one-time session all commit or
   * roll back together.
   */
  private async persist(userId: string, password: string): Promise<string> {
    await this.userRecords.update(userId, { password });

    const completed = await this.requirements.completeRequirement(userId, PASSWORD_SETUP_PURPOSE);
    if (!completed) {
      // Lost the race with a concurrent consumption — roll the whole thing back.
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.ALREADY_COMPLETED,
        this.message('errors.credentialSetupAlreadyCompleted', 'The password was already replaced. Please sign in again.'),
        409,
      );
    }

    return userId;
  }

  private validatePolicy(submitted: string): string {
    const parsed = this.config.credentialSetup.password.passwordSchema.safeParse(submitted);
    if (!parsed.success) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.PASSWORD_REJECTED,
        parsed.error.issues[0]?.message ?? this.message('errors.credentialSetupPasswordRejected', 'Choose a different password.'),
        422,
      );
    }
    return parsed.data;
  }

  /**
   * The stored hash is of the *normalized* temporary credential, so a
   * differently-cased retype has to be compared in both forms.
   */
  private async isCurrentPassword(
    submitted: string,
    normalized: string,
    storedHash: string,
  ): Promise<boolean> {
    if (await this.validator.comparePassword(submitted, storedHash)) return true;
    if (normalized === submitted) return false;
    return this.validator.comparePassword(normalized, storedHash);
  }
}
