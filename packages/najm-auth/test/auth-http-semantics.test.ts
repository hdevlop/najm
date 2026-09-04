import { describe, expect, test } from 'bun:test';
import jwt from 'jsonwebtoken';
import { Err } from 'najm-core';
import { TokenService } from '../src/tokens/TokenService';

const config = {
  jwt: {
    accessSecret: 'access-secret-access-secret-access-secret',
    accessExpiresIn: '1h',
    refreshSecret: 'refresh-secret-refresh-secret-refresh-secret',
    refreshExpiresIn: '7d',
  },
  blacklistPrefix: 'auth:blacklist:',
};

describe('authentication HTTP semantics', () => {
  test('missing, invalid, and expired access tokens return safe 401 responses', async () => {
    const { service } = tokenService();
    const expired = jwt.sign(
      { userId: 'user-1', jti: 'expired-jti' },
      config.jwt.accessSecret,
      { expiresIn: -1 },
    );

    await expect401(() => service.extractAccessToken(''));
    await expect401(() => service.verifyAccessToken('not-a-jwt'));
    await expect401(() => service.verifyAccessToken(expired));
  });

  test.each([
    ['blacklisted token', (key: string) => key === 'auth:blacklist:jti-1'],
    ['revoked refresh family', (key: string) => key === 'auth:revoked-family:family-1'],
    ['revoked user session version', (key: string) => key === 'auth:session-version:user-1'],
  ])('%s returns a safe 401 response', async (_label, revoked) => {
    const { service } = tokenService({
      cacheGet: async (key) => revoked(key) ? '1' : null,
    });
    const accessToken = jwt.sign(
      {
        userId: 'user-1',
        jti: 'jti-1',
        tokenFamily: 'family-1',
        sessionVersion: 0,
      },
      config.jwt.accessSecret,
      { expiresIn: '1h' },
    );

    await expect401(() => service.verifyAccessToken(accessToken));
  });

  test('missing, invalid, and expired refresh tokens return safe 401 responses', async () => {
    const missing = tokenService();
    await expect401(() => missing.service.refreshTokens());

    const invalid = tokenService({
      refreshToken: 'not-a-jwt',
    });
    await expect401(() => invalid.service.refreshTokens());

    const expiredToken = jwt.sign(
      { userId: 'user-1', type: 'refresh', tokenFamily: 'family-1' },
      config.jwt.refreshSecret,
      { expiresIn: -1 },
    );
    const expired = tokenService({ refreshToken: expiredToken });
    await expect401(() => expired.service.refreshTokens());
  });

  test('a missing or reused refresh family returns a safe 401 response', async () => {
    const refreshToken = jwt.sign(
      { userId: 'user-1', type: 'refresh', tokenFamily: 'family-1' },
      config.jwt.refreshSecret,
      { expiresIn: '1h' },
    );
    const { service } = tokenService({ refreshToken });

    await expect401(() => service.refreshTokens());
  });
});

function tokenService(options: {
  refreshToken?: string;
  cacheGet?: (key: string) => Promise<string | null>;
} = {}) {
  const repository = {
    getByFamily: async () => null,
    getUser: async () => null,
  };
  const cookieManager = {
    getRefreshToken: () => options.refreshToken,
    clearRefreshToken: () => undefined,
    clearSessionCookie: () => undefined,
  };
  const cache = {
    get: options.cacheGet ?? (async () => null),
    set: async () => undefined,
    del: async () => false,
  };
  const service = new TokenService(
    repository as never,
    cookieManager as never,
    cache as never,
  );
  (service as any).config = config;
  (service as any).t = (key: string) => key;
  return { service };
}

async function expect401(action: () => unknown | Promise<unknown>) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();

  const response = Err.handle(caught);
  expect(response.status).toBe(401);
  const body = await response.json() as Record<string, unknown>;
  expect(body).toEqual({
    code: 'HTTP_401',
    message: expect.any(String),
    status: 401,
  });
  expect(JSON.stringify(body)).not.toMatch(
    /(?:Bearer\s+[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.)/,
  );
}
