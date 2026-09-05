import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Err } from 'najm-core';
import { OAuthService } from '../src/oauth/OAuthService';
import { OAuthStateService } from '../src/oauth/OAuthStateService';
import { OAuthFlowError } from '../src/oauth/types';

/**
 * OAuth start failures are client-visible outcomes, not server faults.
 *
 * A provider that was never configured and a return path the caller chose
 * badly both have an intended status; reporting either as 500 both misleads
 * the client and buries genuine server errors in the same bucket.
 */

const GOOGLE_ONLY = {
  frontendUrl: 'https://app.example.test',
  oauth: {
    google: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.test/api/auth/oauth/google/callback',
      frontendCallbackPath: '/oauth/callback',
      scope: ['openid', 'email'],
      authorizationEndpoint: 'https://accounts.example.test/authorize',
    },
  },
};

function service(config: Record<string, unknown> = GOOGLE_ONLY) {
  const state = new OAuthStateService(
    { set: () => undefined, get: () => undefined, delete: () => undefined } as never,
    { encrypt: (value: string) => value, decrypt: (value: string) => value } as never,
  );

  const provider = {
    authorizationUrl: () => 'https://accounts.example.test/authorize?client_id=client-id',
  };

  const oauth = new OAuthService(
    state,
    provider as never,
    provider as never,
    {} as never,
    {} as never,
    { getSessionVersion: async () => 0 } as never,
    { getById: async () => ({ id: 'user-1', status: 'active' }) } as never,
  );
  (oauth as any).config = config;
  (oauth as any).logger = { warn: () => undefined, error: () => undefined };
  return oauth;
}

/**
 * The status the framework would actually answer with.
 *
 * Deliberately not `error.status`: OAuthFlowError has always carried the right
 * number in that field, and the defect was that nothing between the throw and
 * the response ever read it. Only Err.handle — the real mapping — can tell
 * these apart.
 */
const statusOf = async (run: () => unknown): Promise<number | undefined> => {
  try {
    await run();
    return undefined;
  } catch (error) {
    return Err.handle(error).status;
  }
};

describe('OAuth start errors carry their intended status', () => {
  test('a provider that is not configured is 404, not 500', async () => {
    const oauth = service();
    expect(await statusOf(() => oauth.startGitHubLogin('/dashboard'))).toBe(404);
    expect(await statusOf(() => oauth.startGitHubLink('user-1', '/dashboard'))).toBe(404);
  });

  test('a provider with no oauth configuration at all is 404', async () => {
    const oauth = service({ frontendUrl: 'https://app.example.test' });
    expect(await statusOf(() => oauth.startGoogleLogin())).toBe(404);
  });

  test('an invalid return path is 400, not 500', async () => {
    const oauth = service();

    for (const returnTo of [
      'https://evil.example.test/steal',
      '//evil.example.test',
      'javascript:alert(1)',
      '/ok\\..\\bad',
      'dashboard',
    ]) {
      expect(await statusOf(() => oauth.startGoogleLogin(returnTo))).toBe(400);
    }
  });

  test('an invalid return path on the link flow is 400 too', async () => {
    const oauth = service();
    expect(await statusOf(() => oauth.startGoogleLink('user-1', '//evil.example.test'))).toBe(400);
  });

  test('an inactive account linking is 403', async () => {
    const oauth = service();
    (oauth as any).users = { getById: async () => ({ id: 'user-1', status: 'inactive' }) };
    expect(await statusOf(() => oauth.startGoogleLink('user-1', '/dashboard'))).toBe(403);
  });

  test('a configured provider with a safe return path still starts normally', async () => {
    const oauth = service();
    expect(oauth.startGoogleLogin('/dashboard')).toContain('https://accounts.example.test/authorize');
    expect(await oauth.startGoogleLink('user-1', '/dashboard'))
      .toMatchObject({ authorizationUrl: expect.stringContaining('accounts.example.test') });
  });

  test('the surfaced message is the stable oauth code and nothing else', async () => {
    const oauth = service();
    try {
      oauth.startGitHubLogin();
      throw new Error('expected a rejection');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toBe('oauth_provider_disabled');
      expect(message).not.toContain('client-secret');
      expect(message).not.toContain('client-id');
    }
  });

  test('an unexpected failure is not disguised as a client error', async () => {
    const oauth = service();
    (oauth as any).state = {
      create: () => { throw new TypeError('provider adapter blew up'); },
      validateReturnTo: (v: string) => v,
    };

    // Only OAuthFlowError is translated; anything else keeps its own handling
    // rather than being relabelled as a 400.
    expect(() => oauth.startGoogleLogin('/dashboard')).toThrow(TypeError);
  });

  test('the callback contract is unchanged: it still redirects with the code', async () => {
    const oauth = service();
    const redirect = await oauth.finishGitHubCallback({ state: 'x'.repeat(48), code: 'c' });

    expect(redirect).toStartWith('https://app.example.test/login?');
    expect(redirect).toContain('oauthError=oauth_provider_disabled');
    expect(redirect).toContain('provider=github');
  });

  test('OAuthFlowError still carries the statuses those codes mean', () => {
    expect(new OAuthFlowError('oauth_provider_disabled', 404).status).toBe(404);
    expect(new OAuthFlowError('oauth_redirect_invalid').status).toBe(400);
  });
});
