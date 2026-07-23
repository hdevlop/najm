import type { OAuthProvider } from '../types';

export type OAuthIntent = 'login' | 'link';

export interface OAuthAttempt {
  provider: OAuthProvider;
  intent: OAuthIntent;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  userId?: string;
  sessionVersion?: number;
  createdAt: number;
}

export interface GoogleIdentity {
  provider: 'google';
  providerAccountId: string;
  email: string;
  emailVerified: true;
  name?: string;
  picture?: string;
  hostedDomain?: string;
}

export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
}

export class OAuthFlowError extends Error {
  constructor(
    public readonly oauthCode: string,
    public readonly status = 400,
  ) {
    super(oauthCode);
    this.name = 'OAuthFlowError';
  }
}
