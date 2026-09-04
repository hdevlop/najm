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

export interface OAuthIdentity {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: true;
  name?: string;
  picture?: string;
}

export interface GoogleIdentity extends OAuthIdentity {
  provider: 'google';
  hostedDomain?: string;
}

export interface GitHubIdentity extends OAuthIdentity {
  provider: 'github';
  login: string;
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
