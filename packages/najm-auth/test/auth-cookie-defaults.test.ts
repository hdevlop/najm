import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Server } from 'najm-core';
import { cookies } from 'najm-cookies';
import { auth } from '../src';
import { defaultAuthCookieConfig } from '../src/AuthPlugin';
import { CredentialSetupService } from '../src/credentialSetup/CredentialSetupService';

const jwt = {
  accessSecret: 'a'.repeat(40),
  refreshSecret: 'b'.repeat(40),
};

const base = { jwt, email: { provider: { provider: 'console' } } } as const;

type Dependency = { name?: string; create?: () => { name: string; config?: unknown } };

/** The config of the cookies() plugin auth builds when the application has none. */
const cookieDependencyConfig = (authPlugin: unknown): unknown => {
  const dependencies = (authPlugin as { dependencies?: Dependency[] }).dependencies ?? [];
  const dependency = dependencies.find((candidate) => candidate?.name === 'cookies');

  if (!dependency?.create) throw new Error('auth() did not declare a lazy "cookies" dependency');

  return dependency.create().config;
};

const registeredPlugins = (server: Server) =>
  (server as unknown as { registry: { plugins: Map<string, { config?: unknown }> } }).registry.plugins;

const ignoredConfigWarnings = (server: Server): string[] =>
  (server as unknown as { registry: { takeIgnoredConfigWarnings(): string[] } }).registry.takeIgnoredConfigWarnings();

const originalFrontendUrl = process.env.FRONTEND_URL;

beforeEach(() => {
  delete process.env.FRONTEND_URL;
});

afterEach(() => {
  if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontendUrl;
});

describe('default auth cookie config', () => {
  test('a plain-HTTP loopback frontend drops Secure', () => {
    for (const frontendUrl of [
      'http://localhost:3000',
      'http://127.0.0.1:4181',
      'http://127.4.5.6',
      'http://[::1]:4181',
    ]) {
      expect(defaultAuthCookieConfig({ frontendUrl }), frontendUrl).toEqual({ secure: false });
    }
  });

  test('every other frontend keeps the najm-cookies defaults', () => {
    for (const frontendUrl of [
      'https://localhost',
      'https://127.0.0.1:4181',
      'https://app.example',
      'http://app.example',
      'http://10.0.0.5:3000',
      'http://192.168.1.20:3000',
      'http://127.0.0.1.example.com',
      'http://localhost.example.com',
      'not a url',
    ]) {
      expect(defaultAuthCookieConfig({ frontendUrl }), frontendUrl).toBeUndefined();
    }
  });

  test('an unset frontend does not use the localhost fallback', () => {
    expect(defaultAuthCookieConfig()).toBeUndefined();
    expect(defaultAuthCookieConfig({})).toBeUndefined();
  });

  test('FRONTEND_URL applies when frontendUrl is not given, and frontendUrl wins over it', () => {
    process.env.FRONTEND_URL = 'http://127.0.0.1:4181';
    expect(defaultAuthCookieConfig({})).toEqual({ secure: false });
    expect(defaultAuthCookieConfig({ frontendUrl: 'https://app.example' })).toBeUndefined();
  });
});

describe('auth cookie dependency', () => {
  test('without auth({ cookies }), auth builds its cookies plugin from the frontend', () => {
    expect(cookieDependencyConfig(auth({ ...base, frontendUrl: 'http://127.0.0.1:4181' }))).toEqual({
      secure: false,
    });
    expect(cookieDependencyConfig(auth({ ...base, frontendUrl: 'https://app.example' }))).toEqual({});
  });

  test('a supplied cookies config wins over the loopback default', () => {
    expect(
      cookieDependencyConfig(
        auth({ ...base, frontendUrl: 'http://127.0.0.1:4181', cookies: { secure: true, sameSite: 'Strict' } }),
      ),
    ).toEqual({ secure: true, sameSite: 'Strict' });
  });

  test('the application-registered cookies plugin wins, and the forwarded config is reported', () => {
    const server = new Server({ isolated: true, silent: true });

    server
      .use(cookies({ secure: true }))
      .use(auth({ ...base, cookies: { secure: false } }));

    expect(registeredPlugins(server).get('cookies')?.config).toEqual({ secure: true });

    const warnings = ignoredConfigWarnings(server);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('auth({ cookies })');
    expect(warnings[0]).toContain('"cookies" plugin is already registered');
  });

  test('an application cookies plugin with no forwarded config is used silently', () => {
    const server = new Server({ isolated: true, silent: true });

    server.use(cookies({ secure: false })).use(auth({ ...base, frontendUrl: 'https://app.example' }));

    expect(registeredPlugins(server).get('cookies')?.config).toEqual({ secure: false });
    expect(ignoredConfigWarnings(server)).toEqual([]);
  });
});

describe('credential-setup cookie', () => {
  test('takes Secure from the cookie plugin defaults instead of NODE_ENV', () => {
    const calls: Array<[string, string, Record<string, unknown> | undefined]> = [];
    const cookieService = {
      setSession: (name: string, _value: string, options?: Record<string, unknown>) => {
        calls.push(['setSession', name, options]);
      },
      delete: (name: string, options?: Record<string, unknown>) => {
        calls.push(['delete', name, options]);
      },
    };
    const service = new CredentialSetupService(
      {} as never,
      {} as never,
      {} as never,
      cookieService as never,
      {} as never,
    );
    const options = { cookieName: 'najm.credential-setup', cookiePath: '/api/auth' };
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      (service as unknown as { setCookie(token: string, value: typeof options): void }).setCookie('token', options);
      (service as unknown as { clearCookie(value: typeof options): void }).clearCookie(options);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    expect(calls).toEqual([
      ['setSession', 'najm.credential-setup', { httpOnly: true, path: '/api/auth', sameSite: 'Strict' }],
      ['delete', 'najm.credential-setup', { path: '/api/auth' }],
    ]);
  });
});
