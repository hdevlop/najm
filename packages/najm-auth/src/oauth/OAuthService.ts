import { Err, Inject, Injectable, Log, type ILogger } from 'najm-core';
import { AUTH_CONFIG } from '../auth.tokens';
import { AuthSessionService } from '../auth/AuthSessionService';
import { CredentialSetupRequirementService } from '../credentialSetup/CredentialSetupRequirementService';
import { CREDENTIAL_SETUP_CODES } from '../credentialSetup/errors';
import { PASSWORD_SETUP_PURPOSE } from '../credentialSetup/types';
import { TokenService } from '../tokens/TokenService';
import type { AuthConfig, OAuthProvider } from '../types';
import { UserService } from '../users/UserService';
import { GitHubOAuthProvider } from './github/GitHubOAuthProvider';
import { GoogleOAuthProvider } from './google/GoogleOAuthProvider';
import { OAuthAccountService } from './OAuthAccountService';
import { OAuthStateService } from './OAuthStateService';
import type { OAuthCallbackParams, OAuthIntent } from './types';
import { OAuthFlowError } from './types';

@Injectable()
export class OAuthService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;
  @Log() private logger!: ILogger;

  constructor(
    private state: OAuthStateService,
    private google: GoogleOAuthProvider,
    private github: GitHubOAuthProvider,
    private accounts: OAuthAccountService,
    private sessions: AuthSessionService,
    private tokens: TokenService,
    private users: UserService,
    private requirements?: CredentialSetupRequirementService,
  ) { }

  startGoogleLogin(returnTo?: string): string {
    return this.startLogin('google', returnTo);
  }

  startGitHubLogin(returnTo?: string): string {
    return this.startLogin('github', returnTo);
  }

  startGoogleLink(userId: string, returnTo?: string) {
    return this.startLink('google', userId, returnTo);
  }

  startGitHubLink(userId: string, returnTo?: string) {
    return this.startLink('github', userId, returnTo);
  }

  finishGoogleCallback(params: OAuthCallbackParams): Promise<string> {
    return this.finishCallback('google', params);
  }

  finishGitHubCallback(params: OAuthCallbackParams): Promise<string> {
    return this.finishCallback('github', params);
  }

  /**
   * Turn an expected OAuth start failure into the HTTP response it describes.
   *
   * `OAuthFlowError` carries the status it means — 404 for a provider that is
   * not configured, 400 for a return path the caller chose badly — but it is a
   * plain Error, so the framework's handler could only classify it as an
   * unhandled 500. A disabled provider and a bad query string are ordinary
   * client-visible outcomes, and reporting them as server faults hides real
   * ones. Only the stable `oauth_*` code crosses the boundary; provider
   * secrets, state, and codes never appear in it.
   *
   * The callback path deliberately does not go through here: it answers with a
   * redirect carrying the same code, and that contract is unchanged.
   */
  private failStart(error: unknown): never {
    if (error instanceof OAuthFlowError) {
      Err(error.oauthCode, error.status);
    }
    throw error;
  }

  private startLogin(provider: OAuthProvider, returnTo?: string): string {
    try {
      this.providerConfig(provider);
      const { attempt, codeChallenge } = this.state.create({
        provider,
        intent: 'login',
        returnTo,
      });
      return this.provider(provider).authorizationUrl(attempt, codeChallenge);
    } catch (error) {
      this.failStart(error);
    }
  }

  private async startLink(
    provider: OAuthProvider,
    userId: string,
    returnTo?: string,
  ): Promise<{ authorizationUrl: string }> {
    try {
      return await this.buildLinkStart(provider, userId, returnTo);
    } catch (error) {
      this.failStart(error);
    }
  }

  private async buildLinkStart(
    provider: OAuthProvider,
    userId: string,
    returnTo?: string,
  ): Promise<{ authorizationUrl: string }> {
    this.providerConfig(provider);
    const user = await this.users.getById(userId);
    if (user.status !== 'active') throw new OAuthFlowError('oauth_account_inactive', 403);
    const sessionVersion = await this.tokens.getSessionVersion(userId);
    const { attempt, codeChallenge } = this.state.create({
      provider,
      intent: 'link',
      returnTo,
      userId,
      sessionVersion,
    });
    return { authorizationUrl: this.provider(provider).authorizationUrl(attempt, codeChallenge) };
  }

  private async finishCallback(
    provider: OAuthProvider,
    params: OAuthCallbackParams,
  ): Promise<string> {
    try {
      this.providerConfig(provider);
      if (!params.state) throw new OAuthFlowError('oauth_state_invalid');
      const attempt = this.state.consume(provider, params.state);
      if (params.error) {
        throw new OAuthFlowError(params.error === 'access_denied'
          ? 'oauth_access_denied'
          : 'oauth_provider_error');
      }
      if (!params.code) throw new OAuthFlowError('oauth_provider_error');

      const identity = await this.provider(provider).exchange(params.code, attempt);
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
        if (await this.requirements?.isRequired(user.id, PASSWORD_SETUP_PURPOSE)) {
          throw new OAuthFlowError(CREDENTIAL_SETUP_CODES.OAUTH_BLOCKED, 403);
        }
        await this.sessions.establish(user);
      }

      return this.frontendSuccessUrl(provider, attempt.returnTo, attempt.intent);
    } catch (error) {
      const code = this.publicErrorCode(error);
      this.logger.warn('OAuth callback failed', { provider, code });
      return this.frontendErrorUrl(provider, code);
    }
  }

  private frontendSuccessUrl(
    provider: OAuthProvider,
    returnTo: string,
    mode: OAuthIntent,
  ): string {
    const providerConfig = this.providerConfig(provider);
    const url = new URL(providerConfig.frontendCallbackPath, this.config.frontendUrl);
    url.searchParams.set('provider', provider);
    url.searchParams.set('mode', mode);
    url.searchParams.set('returnTo', this.state.validateReturnTo(returnTo));
    return url.toString();
  }

  private frontendErrorUrl(provider: OAuthProvider, code: string): string {
    const path = this.config.oauth?.[provider]?.errorRedirectPath ?? '/login';
    const url = new URL(path, this.config.frontendUrl);
    url.searchParams.set('oauthError', code);
    url.searchParams.set('provider', provider);
    return url.toString();
  }

  private publicErrorCode(error: unknown): string {
    if (error instanceof OAuthFlowError) return error.oauthCode;
    if (error instanceof Error && /^oauth_[a-z0-9_]+$/.test(error.message)) return error.message;
    return 'oauth_provider_error';
  }

  private provider(provider: OAuthProvider) {
    return provider === 'google' ? this.google : this.github;
  }

  private providerConfig(provider: OAuthProvider) {
    const providerConfig = this.config.oauth?.[provider];
    if (!providerConfig) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return providerConfig;
  }
}
