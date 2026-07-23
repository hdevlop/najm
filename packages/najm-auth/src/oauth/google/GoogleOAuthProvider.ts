import { Inject, Injectable } from 'najm-core';
import { AUTH_CONFIG } from '../../auth.tokens';
import type { AuthConfig, ResolvedGoogleOAuthConfig } from '../../types';
import type { GoogleIdentity, OAuthAttempt } from '../types';
import { OAuthFlowError } from '../types';
import { GoogleTokenVerifier } from './GoogleTokenVerifier';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

@Injectable()
export class GoogleOAuthProvider {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;

  constructor(private verifier: GoogleTokenVerifier) { }

  authorizationUrl(attempt: OAuthAttempt, codeChallenge: string): string {
    const google = this.googleConfig();
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchange(code: string, attempt: OAuthAttempt): Promise<GoogleIdentity> {
    const google = this.googleConfig();
    let response: Response;
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: google.clientId,
          client_secret: google.clientSecret,
          redirect_uri: google.callbackUrl,
          grant_type: 'authorization_code',
          code_verifier: attempt.codeVerifier,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }

    if (!response.ok) throw new OAuthFlowError('oauth_provider_error', 502);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }

    const idToken = (body as { id_token?: unknown }).id_token;
    if (typeof idToken !== 'string' || !idToken) {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }
    return this.verifier.verify(idToken, attempt.nonce);
  }

  private googleConfig(): ResolvedGoogleOAuthConfig {
    const google = this.config.oauth?.google;
    if (!google) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return google;
  }
}
