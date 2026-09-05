import "reflect-metadata";
import { describe, test, expect } from "bun:test";
import { CacheService, CacheConfigError, MemoryDriver, RedisDriver } from "../src";

/**
 * Minimal Redis stand-in that runs the driver's Lua by hand as one indivisible
 * step, and lets a test commit a competing write immediately before it. A
 * driver that read the value in one round trip and deleted in another would
 * delete whatever the competing write left behind.
 */
function scriptedRedis() {
  const store = new Map<string, string>();
  let interleave: (() => void) | null = null;

  return {
    store,
    beforeEval(hook: () => void) {
      interleave = hook;
    },
    client: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string) {
        store.set(key, value);
        return 'OK' as const;
      },
      async psetex(key: string, _ms: number, value: string) {
        store.set(key, value);
        return 'OK' as const;
      },
      async del(key: string) {
        return store.delete(key) ? 1 : 0;
      },
      async eval(script: string, _numKeys: number, key: string, expected: string) {
        if (!script.includes("'GET'") || !script.includes("'DEL'")) {
          throw new Error('unexpected script');
        }
        // Anything racing this call resolves before evaluation starts; from
        // here down the server runs the script with no interleaving.
        interleave?.();
        const current = store.get(key) ?? null;
        if (current !== expected) return 0;
        return store.delete(key) ? 1 : 0;
      },
      async mget() { return []; },
      async setex() { return 'OK' as const; },
      async exists(key: string) { return store.has(key) ? 1 : 0; },
      async incr() { return 1; },
      async expire() { return 1; },
      async pexpire() { return 1; },
      async ttl() { return -1; },
      async pttl() { return -1; },
      multi() { throw new Error('unused'); },
      async ping() { return 'PONG' as const; },
      async quit() { return 'OK' as const; },
    } as any,
  };
}

describe('atomic compare-and-delete', () => {
  test('memory driver lets exactly one concurrent caller consume a value', async () => {
    const service = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
    await service.set('one-time', 'jti-1');

    const results = await Promise.all([
      service.compareAndDelete('one-time', 'jti-1'),
      service.compareAndDelete('one-time', 'jti-1'),
      service.compareAndDelete('one-time', 'jti-1'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await service.get('one-time')).toBeNull();
    await service.destroy();
  });

  test('memory driver treats an expired entry as absent', async () => {
    const driver = new MemoryDriver({ cleanupInterval: 0 });
    await driver.set('one-time', 'jti-1', 5);
    await Bun.sleep(20);

    expect(await driver.compareAndDelete('one-time', 'jti-1')).toBe(false);
    driver.destroy();
  });

  test('memory driver never deletes a value it did not match', async () => {
    const driver = new MemoryDriver({ cleanupInterval: 0 });
    await driver.set('one-time', 'jti-2');

    expect(await driver.compareAndDelete('one-time', 'jti-1')).toBe(false);
    expect(await driver.get('one-time')).toBe('jti-2');
    driver.destroy();
  });

  test('a stale redis caller cannot delete the value that replaced its own', async () => {
    const redis = scriptedRedis();
    const driver = new RedisDriver({ url: 'redis://unused', client: redis.client });
    await driver.set('one-time', 'jti-1');

    // A newer token supersedes this caller's value just before its script
    // runs. Only the in-script comparison can save the newer value.
    redis.beforeEval(() => {
      redis.store.set('one-time', 'jti-2');
      redis.beforeEval(() => undefined);
    });

    expect(await driver.compareAndDelete('one-time', 'jti-1')).toBe(false);
    expect(redis.store.get('one-time')).toBe('jti-2');
  });

  test('redis driver consumes a matching value exactly once', async () => {
    const redis = scriptedRedis();
    const driver = new RedisDriver({ url: 'redis://unused', client: redis.client });
    await driver.set('one-time', 'jti-1');

    const results = await Promise.all([
      driver.compareAndDelete('one-time', 'jti-1'),
      driver.compareAndDelete('one-time', 'jti-1'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(redis.store.has('one-time')).toBe(false);
  });

  test('a driver without the primitive fails closed instead of emulating it', async () => {
    const service = new CacheService({ driver: 'memory', required: false, memory: {} } as any);
    // Own-property override: the method lives on the prototype, so `delete`
    // on the instance would leave it reachable.
    const driver = (service as unknown as { driver: Record<string, unknown> }).driver;
    driver.compareAndDelete = undefined;

    expect(service.compareAndDelete('one-time', 'jti-1')).rejects.toThrow(CacheConfigError);
    await service.destroy();
  });
});
