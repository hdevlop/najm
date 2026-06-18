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
export class RedisDriver implements Driver {
  readonly type = 'redis' as const;

  private client: RedisClient | null = null;
  private keyPrefix: string;

  constructor(private options: RedisDriverOptions) {
    this.keyPrefix = options.keyPrefix ?? '';
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
    const client = this.getClient();

    // Use MULTI for atomic increment + TTL check
    const multi = client.multi();
    multi.incr(k);
    multi.pttl(k);

    const results = await multi.exec();
    if (!results) {
      throw new Error('Redis MULTI failed');
    }

    const [incrResult, ttlResult] = results;
    const count = incrResult[1] as number;
    let pttl = ttlResult[1] as number;

    // If key is new (pttl = -1), set expiration
    if (pttl === -1 && ttlMs) {
      await client.pexpire(k, ttlMs);
      pttl = ttlMs;
    }

    const resetAt = pttl > 0 ? Date.now() + pttl : Date.now() + (ttlMs ?? 0);

    return { count, resetAt };
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
