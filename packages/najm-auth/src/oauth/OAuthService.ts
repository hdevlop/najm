import { Inject, Injectable, Log, type ILogger } from 'najm-core';
import { AUTH_CONFIG } from '../auth.tokens';
import { AuthSessionService } from '../auth/AuthSessionService';
import { TokenService } from '../tokens/TokenService';
import type { AuthConfig } from '../types';
import { UserService } from '../users/UserService';
import { GoogleOAuthProvider } from './google/GoogleOAuthProvider';
import { OAuthAccountService } from './OAuthAccountService';
import { OAuthStateService } from './OAuthStateService';
import type { OAuthCallbackParams } from './types';
import { OAuthFlowError } from './types';

@Injectable()
export class OAuthService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @Log() private logger!: ILogger;

  constructor(
    private state: OAuthStateService,
    private google: GoogleOAuthProvider,
    private accounts: OAuthAccountService,
    private sessions: AuthSessionService,
    private tokens: TokenService,
    private users: UserService,
  ) { }

  startGoogleLogin(returnTo?: string): string {
    this.googleConfig();
    const { attempt, codeChallenge } = this.state.create({ intent: 'login', returnTo });
    return this.google.authorizationUrl(attempt, codeChallenge);
  }

  async startGoogleLink(userId: string, returnTo?: string): Promise<{ authorizationUrl: string }> {
    this.googleConfig();
    const user = await this.users.getById(userId);
    if (user.status !== 'active') throw new OAuthFlowError('oauth_account_inactive', 403);
    const sessionVersion = await this.tokens.getSessionVersion(userId);
    const { attempt, codeChallenge } = this.state.create({
      intent: 'link',
      returnTo,
      userId,
      sessionVersion,
    });
    return { authorizationUrl: this.google.authorizationUrl(attempt, codeChallenge) };
  }

  async finishGoogleCallback(params: OAuthCallbackParams): Promise<string> {
    try {
      this.googleConfig();
      if (!params.state) throw new OAuthFlowError('oauth_state_invalid');
      const attempt = this.state.consume(params.state);
      if (params.error) {
        throw new OAuthFlowError(params.error === 'access_denied'
          ? 'oauth_access_denied'
          : 'oauth_provider_error');
      }
      if (!params.code) throw new OAuthFlowError('oauth_provider_error');

      const identity = await this.google.exchange(params.code, attempt);
      if (attempt.intent === 'link') {
        if (!attempt.userId || attempt.sessionVersion === undefined) {
          throw new OAuthFlowError('oauth_state_invalid');
        }
        const currentVersion = await this.tokens.getSessionVersion(attempt.userId);
        if (currentVersion !== attempt.sessionVersion) {
          throw new OAuthFlowError('oauth_link_session_expired', 401);
        }
        await this.accounts.linkUser(attempt.userId, identity);
      } else {
        const user = await this.accounts.resolveForLogin(identity);
        await this.sessions.establish(user);
      }

      return this.frontendSuccessUrl(attempt.returnTo, attempt.intent);
    } catch (error) {
      const code = this.publicErrorCode(error);
      this.logger.warn('Google OAuth callback failed', { provider: 'google', code });
      return this.frontendErrorUrl(code);
    }
  }

  private frontendSuccessUrl(returnTo: string, mode: 'login' | 'link'): string {
    const google = this.googleConfig();
    const url = new URL(google.frontendCallbackPath, this.config.frontendUrl);
    url.searchParams.set('provider', 'google');
    url.searchParams.set('mode', mode);
    url.searchParams.set('returnTo', this.state.validateReturnTo(returnTo));
    return url.toString();
  }

  private frontendErrorUrl(code: string): string {
    const path = this.config.oauth?.google?.errorRedirectPath ?? '/login';
    const url = new URL(path, this.config.frontendUrl);
    url.searchParams.set('oauthError', code);
    return url.toString();
  }

  private publicErrorCode(error: unknown): string {
    if (error instanceof OAuthFlowError) return error.oauthCode;
    if (error instanceof Error && /^oauth_[a-z0-9_]+$/.test(error.message)) return error.message;
    return 'oauth_provider_error';
  }

  private googleConfig() {
    const google = this.config.oauth?.google;
    if (!google) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return google;
  }
}
