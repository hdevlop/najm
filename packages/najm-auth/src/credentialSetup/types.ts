import type { ZodType } from 'zod';

export interface CredentialSetupOptions {
  /** Stable server-owned purpose, for example `password`. */
  purpose: string;
  /** HttpOnly browser-session cookie name (default: `najm.credential-setup`). */
  cookieName?: string;
  /** Session lifetime in milliseconds (default: 10 minutes, maximum: 24 hours). */
  ttlMs?: number;
  /** Cookie path (default: `/`). */
  cookiePath?: string;
}

export interface CredentialSetupSessionInfo {
  userId: string;
  purpose: string;
  expiresAt: string;
}

export interface CredentialSetupStarted {
  purpose: string;
  expiresAt: string;
}

/** The built-in setup purpose Najm mounts endpoints for. */
export const PASSWORD_SETUP_PURPOSE = 'password';

/** Durable "this user still owes a setup purpose" row. */
export interface CredentialSetupRequirementRow {
  userId: string;
  purpose: string;
  temporaryCredentialKind: string | null;
  required: boolean;
  completedAt: string | null;
}

/**
 * Login answer when the account may not have a normal session yet. Carries no
 * access or refresh token — only the fact that setup is pending and until when.
 */
export interface CredentialSetupPending {
  nextStep: 'credential_setup';
  setupRequired: true;
  purpose: string;
  expiresAt: string;
}

export interface CredentialSetupPasswordOptions {
  /**
   * Replacement-password schema. Default: 8–72 bytes with at least one letter
   * and one digit — deliberately case-agnostic, because a first-login
   * replacement is typed by someone who just proved they own the account.
   */
  passwordSchema?: ZodType<string>;
  /** Setup-session lifetime in milliseconds (default: 10 minutes). */
  ttlMs?: number;
  /** Setup cookie name (default: `najm.credential-setup`). */
  cookieName?: string;
}

export interface CredentialSetupConfig {
  password?: CredentialSetupPasswordOptions;
}

export interface ResolvedCredentialSetupConfig {
  password: Required<Pick<CredentialSetupPasswordOptions, 'ttlMs' | 'cookieName'>> & {
    passwordSchema: ZodType<string>;
  };
}
