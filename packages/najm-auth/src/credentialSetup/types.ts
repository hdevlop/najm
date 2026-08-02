export interface CredentialSetupOptions {
  /** Stable server-owned purpose, for example `password-setup`. */
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
