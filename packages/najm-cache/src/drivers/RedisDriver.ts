// ============================================================================
// RedisDriver.ts - Redis Cache Driver
// ============================================================================

import type { Driver, DriverStats } from './Driver';

/**
 * Redis-like interface
 * Compatible with ioredis and node-redis
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  set(key: string, value: string): Promise<'OK' | string>;
  setex(key: string, seconds: number, value: string): Promise<'OK' | string>;
  psetex(key: string, milliseconds: number, value: string): Promise<'OK' | string>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  multi(): RedisMulti;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
  ping(): Promise<'PONG' | string>;
  quit(): Promise<'OK' | string>;
  status?: string;
}

export interface RedisMulti {
  incr(key: string): this;
  ttl(key: string): this;
  pttl(key: string): this;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface RedisDriverOptions {
  /** Redis connection URL */
  url: string;
  /** Key prefix for all operations */
  keyPrefix?: string;
  /** ioredis options */
  options?: Record<string, unknown>;
  /** Pre-constructed client; bypasses internal client creation entirely. */
  client?: RedisClient;
}

/**
 * Redis cache driver
 *
 * Best for:
 * - Production environments
 * - Multi-server deployments
 * - High-traffic applications
 *
 * Benefits:
 * - Shared across server instances
 * - Survives server restarts
 * - Atomic operations (no race conditions)
 * - Automatic TTL-based expiration
 */
/**
 * Increment a counter and attach its expiry in one indivisible step.
 *
 * The previous implementation ran INCR inside MULTI and issued PEXPIRE
 * afterwards; a process failure between the two left a counter with no TTL,
 * which pins a rate-limit bucket open forever. Running both inside one script
 * removes that window. The `pttl < 0` branch also repairs any key that an
 * earlier build already left without an expiry.
 */
const INCR_WITH_TTL = `
local count = redis.call('INCR', KEYS[1])
local ttl = tonumber(ARGV[1])
local pttl = redis.call('PTTL', KEYS[1])
if ttl > 0 and (count == 1 or pttl < 0) then
  redis.call('PEXPIRE', KEYS[1], ttl)
  pttl = ttl
end
return {count, pttl}
`;

export class RedisDriver implements Driver {
  readonly type = 'redis' as const;

  private client: RedisClient | null = null;
  private keyPrefix: string;

  constructor(private options: RedisDriverOptions) {
    this.keyPrefix = options.keyPrefix ?? '';
    this.client = options.client ?? null;
  }

  /**
   * Get or create Redis client (lazy initialization)
   */
  private getClient(): RedisClient {
    if (!this.client) {
      // Dynamic import to make ioredis optional
      let Redis: any;
      try {
        Redis = require('ioredis').default || require('ioredis');
      } catch {
        throw new Error(
          '[najm/cache] Redis driver requires ioredis. Install it with: bun add ioredis'
        );
      }

      this.client = new Redis(this.options.url, {
        ...this.options.options,
        keyPrefix: this.keyPrefix,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });
    }
    return this.client;
  }

  private prefixKey(key: string): string {
    // ioredis handles prefix automatically, but for consistency
    return key;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(this.prefixKey(key));
  }

  async getMany(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    return this.getClient().mget(...keys.map((key) => this.prefixKey(key)));
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const k = this.prefixKey(key);
    if (ttlMs) {
      await this.getClient().psetex(k, ttlMs, value);
    } else {
      await this.getClient().set(k, value);
    }
  }

  async del(key: string): Promise<boolean> {
    const deleted = await this.getClient().del(this.prefixKey(key));
    return deleted > 0;
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.getClient().exists(this.prefixKey(key));
    return count > 0;
  }

  async incr(key: string, ttlMs?: number): Promise<{ count: number; resetAt: number }> {
    const k = this.prefixKey(key);
    const result = await this.getClient().eval(INCR_WITH_TTL, 1, k, String(ttlMs ?? 0));

    if (!Array.isArray(result)) {
      throw new Error('[najm/cache] Redis counter script returned an unexpected shape');
    }

    const count = Number(result[0]);
    const pttl = Number(result[1]);
    const resetAt = pttl > 0 ? Date.now() + pttl : Date.now() + (ttlMs ?? 0);

    return { count, resetAt };
  }

  /**
   * Connection probe. Resolves false on any failure so callers can report
   * availability without handling — or leaking — driver-level errors.
   */
  async ping(): Promise<boolean> {
    try {
      const reply = await this.getClient().ping();
      return typeof reply === 'string' && reply.toUpperCase() === 'PONG';
    } catch {
      return false;
    }
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.getClient().pexpire(this.prefixKey(key), ttlMs);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    const pttl = await this.getClient().pttl(this.prefixKey(key));
    return pttl; // Already in milliseconds
  }

  getStats(): DriverStats {
    return {
      type: 'redis',
      connected: this.client?.status === 'ready',
    };
  }

  async flush(): Promise<void> {
    // Redis flush is intentionally not implemented to avoid
    // accidentally clearing shared Redis databases.
    // Use key-specific deletion or separate Redis databases instead.
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

/**
 * Check if ioredis is available
 */
export function isRedisAvailable(): boolean {
  try {
    require.resolve('ioredis');
    return true;
  } catch {
    return false;
  }
}
