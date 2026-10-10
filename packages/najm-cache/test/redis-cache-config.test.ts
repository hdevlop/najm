import { describe, expect, test } from 'bun:test';
import Redis from 'ioredis';
import { redisCacheConfig, type RedisCacheClientOptions, type RedisConstructor } from '../src';

const SECRET = 'sup3rs3cret';

/** Records the clients it is asked to build; connects to nothing. */
function fakeRedis() {
  const built: Array<{ url: string; options: RedisCacheClientOptions; errorListeners: number }> = [];
  class FakeRedis {
    constructor(url: string, options: RedisCacheClientOptions) {
      built.push({ url, options, errorListeners: 0 });
    }
    on(event: 'error') {
      if (event === 'error') built[built.length - 1]!.errorListeners++;
      return this;
    }
  }
  return { Redis: FakeRedis as RedisConstructor, built };
}

describe('redisCacheConfig', () => {
  test('accepts the real ioredis constructor', () => {
    const Ctor: RedisConstructor = Redis;
    expect(typeof Ctor).toBe('function');
  });

  test('a URL builds one client with the shared options and an error listener', () => {
    const { Redis, built } = fakeRedis();
    const url = `redis://:${SECRET}@cache.internal:6379/0`;

    const config = redisCacheConfig({ url: ` ${url} `, Redis, keyPrefix: 'app:', required: true });

    expect(config.driver).toBe('redis');
    expect(config.required).toBe(true);
    expect(config.redis?.url).toBe(url);
    expect(config.redis?.keyPrefix).toBe('app:');
    expect(built).toHaveLength(1);
    expect(built[0]!.url).toBe(url);
    expect(built[0]!.errorListeners).toBe(1);
    expect(built[0]!.options).toMatchObject({ keyPrefix: 'app:', lazyConnect: true, maxRetriesPerRequest: 3 });

    const retry = built[0]!.options.retryStrategy;
    expect([1, 2, 3, 4].map(retry)).toEqual([100, 200, 300, null]);
  });

  test('no URL means memory when not required', () => {
    const { Redis, built } = fakeRedis();
    expect(redisCacheConfig({ url: undefined, Redis })).toEqual({ driver: 'memory', required: false });
    expect(redisCacheConfig({ url: '  ', Redis })).toEqual({ driver: 'memory', required: false });
    expect(built).toHaveLength(0);
  });

  test('required without a URL throws naming the variable', () => {
    const { Redis } = fakeRedis();
    expect(() => redisCacheConfig({ url: undefined, Redis, required: true })).toThrow('REDIS_URL is required.');
    expect(() => redisCacheConfig({ url: '', Redis, required: true, variable: 'CACHE_URL' }))
      .toThrow('CACHE_URL is required.');
  });

  test('the build phase uses unrequired memory and builds no client, whatever else is set', () => {
    const { Redis, built } = fakeRedis();
    expect(redisCacheConfig({ url: undefined, Redis, required: true, buildPhase: true }))
      .toEqual({ driver: 'memory', required: false });
    expect(redisCacheConfig({ url: 'not a url', Redis, required: true, buildPhase: true }))
      .toEqual({ driver: 'memory', required: false });
    expect(built).toHaveLength(0);
  });

  test('rejects URLs that are not redis:// or rediss:// with a host, without echoing them', () => {
    const { Redis, built } = fakeRedis();
    for (const url of [`http://:${SECRET}@cache:6379`, `${SECRET}`, `redis://`, `mysql://u:${SECRET}@h/db`]) {
      let message = '';
      try {
        redisCacheConfig({ url, Redis });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe('REDIS_URL must be a valid redis:// or rediss:// URL.');
      expect(message).not.toContain(SECRET);
    }
    expect(redisCacheConfig({ url: 'rediss://cache.example:6380', Redis }).driver).toBe('redis');
    expect(built).toHaveLength(1);
  });

  test('required needs a password in the URL', () => {
    const { Redis, built } = fakeRedis();
    expect(() => redisCacheConfig({ url: 'redis://cache.internal:6379', Redis, required: true }))
      .toThrow('REDIS_URL must include a password.');
    expect(built).toHaveLength(0);
    expect(redisCacheConfig({ url: 'redis://cache.internal:6379', Redis }).driver).toBe('redis');
  });

  test('without a key prefix the client gets none', () => {
    const { Redis, built } = fakeRedis();
    redisCacheConfig({ url: 'redis://localhost:6379', Redis });
    expect('keyPrefix' in built[0]!.options).toBe(false);
  });
});
