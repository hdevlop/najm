import { Inject, Injectable } from 'najm-core';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AUTH_CONFIG } from '../../auth.tokens';
import type { AuthConfig, ResolvedGoogleOAuthConfig } from '../../types';
import type { GoogleIdentity } from '../types';
import { OAuthFlowError } from '../types';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

@Injectable()
export class GoogleTokenVerifier {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  private jwks = GOOGLE_JWKS;

  async verify(idToken: string, nonce: string): Promise<GoogleIdentity> {
    const google = this.googleConfig();
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: google.clientId,
        algorithms: ['RS256'],
      });

      if (payload.nonce !== nonce) throw new OAuthFlowError('oauth_token_invalid');
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new OAuthFlowError('oauth_token_invalid');
      }
      if (typeof payload.email !== 'string' || !payload.email || payload.email_verified !== true) {
        throw new OAuthFlowError('oauth_verified_email_required');
      }

      const hostedDomain = typeof payload.hd === 'string' ? payload.hd.toLowerCase() : undefined;
      if (google.allowedHostedDomains.length > 0
        && (!hostedDomain || !google.allowedHostedDomains.includes(hostedDomain))) {
        throw new OAuthFlowError('oauth_hosted_domain_denied', 403);
      }

      return {
        provider: 'google',
        providerAccountId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: true,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
        hostedDomain,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('oauth_token_invalid');
    }
  }

  private googleConfig(): ResolvedGoogleOAuthConfig {
    const google = this.config.oauth?.google;
    if (!google) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return google;
  }
}
