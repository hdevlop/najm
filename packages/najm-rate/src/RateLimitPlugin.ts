import { plugin } from 'najm-core';
import { cache } from 'najm-cache';
import { RateLimitService } from './RateLimitService';
import { RATE_LIMIT_CONFIG } from './tokens';
import type { RateLimitPluginConfig } from './types';

/**
 * Rate limiting plugin with automatic caching support
 *
 * Uses najm-cache for storage (Memory by default, Redis when configured).
 * No additional setup needed - just works out of the box.
 *
 * @example Basic usage (uses cache plugin's storage)
 * ```typescript
 * import { Server } from 'najm-core';
 * import { rateLimit } from 'najm-rate';
 *
 * new Server()
 *   .use(rateLimit({ defaultLimit: 100, defaultWindow: '15m' }))
 *   .listen(3000);
 * ```
 *
 * @example With Redis (configure cache plugin)
 * ```typescript
 * import { Server } from 'najm-core';
 * import { cache } from 'najm-cache';
 * import { rateLimit } from 'najm-rate';
 *
 * new Server()
 *   .use(cache({ redis: { url: process.env.REDIS_URL } }))
 *   .use(rateLimit({ defaultLimit: 100, defaultWindow: '15m' }))
 *   .listen(3000);
 * ```
 *
 * @example With route-specific limits
 * ```typescript
 * import { RateLimit } from 'najm-rate';
 *
 * @Controller('/api')
 * class ApiController {
 *   @Get('/data')
 *   @RateLimit({ limit: 10, window: '1m' })
 *   getData() {
 *     return { data: 'limited' };
 *   }
 * }
 * ```
 *
 * Configuration options:
 * - enabled: Enable/disable rate limiting (default: true)
 * - defaultLimit: Global rate limit applied to all routes
 * - defaultWindow: Global time window (default: '15m')
 * - keyGenerator: Key generation strategy (default: 'ip')
 * - skip: Function to skip rate limiting for certain requests
 * - keyPrefix: Storage key prefix (default: 'rl:')
 * - maxKeys: Maximum keys to store in memory (default: 10000)
 */
export const rateLimit = (config?: RateLimitPluginConfig) => {
  const finalConfig: RateLimitPluginConfig = {
    enabled: config?.enabled ?? true,
    defaultWindow: config?.defaultWindow ?? '15m',
    keyGenerator: config?.keyGenerator ?? 'ip',
    keyPrefix: config?.keyPrefix ?? 'rl:',
    trustedProxyHops: config?.trustedProxyHops,
    ...config,
  };

  // Pass maxKeys to cache plugin if specified
  const cacheConfig = config?.maxKeys ? { memory: { maxKeys: config.maxKeys } } : undefined;

  return plugin('rate-limit')
    .version('2.0.0')
    .depends(cache(cacheConfig)) // Auto-depend on cache plugin with optional config
    .services(RateLimitService)
    .config(RATE_LIMIT_CONFIG, finalConfig)
    .build();
};
