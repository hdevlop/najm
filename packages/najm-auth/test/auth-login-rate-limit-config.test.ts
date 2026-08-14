import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, Post, Server } from 'najm-core';
import { RateLimit, rateLimit } from 'najm-rate';
import {
  AUTH_LOGIN_RATE_LIMIT_ENV,
  DEFAULT_AUTH_LOGIN_RATE_LIMIT,
  resolveAuthLoginRateLimitConfig,
} from '../src/auth/authLoginRateLimitConfig';
import { authIdentityRateLimitKey } from '../src/auth/AuthController';

let server: Server | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('auth login rate-limit environment', () => {
  test('defaults safely to enabled, 8 attempts, and 10 minutes', () => {
    expect(resolveAuthLoginRateLimitConfig({})).toEqual(
      DEFAULT_AUTH_LOGIN_RATE_LIMIT,
    );
  });

  test('accepts explicit enabled, limit, and window overrides', () => {
    expect(resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.enabled]: 'false',
      [AUTH_LOGIN_RATE_LIMIT_ENV.limit]: '2',
      [AUTH_LOGIN_RATE_LIMIT_ENV.window]: '1s',
    })).toEqual({ enabled: false, limit: 2, window: '1s' });
  });

  test('rejects invalid values instead of weakening startup silently', () => {
    expect(() => resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.enabled]: 'yes',
    })).toThrow(`${AUTH_LOGIN_RATE_LIMIT_ENV.enabled} must be true or false`);

    expect(() => resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.limit]: '0',
    })).toThrow(`${AUTH_LOGIN_RATE_LIMIT_ENV.limit} must be a positive safe integer`);

    expect(() => resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.window]: '500ms',
    })).toThrow(`${AUTH_LOGIN_RATE_LIMIT_ENV.window} must be a positive duration`);
  });

  test('honors a different retry limit and one-second reset window', async () => {
    const config = resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.enabled]: 'true',
      [AUTH_LOGIN_RATE_LIMIT_ENV.limit]: '2',
      [AUTH_LOGIN_RATE_LIMIT_ENV.window]: '1s',
    });

    @Controller('/auth-env-rate-test')
    class RateController {
      @Post('/login')
      @RateLimit({
        limit: config.limit,
        window: config.window,
        key: authIdentityRateLimitKey,
        skip: !config.enabled,
      })
      login(@Body() body: { identifier: string }) {
        return { identifier: body.identifier };
      }
    }

    const port = 36_000 + Math.floor(Math.random() * 1_000);
    server = new Server({ isolated: true }).use(rateLimit()).load(RateController);
    await server.listen(port);

    const login = () => fetch(`http://127.0.0.1:${port}/auth-env-rate-test/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.30',
      },
      body: JSON.stringify({
        identifier: 'rate-window@example.test',
        password: 'NeverLogged123',
      }),
    });

    expect((await login()).status).toBe(200);
    expect((await login()).status).toBe(200);

    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blocked.headers.get('Retry-After')).toBe('1');

    await Bun.sleep(1_100);
    const reset = await login();
    expect(reset.status).toBe(200);
    expect(reset.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  test('disables only the configured login decorator when explicitly false', async () => {
    const config = resolveAuthLoginRateLimitConfig({
      [AUTH_LOGIN_RATE_LIMIT_ENV.enabled]: 'false',
      [AUTH_LOGIN_RATE_LIMIT_ENV.limit]: '1',
      [AUTH_LOGIN_RATE_LIMIT_ENV.window]: '1s',
    });

    @Controller('/auth-disabled-rate-test')
    class RateController {
      @Post('/login')
      @RateLimit({
        limit: config.limit,
        window: config.window,
        key: authIdentityRateLimitKey,
        skip: !config.enabled,
      })
      login() {
        return { ok: true };
      }
    }

    const port = 37_000 + Math.floor(Math.random() * 1_000);
    server = new Server({ isolated: true }).use(rateLimit()).load(RateController);
    await server.listen(port);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(
        `http://127.0.0.1:${port}/auth-disabled-rate-test/login`,
        { method: 'POST' },
      );
      expect(response.status).toBe(200);
      expect(response.headers.has('X-RateLimit-Limit')).toBe(false);
    }
  });
});
