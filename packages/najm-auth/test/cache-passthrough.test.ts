import 'reflect-metadata';
import { describe, test, expect } from 'bun:test';
import { auth } from '../src';

const jwt = {
  accessSecret: 'a'.repeat(40),
  refreshSecret: 'b'.repeat(40),
};

const base = { jwt, email: { provider: 'console' } } as const;

/**
 * Auth registers cache() as its own dependency, so a consumer cannot configure
 * the store by registering a cache plugin first — plugin order does not decide
 * it. These assertions pin the pass-through that makes it configurable.
 */
const dependencyConfig = (plugin: unknown, name: string): Record<string, unknown> => {
  const dependencies = (plugin as { dependencies?: unknown[] }).dependencies ?? [];
  const dependency = dependencies.find(
    (candidate) => (candidate as { name?: string })?.name === name,
  ) as { config?: Record<string, unknown> } | undefined;

  if (!dependency) throw new Error(`auth() did not register a "${name}" dependency`);

  return dependency.config ?? {};
};

const cacheConfigOf = (plugin: unknown) => dependencyConfig(plugin, 'cache');

describe('auth cache pass-through', () => {
  test('the default dependency still resolves to an unrequired memory cache', () => {
    const config = cacheConfigOf(auth({ ...base }));

    expect(config.driver).toBe('auto');
    expect(config.required).toBe(false);
  });

  test('a supplied cache config wins over the package default', () => {
    const config = cacheConfigOf(
      auth({
        ...base,
        cache: {
          driver: 'redis',
          required: true,
          redis: { url: 'redis://localhost:6379' },
        },
      }),
    );

    expect(config.driver).toBe('redis');
    expect(config.required).toBe(true);
  });

  test('the trusted-hop topology reaches the rate dependency', () => {
    const dependencies =
      (auth({ ...base, rateLimit: { trustedProxyHops: 1 } }) as { dependencies?: unknown[] })
        .dependencies ?? [];

    const rate = dependencies
      .map((dependency) => dependency as { config?: Record<string, unknown> })
      .find((dependency) => dependency?.config?.trustedProxyHops !== undefined);

    expect(rate?.config?.trustedProxyHops).toBe(1);
  });
});
