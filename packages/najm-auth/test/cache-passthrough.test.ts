import 'reflect-metadata';
import { afterEach, beforeEach, describe, test, expect } from 'bun:test';
import { Server, plugin } from 'najm-core';
import { cache } from 'najm-cache';
import { email } from 'najm-email';
import { auth } from '../src';

const jwt = {
  accessSecret: 'a'.repeat(40),
  refreshSecret: 'b'.repeat(40),
};

const base = { jwt, email: { provider: 'console' } } as const;

type Dependency = { name?: string; create?: () => { name: string; config?: Record<string, unknown> } };

/**
 * Auth builds its cache, validation, rate-limit and email plugins only when
 * the application has not registered one of that name first. These
 * assertions pin the config auth uses when it does build them.
 */
const dependencyConfig = (authPlugin: unknown, name: string): Record<string, unknown> => {
  const dependencies = (authPlugin as { dependencies?: Dependency[] }).dependencies ?? [];
  const dependency = dependencies.find((candidate) => candidate?.name === name);

  if (!dependency?.create) throw new Error(`auth() did not declare a lazy "${name}" dependency`);

  return dependency.create().config ?? {};
};

/** The plugins `.use(...)` registered, by name, without booting the server. */
const registeredPlugins = (server: Server) =>
  (server as unknown as { registry: { plugins: Map<string, { config?: unknown }> } }).registry.plugins;

const ignoredConfigWarnings = (server: Server): string[] =>
  (server as unknown as { registry: { takeIgnoredConfigWarnings(): string[] } }).registry.takeIgnoredConfigWarnings();

describe('auth dependency config', () => {
  test('the default cache dependency still resolves to an unrequired memory cache', () => {
    const config = dependencyConfig(auth({ ...base }), 'cache');

    expect(config.driver).toBe('auto');
    expect(config.required).toBe(false);
  });

  test('a supplied cache config wins over the package default', () => {
    const config = dependencyConfig(
      auth({
        ...base,
        cache: {
          driver: 'redis',
          required: true,
          redis: { url: 'redis://localhost:6379' },
        },
      }),
      'cache',
    );

    expect(config.driver).toBe('redis');
    expect(config.required).toBe(true);
  });

  test('the trusted-hop topology reaches the rate-limit dependency', () => {
    const config = dependencyConfig(auth({ ...base, rateLimit: { trustedProxyHops: 1 } }), 'rate-limit');

    expect(config.trustedProxyHops).toBe(1);
  });
});

describe('auth uses the plugins the application registered', () => {
  const originalProvider = process.env.EMAIL_PROVIDER;

  beforeEach(() => {
    delete process.env.EMAIL_PROVIDER;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = originalProvider;
  });

  test('auth() starts without EMAIL_PROVIDER when the application registers email itself', () => {
    const server = new Server({ isolated: true, silent: true });

    expect(() => server
      .use(email({ provider: 'console' }))
      .use(auth({ jwt }))).not.toThrow();

    expect(registeredPlugins(server).get('email')?.config).toMatchObject({ provider: 'console' });
    expect(ignoredConfigWarnings(server)).toEqual([]);
  });

  test('without an application email plugin, auth still requires a provider', () => {
    const server = new Server({ isolated: true, silent: true });

    expect(() => server.use(auth({ jwt }))).toThrow();
  });

  test('the application-registered cache wins, and the forwarded config is reported', () => {
    const server = new Server({ isolated: true, silent: true });

    server
      .use(cache({ driver: 'memory', required: false }))
      .use(auth({ ...base, cache: { driver: 'redis', required: true, redis: { url: 'redis://localhost:6379' } } }));

    expect(registeredPlugins(server).get('cache')?.config).toMatchObject({ driver: 'memory' });

    const warnings = ignoredConfigWarnings(server);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('auth({ cache })');
    expect(warnings[0]).toContain('"cache" plugin is already registered');
  });

  test('each ignored option is named once; options auth used are not reported', () => {
    const server = new Server({ isolated: true, silent: true });

    server
      .use(plugin('rate-limit').build())
      .use(email({ provider: 'console' }))
      .use(auth({ ...base, rateLimit: { trustedProxyHops: 1 }, cache: { driver: 'memory' } }));

    const warnings = ignoredConfigWarnings(server);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((warning) => warning.includes('auth({ rateLimit })'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('auth({ email })'))).toBe(true);
    expect(registeredPlugins(server).get('cache')?.config).toMatchObject({ driver: 'memory' });
    expect(ignoredConfigWarnings(server)).toEqual([]);
  });
});
