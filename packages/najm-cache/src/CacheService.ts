// ============================================================================
// CacheService.ts - Main Cache Service with Auto Driver Selection
// ============================================================================

import { Service, Meta, Inject } from 'najm-core';
import { CACHE_CONFIG } from './tokens';
import type { CacheConfig } from './types';
import type { Driver, DriverStats } from './drivers/Driver';
import { MemoryDriver } from './drivers/MemoryDriver';
import { RedisDriver, isRedisAvailable } from './drivers/RedisDriver';

/**
 * Cache Service - Main entry point for caching operations
 *
 * Automatically selects the appropriate driver:
 * - If `driver: 'redis'` and Redis URL provided and ioredis installed → Redis
 * - Otherwise → Memory (with warning if Redis was expected)
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private cache: CacheService) {}
 *
 *   async getData(id: string) {
 *     // Check cache first
 *     const cached = await this.cache.get(`data:${id}`);
 *     if (cached) return JSON.parse(cached);
 *
 *     // Fetch and cache
 *     const data = await this.fetchData(id);
 *     await this.cache.set(`data:${id}`, JSON.stringify(data), 60000); // 1 min TTL
 *     return data;
 *   }
 * }
 * ```
 */
@Service()
@Meta({ layer: 'plugin' })
export class CacheService implements Driver {
  private driver: Driver;
  private _type: 'memory' | 'redis';
  private config: CacheConfig;
  private pending = new Map<string, Promise<unknown>>();

  constructor(@Inject(CACHE_CONFIG) config?: CacheConfig | null) {
    this.config = config ?? {
      driver: 'auto',
      memory: {
        maxKeys: 10000,
        cleanupInterval: 60000,
      },
    };
    this.driver = this.createDriver();
    this._type = this.driver.type as 'memory' | 'redis';
  }

  /**
   * Current driver type
   */
  get type(): 'memory' | 'redis' {
    return this._type;
  }

  /**
   * Whether using Redis (for conditional logic)
   */
  get isRedis(): boolean {
    return this._type === 'redis';
  }

  /**
   * Whether using Memory (for conditional logic)
   */
  get isMemory(): boolean {
    return this._type === 'memory';
  }

  private createDriver(): Driver {
    const { driver, redis, memory } = this.config;

    // Explicit memory driver
    if (driver === 'memory') {
      return new MemoryDriver(memory);
    }

    // Redis driver requested
    if (driver === 'redis' || redis?.url) {
      if (!redis?.url) {
        console.warn('[najm/cache] Redis driver requested but no URL provided, using MemoryDriver');
        return new MemoryDriver(memory);
      }

      if (!isRedisAvailable()) {
        console.warn('[najm/cache] Redis URL provided but ioredis not installed, using MemoryDriver');
        console.warn('[najm/cache] Install ioredis with: bun add ioredis');
        return new MemoryDriver(memory);
      }

      return new RedisDriver({
        url: redis.url,
        keyPrefix: redis.keyPrefix,
        options: redis.options,
      });
    }

    // Default: memory
    return new MemoryDriver(memory);
  }

  // ============================================================================
  // Driver Interface Implementation
  // ============================================================================

  /**
   * Get a value by key
   */
  get(key: string): Promise<string | null> {
    return this.driver.get(key);
  }

  getMany(keys: string[]): Promise<Array<string | null>> {
    if (this.driver.getMany) return this.driver.getMany(keys);
    return Promise.all(keys.map((key) => this.driver.get(key)));
  }

  /**
   * Set a value with optional TTL
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, value: string, ttlMs?: number): Promise<void> {
    return this.driver.set(key, value, ttlMs);
  }

  /**
   * Delete a key
   */
  del(key: string): Promise<boolean> {
    return this.driver.del(key);
  }

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  /**
   * Increment a counter atomically
   * @param key - Cache key
   * @param ttlMs - TTL for new keys
   */
  incr(key: string, ttlMs?: number): Promise<{ count: number; resetAt: number }> {
    return this.driver.incr(key, ttlMs);
  }

  /**
   * Set expiration on key
   */
  expire(key: string, ttlMs: number): Promise<boolean> {
    return this.driver.expire(key, ttlMs);
  }

  /**
   * Get remaining TTL
   */
  ttl(key: string): Promise<number> {
    return this.driver.ttl(key);
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Get and parse JSON value
   */
  async getJson<T = unknown>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set JSON value
   */
  async setJson<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  /**
   * Get or set (cache-aside pattern)
   * @param key - Cache key
   * @param factory - Function to generate value if not cached
   * @param ttlMs - TTL for cached value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttlMs?: number
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const pending = (async () => {
      const value = await factory();
      await this.setJson(key, value, ttlMs);
      return value;
    })();

    this.pending.set(key, pending);
    try {
      return await pending;
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * Remove all keys from the store
   */
  async flush(): Promise<void> {
    if (this.driver.flush) {
      await this.driver.flush();
    }
  }

  /**
   * Get driver statistics
   */
  getStats(): DriverStats {
    if ('getStats' in this.driver && typeof this.driver.getStats === 'function') {
      return (this.driver as MemoryDriver).getStats();
    }
    return {
      type: this._type,
      connected: true,
    };
  }

  /**
   * Lifecycle hook: called by BootService during server teardown
   */
  async onDestroy(): Promise<void> {
    await this.destroy();
  }

  /**
   * Cleanup/destroy the driver
   */
  async destroy(): Promise<void> {
    this.pending.clear();
    if (this.driver.destroy) {
      await this.driver.destroy();
    }
  }
}
