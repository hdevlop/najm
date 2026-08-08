import { BaseError } from 'najm-core';

/**
 * Stable machine-readable codes for the credential-setup flow. Clients branch
 * on these; the accompanying message is localized and may change.
 */
export const CREDENTIAL_SETUP_CODES = {
  /** Login succeeded but the account must replace its credential first. */
  REQUIRED: 'AUTH_CREDENTIAL_SETUP_REQUIRED',
  /** No setup cookie was presented. */
  SESSION_REQUIRED: 'AUTH_CREDENTIAL_SETUP_SESSION_REQUIRED',
  /** The setup cookie is unknown, already used, or expired. */
  SESSION_INVALID: 'AUTH_CREDENTIAL_SETUP_SESSION_INVALID',
  /** Nothing was still required for this user and purpose. */
  ALREADY_COMPLETED: 'AUTH_CREDENTIAL_SETUP_ALREADY_COMPLETED',
  /** The replacement failed the configured policy. */
  PASSWORD_REJECTED: 'AUTH_CREDENTIAL_SETUP_PASSWORD_REJECTED',
  /** The replacement is the credential being replaced. */
  SAME_PASSWORD: 'AUTH_CREDENTIAL_SETUP_SAME_PASSWORD',
  /** OAuth cannot mint a session while a requirement is outstanding. */
  OAUTH_BLOCKED: 'oauth_credential_setup_required',
} as const;

export type CredentialSetupCode =
  (typeof CREDENTIAL_SETUP_CODES)[keyof typeof CREDENTIAL_SETUP_CODES];

export const credentialSetupError = (
  code: CredentialSetupCode,
  message: string,
  status = 400,
): never => {
  throw new BaseError(code, message, status);
};
