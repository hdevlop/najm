import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from 'jose';
import { resolveAuthConfig, selectAuthSchema } from '../src/AuthPlugin';
import { EncryptionService } from '../src/auth/EncryptionService';
import { AuthSessionService } from '../src/auth/AuthSessionService';
import { NajmAuthClient } from '../src/client/NajmAuthClient';
import { OAuthAccountRepository } from '../src/oauth/OAuthAccountRepository';
import { OAuthAccountService } from '../src/oauth/OAuthAccountService';
import { OAuthService } from '../src/oauth/OAuthService';
import { OAuthStateService } from '../src/oauth/OAuthStateService';
import { OAuthFlowError } from '../src/oauth/types';
import { GoogleOAuthProvider } from '../src/oauth/google/GoogleOAuthProvider';
import { GoogleTokenVerifier } from '../src/oauth/google/GoogleTokenVerifier';
import { authSchema } from '../src/schema/sqlite';

const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const jwtConfig = {
  accessSecret: 'access-secret-access-secret-access-secret',
  refreshSecret: 'refresh-secret-refresh-secret-refresh-secret',
};

const resolvedConfig = {
  jwt: {
    ...jwtConfig,
    accessExpiresIn: '1h',
    refreshExpiresIn: '7d',
  },
  refreshCookieName: 'refreshToken',
  refreshCookiePath: '/',
  database: 'default',
  blacklistPrefix: 'auth:blacklist:',
  defaultRole: null,
  frontendUrl: 'http://localhost:3000',
  registrationMode: 'active' as const,
  requireVerifiedEmail: false,
  lockout: { maxAttempts: 5, duration: '15m' },
  bcryptRounds: 10,
  session: { name: 'najm.session', maxAge: 300 },
  oauth: {
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      callbackUrl: 'http://localhost:3000/api/auth/oauth/google/callback',
      frontendCallbackPath: '/auth/oauth/callback',
      errorRedirectPath: '/login',
      allowSignup: true,
      autoLinkVerifiedEmail: false,
      allowedHostedDomains: [] as string[],
    },
  },
};

const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
const originalGoogleCallback = process.env.GOOGLE_CALLBACK_URL;
const originalEmailProvider = process.env.EMAIL_PROVIDER;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.EMAIL_PROVIDER = 'memory';
});

afterEach(() => {
  if (originalGoogleId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalGoogleId;
  if (originalGoogleSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
  else process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
  if (originalGoogleCallback === undefined) delete process.env.GOOGLE_CALLBACK_URL;
  else process.env.GOOGLE_CALLBACK_URL = originalGoogleCallback;
  if (originalEmailProvider === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = originalEmailProvider;
  globalThis.fetch = originalFetch;
});

describe('Google OAuth configuration', () => {
  test('existing auth remains valid when Google is omitted', () => {
    expect(resolveAuthConfig({ jwt: jwtConfig, encryptionKey }).oauth).toEqual({
      google: undefined,
    });
  });

  test('fails fast when enabled without credentials', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => resolveAuthConfig({
      jwt: jwtConfig,
      encryptionKey,
      oauth: {
        google: {
          callbackUrl: 'http://localhost:3000/api/auth/oauth/google/callback',
        },
      },
    })).toThrow(/GOOGLE_CLIENT_ID/);
  });

  test('enables Google with environment defaults and only requires overrides for special deployments', () => {
    process.env.GOOGLE_CLIENT_ID = 'environment-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'environment-client-secret';
    delete process.env.GOOGLE_CALLBACK_URL;

    expect(resolveAuthConfig({
      jwt: jwtConfig,
      encryptionKey,
      frontendUrl: 'https://app.example.com',
      oauth: { google: true },
    }).oauth.google).toMatchObject({
      clientId: 'environment-client-id',
      clientSecret: 'environment-client-secret',
      callbackUrl: 'https://app.example.com/api/auth/oauth/google/callback',
      frontendCallbackPath: '/auth/oauth/callback',
      errorRedirectPath: '/login',
      allowSignup: true,
      autoLinkVerifiedEmail: false,
    });

    process.env.GOOGLE_CALLBACK_URL = 'https://api.example.com/auth/google/callback';
    expect(resolveAuthConfig({
      jwt: jwtConfig,
      encryptionKey,
      frontendUrl: 'https://app.example.com',
      oauth: { google: true },
    }).oauth.google?.callbackUrl).toBe('https://api.example.com/auth/google/callback');
  });

  test('rejects non-HTTPS callbacks outside localhost', () => {
    expect(() => resolveAuthConfig({
      jwt: jwtConfig,
      encryptionKey,
      oauth: {
        google: {
          clientId: 'id',
          clientSecret: 'secret',
          callbackUrl: 'http://example.com/auth/callback',
        },
      },
    })).toThrow(/HTTPS/);
  });

  test('requires oauthAccounts on custom schemas when Google is enabled', () => {
    expect(() => selectAuthSchema({
      schema: {
        users: {},
        tokens: {},
        roles: {},
        permissions: {},
        rolePermissions: {},
      },
      oauth: {
        google: {
          clientId: 'id',
          clientSecret: 'secret',
          callbackUrl: 'http://localhost:3000/auth/callback',
        },
      },
    })).toThrow(/oauthAccounts/);
  });
});

describe('Google OAuth state and PKCE', () => {
  const makeStateService = () => {
    const values = new Map<string, string>();
    const cookies = {
      set(name: string, value: string) { values.set(name, value); },
      get(name: string) { return values.get(name); },
      delete(name: string) { values.delete(name); },
    };
    const encryption = new EncryptionService(encryptionKey);
    return { service: new OAuthStateService(cookies as any, encryption), values };
  };

  test('creates and consumes an encrypted attempt once', () => {
    const { service, values } = makeStateService();
    const { attempt, codeChallenge } = service.create({
      intent: 'login',
      returnTo: '/dashboard?tab=profile',
    });

    expect(codeChallenge).toHaveLength(43);
    expect(values.size).toBe(1);
    expect([...values.values()][0]).not.toContain(attempt.codeVerifier);
    expect(service.consume(attempt.state)).toMatchObject({
      intent: 'login',
      returnTo: '/dashboard?tab=profile',
    });
    expect(values.size).toBe(0);
    expect(() => service.consume(attempt.state)).toThrow(OAuthFlowError);
  });

  test('rejects open redirects', () => {
    const { service } = makeStateService();
    expect(() => service.create({ intent: 'login', returnTo: '//evil.example' })).toThrow();
    expect(() => service.create({ intent: 'login', returnTo: '/\\evil.example' })).toThrow();
    expect(() => service.create({ intent: 'login', returnTo: 'https://evil.example' })).toThrow();
  });
});

describe('Google provider protocol', () => {
  test('builds a code-flow URL with state, nonce, identity scopes, and PKCE', () => {
    const provider = new GoogleOAuthProvider({} as any);
    (provider as any).config = resolvedConfig;
    const url = new URL(provider.authorizationUrl({
      provider: 'google',
      intent: 'login',
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value',
      returnTo: '/',
      createdAt: Date.now(),
    }, 'challenge-value'));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('access_type')).toBe(false);
  });

  test('exchanges the code server-side and forwards only the ID token for verification', async () => {
    let requestBody = '';
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body);
      return new Response(JSON.stringify({
        access_token: 'discard-me',
        refresh_token: 'discard-me-too',
        id_token: 'verify-me',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const verifier = {
      verify: async (token: string, nonce: string) => ({
        provider: 'google' as const,
        providerAccountId: `${token}:${nonce}`,
        email: 'user@example.com',
        emailVerified: true as const,
      }),
    };
    const provider = new GoogleOAuthProvider(verifier as any);
    (provider as any).config = resolvedConfig;
    const identity = await provider.exchange('authorization-code', {
      provider: 'google',
      intent: 'login',
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
      returnTo: '/',
      createdAt: Date.now(),
    });

    expect(identity.providerAccountId).toBe('verify-me:nonce');
    expect(requestBody).toContain('grant_type=authorization_code');
    expect(requestBody).toContain('code_verifier=verifier');
    expect(requestBody).not.toContain('access_type');
  });
});

describe('Google ID-token verification', () => {
  test('uses sub as identity and validates nonce, audience, issuer, and verified email', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const verifier = new GoogleTokenVerifier();
    (verifier as any).config = resolvedConfig;
    (verifier as any).jwks = createLocalJWKSet({ keys: [jwk] });

    const token = await new SignJWT({
      nonce: 'expected-nonce',
      email: 'User@Example.com',
      email_verified: true,
      name: 'Najm User',
      picture: 'https://example.com/avatar.png',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://accounts.google.com')
      .setAudience('google-client-id')
      .setSubject('google-stable-sub')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier.verify(token, 'expected-nonce')).resolves.toMatchObject({
      providerAccountId: 'google-stable-sub',
      email: 'user@example.com',
      emailVerified: true,
    });
    await expect(verifier.verify(token, 'wrong-nonce')).rejects.toMatchObject({
      oauthCode: 'oauth_token_invalid',
    });
  });

  test('rejects invalid signature, issuer, audience, expiry, subject, email, and hosted domain', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const { privateKey: otherPrivateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'validation-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const verifier = new GoogleTokenVerifier();
    (verifier as any).config = {
      ...resolvedConfig,
      oauth: { google: { ...resolvedConfig.oauth.google, allowedHostedDomains: ['example.com'] } },
    };
    (verifier as any).jwks = createLocalJWKSet({ keys: [jwk] });

    const sign = (claims: Record<string, unknown> = {}, options: {
      issuer?: string;
      audience?: string;
      subject?: string;
      expired?: boolean;
      key?: CryptoKey;
    } = {}) => new SignJWT({
      nonce: 'nonce',
      email: 'user@example.com',
      email_verified: true,
      hd: 'example.com',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'validation-key' })
      .setIssuer(options.issuer ?? 'https://accounts.google.com')
      .setAudience(options.audience ?? 'google-client-id')
      .setSubject(options.subject ?? 'google-sub')
      .setIssuedAt()
      .setExpirationTime(options.expired ? Math.floor(Date.now() / 1000) - 10 : '5m')
      .sign(options.key ?? privateKey);

    const invalidTokens = await Promise.all([
      sign({}, { key: otherPrivateKey }),
      sign({}, { issuer: 'https://issuer.invalid' }),
      sign({}, { audience: 'wrong-client' }),
      sign({}, { expired: true }),
      sign({}, { subject: '' }),
      sign({ email_verified: false }),
      sign({ email: undefined }),
      sign({ hd: 'evil.example' }),
    ]);

    for (const token of invalidTokens) {
      await expect(verifier.verify(token, 'nonce')).rejects.toBeInstanceOf(OAuthFlowError);
    }
  });
});

describe('Google provider failures', () => {
  const provider = () => {
    const instance = new GoogleOAuthProvider({ verify: async () => ({}) } as any);
    (instance as any).config = resolvedConfig;
    return instance;
  };
  const attempt = {
    provider: 'google' as const,
    intent: 'login' as const,
    state: 'state',
    nonce: 'nonce',
    codeVerifier: 'verifier',
    returnTo: '/',
    createdAt: Date.now(),
  };

  test('maps network, bad status, and non-JSON responses to a stable error', async () => {
    globalThis.fetch = (async () => { throw new Error('network details'); }) as typeof fetch;
    await expect(provider().exchange('code', attempt)).rejects.toMatchObject({ oauthCode: 'oauth_provider_error' });

    globalThis.fetch = (async () => new Response('denied', { status: 400 })) as typeof fetch;
    await expect(provider().exchange('code', attempt)).rejects.toMatchObject({ oauthCode: 'oauth_provider_error' });

    globalThis.fetch = (async () => new Response('not-json', { status: 200 })) as typeof fetch;
    await expect(provider().exchange('code', attempt)).rejects.toMatchObject({ oauthCode: 'oauth_provider_error' });
  });
});

describe('OAuth account persistence', () => {
  test('enforces provider and user uniqueness and cascades on user deletion', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    sqlite.exec(`
      CREATE TABLE users (id text PRIMARY KEY, email text NOT NULL, password text NOT NULL);
      CREATE TABLE oauth_accounts (
        id text PRIMARY KEY,
        created_at text,
        updated_at text,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider text NOT NULL,
        provider_account_id text NOT NULL
      );
      CREATE UNIQUE INDEX oauth_accounts_provider_account_unique
        ON oauth_accounts(provider, provider_account_id);
      CREATE UNIQUE INDEX oauth_accounts_user_provider_unique
        ON oauth_accounts(user_id, provider);
    `);
    sqlite.exec("INSERT INTO users (id, email, password) VALUES ('user-1', 'one@example.com', 'hash')");
    const db = drizzle(sqlite, { schema: authSchema });
    const repository = new OAuthAccountRepository();
    (repository as any).db = db;
    (repository as any).schema = authSchema;

    const created = await repository.create({
      id: 'account-1',
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-sub',
    });
    expect(created?.userId).toBe('user-1');
    expect(await repository.create({
      id: 'account-2',
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'other-sub',
    })).toBeUndefined();

    sqlite.exec("DELETE FROM users WHERE id = 'user-1'");
    expect(await repository.getByProviderAccount('google', 'google-sub')).toBeUndefined();
    sqlite.close();
  });
});

describe('OAuth account resolution', () => {
  test('returning users are resolved by Google sub even when email changes', async () => {
    const users = {
      getById: async (id: string) => ({ id, email: 'original@example.com', status: 'active' }),
      findByEmailInsensitive: async () => { throw new Error('email lookup must not run'); },
    };
    const accounts = {
      getByProviderAccount: async () => ({ userId: 'user-1' }),
    };
    const service = new OAuthAccountService(accounts as any, users as any);
    (service as any).config = resolvedConfig;

    await expect(service.resolveForLogin({
      provider: 'google',
      providerAccountId: 'stable-sub',
      email: 'changed@example.com',
      emailVerified: true,
    })).resolves.toMatchObject({ id: 'user-1', email: 'original@example.com' });
  });

  test('does not auto-link an existing email by default', async () => {
    const service = new OAuthAccountService({
      getByProviderAccount: async () => undefined,
    } as any, {
      findByEmailInsensitive: async () => ({ id: 'legacy-user' }),
    } as any);
    (service as any).config = resolvedConfig;

    await expect(service.resolveForLogin({
      provider: 'google',
      providerAccountId: 'new-sub',
      email: 'legacy@example.com',
      emailVerified: true,
    })).rejects.toMatchObject({ oauthCode: 'oauth_account_link_required' });
  });

  test('creates a new user with an unexposed random password and provider link', async () => {
    let createdUser: Record<string, unknown> | undefined;
    let createdLink: Record<string, unknown> | undefined;
    const accounts = {
      getByProviderAccount: async () => undefined,
      create: async (data: Record<string, unknown>) => {
        createdLink = data;
        return { id: 'account-1', ...data };
      },
    };
    const users = {
      findByEmailInsensitive: async () => undefined,
      create: async (data: Record<string, unknown>) => {
        createdUser = data;
        return { id: 'user-1', email: data.email, status: 'active' };
      },
      getById: async () => ({ id: 'user-1', email: 'new@example.com', status: 'active' }),
    };
    const service = new OAuthAccountService(accounts as any, users as any);
    (service as any).config = resolvedConfig;

    const user = await service.resolveForLogin({
      provider: 'google',
      providerAccountId: 'new-sub',
      email: 'new@example.com',
      emailVerified: true,
      name: 'New User',
    });
    expect(user.id).toBe('user-1');
    expect(String(createdUser?.password)).toMatch(/Aa1$/);
    expect(String(createdUser?.password).length).toBeGreaterThan(40);
    expect(createdLink).toMatchObject({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'new-sub',
    });
  });

  test('auto-links a verified matching email only when explicitly enabled', async () => {
    let linkedUserId: string | undefined;
    const service = new OAuthAccountService({
      getByProviderAccount: async () => undefined,
      create: async (data: { userId: string }) => {
        linkedUserId = data.userId;
        return { id: 'link-1', ...data };
      },
    } as any, {
      findByEmailInsensitive: async () => ({ id: 'existing-user' }),
      getById: async () => ({ id: 'existing-user', status: 'active' }),
    } as any);
    (service as any).config = {
      ...resolvedConfig,
      oauth: { google: { ...resolvedConfig.oauth.google, autoLinkVerifiedEmail: true } },
    };

    await service.resolveForLogin({
      provider: 'google',
      providerAccountId: 'verified-sub',
      email: 'existing@example.com',
      emailVerified: true,
    });
    expect(linkedUserId).toBe('existing-user');
  });

  test('explicit linking rejects identities owned by another user', async () => {
    const service = new OAuthAccountService({
      getByProviderAccount: async () => ({ userId: 'other-user' }),
    } as any, {
      getById: async () => ({ id: 'current-user', status: 'active' }),
    } as any);
    (service as any).config = resolvedConfig;

    await expect(service.linkUser('current-user', {
      provider: 'google',
      providerAccountId: 'owned-sub',
      email: 'current@example.com',
      emailVerified: true,
    })).rejects.toMatchObject({ oauthCode: 'oauth_provider_account_linked' });
  });
});

describe('shared session issuance', () => {
  test('issues standard tokens and refresh/session cookies for OAuth users', async () => {
    const calls: string[] = [];
    const service = new AuthSessionService({
      deleteExpiredSessions: async () => { calls.push('prune'); },
      generateTokens: async () => ({
        accessToken: 'access',
        refreshToken: 'refresh',
        userId: 'user-1',
        tokenFamily: 'family',
        roles: ['user'],
        permissions: ['profile:read'],
        sessionVersion: 3,
      }),
    } as any, {
      updateLastLogin: async () => { calls.push('last-login'); },
    } as any, {
      setRefreshToken: (token: string) => { calls.push(`refresh:${token}`); },
      setSessionCookie: (session: any) => { calls.push(`session:${session.sessionVersion}`); },
    } as any);

    const result = await service.establish({
      id: 'user-1',
      email: 'user@example.com',
      status: 'active',
    } as any);
    expect(result).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
    expect(result).not.toHaveProperty('tokenFamily');
    expect(calls).toEqual(['prune', 'refresh:refresh', 'last-login', 'session:3']);
  });
});

describe('OAuth callback orchestration', () => {
  test('establishes a normal Najm session and redirects without credentials', async () => {
    let establishedUser: unknown;
    const attempt = {
      provider: 'google' as const,
      intent: 'login' as const,
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
      returnTo: '/dashboard',
      createdAt: Date.now(),
    };
    const service = new OAuthService(
      {
        consume: () => attempt,
        validateReturnTo: (value: string) => value,
      } as any,
      {
        exchange: async () => ({
          provider: 'google',
          providerAccountId: 'sub',
          email: 'user@example.com',
          emailVerified: true,
        }),
      } as any,
      {
        resolveForLogin: async () => ({ id: 'user-1', email: 'user@example.com', status: 'active' }),
      } as any,
      {
        establish: async (user: unknown) => { establishedUser = user; },
      } as any,
      {} as any,
      {} as any,
    );
    (service as any).config = resolvedConfig;
    (service as any).logger = { warn() { } };

    const redirect = await service.finishGoogleCallback({ code: 'code', state: 'state' });
    expect(establishedUser).toMatchObject({ id: 'user-1' });
    const url = new URL(redirect);
    expect(url.pathname).toBe('/auth/oauth/callback');
    expect(url.searchParams.get('returnTo')).toBe('/dashboard');
    expect(redirect).not.toContain('code=');
    expect(redirect).not.toContain('token');
  });
});

describe('OAuth client URLs', () => {
  test('supports relative baseURL and authPrefix', () => {
    const client = new NajmAuthClient({ baseURL: '/api', authPrefix: '/auth' });
    expect(client.getOAuthLoginUrl('google', { returnTo: '/dashboard' }))
      .toBe('/api/auth/oauth/google/start?returnTo=%2Fdashboard');
    expect(() => client.getOAuthLoginUrl('google', { returnTo: '//evil.example' })).toThrow();
    client.destroy();
  });

  test('supports absolute API base URLs', () => {
    const client = new NajmAuthClient({ baseURL: 'https://api.example.com/v1' });
    expect(client.getOAuthLoginUrl('google'))
      .toBe('https://api.example.com/v1/auth/oauth/google/start');
    client.destroy();
  });
});
