// ============================================================================
// types.ts - Cache Plugin Type Definitions
// ============================================================================

import type { MemoryDriverOptions } from './drivers/MemoryDriver';
import type { RedisClient } from './drivers/RedisDriver';

/**
 * Redis configuration options
 */
export interface RedisOptions {
  /**
   * Redis connection URL
   * Example: 'redis://localhost:6379' or 'redis://:password@host:6379/0'
   */
  url: string;

  /**
   * Key prefix for all operations (optional)
   * Example: 'myapp:' → all keys become 'myapp:key'
   */
  keyPrefix?: string;

  /**
   * Additional ioredis options
   */
  options?: Record<string, unknown>;

  /**
   * Pre-constructed client. Advanced: supply an existing connection instead of
   * letting the driver build one. The driver never inspects or logs the URL
   * when a client is provided.
   */
  client?: RedisClient;
}

/**
 * Cache plugin configuration options
 */
export interface CachePluginConfig {
  /**
   * Cache driver to use
   * - 'memory': In-memory store (default, good for dev/single-server)
   * - 'redis': Redis store (requires ioredis, good for production/multi-server)
   *
   * If not specified:
   * - Uses 'redis' if `redis.url` is provided and ioredis is installed
   * - Falls back to 'memory' otherwise
   */
  driver?: 'memory' | 'redis';

  /**
   * Redis configuration (required when driver is 'redis')
   */
  redis?: RedisOptions;

  /**
   * Memory driver options (used when driver is 'memory' or as fallback)
   */
  memory?: MemoryDriverOptions;

  /**
   * Require the selected driver instead of degrading to memory.
   *
   * With `required: true` a missing Redis URL, an unavailable Redis
   * implementation, or an unreachable server becomes a startup failure. Use it
   * wherever the cache backs a security control (rate limiting) and a silent
   * per-process memory bucket would weaken it.
   *
   * Errors raised in this mode never include the URL or its credentials.
   */
  required?: boolean;
}

/**
 * Internal resolved configuration
 */
export interface CacheConfig {
  driver: 'memory' | 'redis' | 'auto';
  redis?: RedisOptions;
  memory: MemoryDriverOptions;
  required: boolean;
}
