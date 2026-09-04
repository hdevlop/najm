import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { resolveAuthConfig, selectAuthSchema } from '../src/AuthPlugin';
import { EncryptionService } from '../src/auth/EncryptionService';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { GitHubOAuthProvider } from '../src/oauth/github/GitHubOAuthProvider';
import { OAuthService } from '../src/oauth/OAuthService';
import { OAuthStateService } from '../src/oauth/OAuthStateService';
import { OAuthFlowError, type OAuthAttempt } from '../src/oauth/types';

const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const jwt = {
  accessSecret: 'access-secret-access-secret-access-secret',
  refreshSecret: 'refresh-secret-refresh-secret-refresh-secret',
};
const original = {
  id: process.env.GITHUB_CLIENT_ID,
  secret: process.env.GITHUB_CLIENT_SECRET,
  callback: process.env.GITHUB_CALLBACK_URL,
  emailProvider: process.env.EMAIL_PROVIDER,
  fetch: globalThis.fetch,
};

afterEach(() => {
  for (const [name, value] of [
    ['GITHUB_CLIENT_ID', original.id],
    ['GITHUB_CLIENT_SECRET', original.secret],
    ['GITHUB_CALLBACK_URL', original.callback],
    ['EMAIL_PROVIDER', original.emailProvider],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = original.fetch;
});

describe('GitHub OAuth configuration', () => {
  test('resolves environment defaults and the conventional callback', () => {
    process.env.EMAIL_PROVIDER = 'memory';
    process.env.GITHUB_CLIENT_ID = 'github-id';
    process.env.GITHUB_CLIENT_SECRET = 'github-secret';
    delete process.env.GITHUB_CALLBACK_URL;

    expect(resolveAuthConfig({
      jwt,
      encryptionKey,
      frontendUrl: 'https://app.example.com',
      oauth: { github: true },
    }).oauth.github).toEqual({
      clientId: 'github-id',
      clientSecret: 'github-secret',
      callbackUrl: 'https://app.example.com/api/auth/oauth/github/callback',
      frontendCallbackPath: '/auth/oauth/callback',
      errorRedirectPath: '/login',
      allowSignup: true,
      autoLinkVerifiedEmail: false,
    });
  });

  test('fails closed for missing credentials and insecure non-local callbacks', () => {
    process.env.EMAIL_PROVIDER = 'memory';
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(() => resolveAuthConfig({ jwt, encryptionKey, oauth: { github: true } }))
      .toThrow(/GITHUB_CLIENT_ID/);

    expect(() => resolveAuthConfig({
      jwt,
      encryptionKey,
      oauth: {
        github: {
          clientId: 'id',
          clientSecret: 'secret',
          callbackUrl: 'http://example.com/api/auth/oauth/github/callback',
        },
      },
    })).toThrow(/HTTPS/);
  });

  test('requires OAuth account storage for a custom schema', () => {
    expect(() => selectAuthSchema({
      schema: {
        users: {},
        tokens: {},
        roles: {},
        permissions: {},
        rolePermissions: {},
      },
      oauth: {
        github: {
          clientId: 'id',
          clientSecret: 'secret',
          callbackUrl: 'http://localhost:3000/api/auth/oauth/github/callback',
        },
      },
    })).toThrow(/oauthAccounts/);
  });
});

const providerConfig = {
  frontendUrl: 'https://app.example.com',
  oauth: {
    github: {
      clientId: 'github-id',
      clientSecret: 'github-secret',
      callbackUrl: 'https://app.example.com/api/auth/oauth/github/callback',
      frontendCallbackPath: '/auth/oauth/callback',
      errorRedirectPath: '/login',
      allowSignup: true,
      autoLinkVerifiedEmail: false,
    },
  },
};

const attempt: OAuthAttempt = {
  provider: 'github',
  intent: 'login',
  state: 'state-value',
  nonce: 'nonce-value',
  codeVerifier: 'verifier-value',
  returnTo: '/dashboard',
  createdAt: Date.now(),
};

describe('GitHub provider protocol', () => {
  test('builds an authorization-code URL with state, email scope, and PKCE', () => {
    const provider = new GitHubOAuthProvider();
    (provider as any).config = providerConfig;
    const url = new URL(provider.authorizationUrl(attempt, 'challenge-value'));

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('github-id');
    expect(url.searchParams.get('scope')).toBe('user:email');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  test('uses the stable user id and verified primary email without exposing the token', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/login/oauth/access_token')) {
        return Response.json({ access_token: 'provider-secret-token', token_type: 'bearer' });
      }
      if (url.endsWith('/user')) {
        return Response.json({ id: 12345, login: 'octocat', name: 'Mona', avatar_url: 'https://img.test/a' });
      }
      return Response.json([
        { email: 'other@example.com', verified: true, primary: false },
        { email: 'MONA@EXAMPLE.COM', verified: true, primary: true },
      ]);
    }) as typeof fetch;

    const provider = new GitHubOAuthProvider();
    (provider as any).config = providerConfig;
    const identity = await provider.exchange('authorization-code', attempt);

    expect(identity).toEqual({
      provider: 'github',
      providerAccountId: '12345',
      email: 'mona@example.com',
      emailVerified: true,
      login: 'octocat',
      name: 'Mona',
      picture: 'https://img.test/a',
    });
    expect(identity).not.toHaveProperty('accessToken');
    expect(String(requests[0]?.init?.body)).toContain('code_verifier=verifier-value');
    expect((requests[1]?.init?.headers as Record<string, string>).authorization)
      .toBe('Bearer provider-secret-token');
  });

  test('rejects an account without a verified primary email', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/login/oauth/access_token')) return Response.json({ access_token: 'token' });
      if (url.endsWith('/user')) return Response.json({ id: 12345, login: 'octocat' });
      return Response.json([{ email: 'hidden@example.com', verified: false, primary: true }]);
    }) as typeof fetch;

    const provider = new GitHubOAuthProvider();
    (provider as any).config = providerConfig;
    await expect(provider.exchange('code', attempt)).rejects.toMatchObject({
      oauthCode: 'oauth_verified_email_required',
      status: 403,
    });
  });
});

describe('provider-scoped state and orchestration', () => {
  test('does not let one provider consume another provider state', () => {
    const values = new Map<string, string>();
    const cookies = {
      set(name: string, value: string) { values.set(name, value); },
      get(name: string) { return values.get(name); },
      delete(name: string) { values.delete(name); },
    };
    const service = new OAuthStateService(cookies as any, new EncryptionService(encryptionKey));
    const created = service.create({ provider: 'github', intent: 'login' });

    expect(() => service.consume('google', created.attempt.state)).toThrow(OAuthFlowError);
    expect(service.consume('github', created.attempt.state).provider).toBe('github');
  });

  test('establishes the normal Najm session and returns a provider-tagged redirect', async () => {
    let established = false;
    const service = new OAuthService(
      { consume: () => attempt, validateReturnTo: (value: string) => value } as any,
      {} as any,
      { exchange: async () => ({
        provider: 'github',
        providerAccountId: '12345',
        email: 'mona@example.com',
        emailVerified: true,
        login: 'octocat',
      }) } as any,
      { resolveForLogin: async () => ({ id: 'user-1', email: 'mona@example.com', status: 'active' }) } as any,
      { establish: async () => { established = true; } } as any,
      {} as any,
      {} as any,
    );
    (service as any).config = providerConfig;
    (service as any).logger = { warn() { } };

    const redirect = new URL(await service.finishGitHubCallback({ code: 'code', state: 'state' }));
    expect(established).toBe(true);
    expect(redirect.pathname).toBe('/auth/oauth/callback');
    expect(redirect.searchParams.get('provider')).toBe('github');
    expect(redirect.searchParams.get('returnTo')).toBe('/dashboard');
  });

  test('builds GitHub client URLs through the generic provider contract', () => {
    const client = new NajmAuthClient({ baseURL: '/api', authPrefix: '/auth' });
    expect(client.getOAuthLoginUrl('github', { returnTo: '/dashboard' }))
      .toBe('/api/auth/oauth/github/start?returnTo=%2Fdashboard');
    client.destroy();
  });
});
