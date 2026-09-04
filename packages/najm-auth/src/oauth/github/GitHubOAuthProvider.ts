import { Inject, Injectable } from 'najm-core';
import { AUTH_CONFIG } from '../../auth.tokens';
import type { AuthConfig, ResolvedGitHubOAuthConfig } from '../../types';
import type { GitHubIdentity, OAuthAttempt } from '../types';
import { OAuthFlowError } from '../types';

const AUTHORIZATION_ENDPOINT = 'https://github.com/login/oauth/authorize';
const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const USER_ENDPOINT = 'https://api.github.com/user';
const EMAILS_ENDPOINT = 'https://api.github.com/user/emails';
const API_VERSION = '2022-11-28';

interface GitHubUserResponse {
  id?: number | string;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
}

interface GitHubEmailResponse {
  email?: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GitHubOAuthProvider {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;

  authorizationUrl(attempt: OAuthAttempt, codeChallenge: string): string {
    const github = this.githubConfig();
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: github.clientId,
      redirect_uri: github.callbackUrl,
      scope: 'user:email',
      state: attempt.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchange(code: string, attempt: OAuthAttempt): Promise<GitHubIdentity> {
    const github = this.githubConfig();
    const token = await this.exchangeCode(code, attempt.codeVerifier, github);
    const headers = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'najm-auth',
      'x-github-api-version': API_VERSION,
    };

    const [user, emails] = await Promise.all([
      this.fetchJson<GitHubUserResponse>(USER_ENDPOINT, headers),
      this.fetchJson<GitHubEmailResponse[]>(EMAILS_ENDPOINT, headers),
    ]);
    const primary = Array.isArray(emails)
      ? emails.find((entry) => entry.primary === true && entry.verified === true)
      : undefined;
    const email = primary?.email?.trim().toLowerCase();
    const providerAccountId = user.id === undefined ? '' : String(user.id);
    const login = user.login?.trim() ?? '';
    if (!providerAccountId || !login || !email) {
      throw new OAuthFlowError('oauth_verified_email_required', 403);
    }

    return {
      provider: 'github',
      providerAccountId,
      email,
      emailVerified: true,
      login,
      name: user.name?.trim() || login,
      picture: user.avatar_url?.trim() || undefined,
    };
  }

  private async exchangeCode(
    code: string,
    codeVerifier: string,
    github: ResolvedGitHubOAuthConfig,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: github.clientId,
          client_secret: github.clientSecret,
          code,
          redirect_uri: github.callbackUrl,
          code_verifier: codeVerifier,
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
    const accessToken = (body as { access_token?: unknown; error?: unknown }).access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }
    return accessToken;
  }

  private async fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }
    if (!response.ok) throw new OAuthFlowError('oauth_provider_error', 502);
    try {
      return await response.json() as T;
    } catch {
      throw new OAuthFlowError('oauth_provider_error', 502);
    }
  }

  private githubConfig(): ResolvedGitHubOAuthConfig {
    const github = this.config.oauth?.github;
    if (!github) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return github;
  }
}
