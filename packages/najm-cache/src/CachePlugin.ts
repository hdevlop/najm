// ============================================================================
// CachePlugin.ts - Cache Plugin Factory
// ============================================================================

import { plugin } from 'najm-core';
import { CACHE_CONFIG } from './tokens';
import { CacheService } from './CacheService';
import type { CachePluginConfig, CacheConfig } from './types';

/**
 * Merge user config with defaults
 */
const mergeConfig = (config?: CachePluginConfig): CacheConfig => {
  return {
    driver: config?.driver ?? 'auto',
    redis: config?.redis,
    memory: {
      maxKeys: config?.memory?.maxKeys ?? 10000,
      cleanupInterval: config?.memory?.cleanupInterval ?? 60000,
    },
  };
};

/**
 * Cache Plugin
 *
 * Provides unified caching with automatic driver selection.
 * Falls back to in-memory storage when Redis is not available.
 *
 * @example Memory only (default)
 * ```typescript
 * import { cache } from 'najm-cache';
 *
 * const server = new Server()
 *   .use(cache())
 * ```
 *
 * @example Redis with auto-fallback
 * ```typescript
 * const server = new Server()
 *   .use(cache({
 *     redis: { url: process.env.REDIS_URL }
 *   }))
 * ```
 *
 * @example Explicit driver
 * ```typescript
 * const server = new Server()
 *   .use(cache({
 *     driver: 'redis',
 *     redis: { url: 'redis://localhost:6379' }
 *   }))
 * ```
 *
 * @example Memory with custom options
 * ```typescript
 * const server = new Server()
 *   .use(cache({
 *     driver: 'memory',
 *     memory: { maxKeys: 5000, cleanupInterval: 30000 }
 *   }))
 * ```
 */
export const cache = (config?: CachePluginConfig) =>
  plugin('cache')
    .version('1.0.0')
    .services(CacheService)
    .config(CACHE_CONFIG, mergeConfig(config))
    .build();
