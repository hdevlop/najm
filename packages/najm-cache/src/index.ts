// ============================================================================
// najm-cache - Unified Cache Plugin
// ============================================================================
// Provides caching with automatic driver selection (Memory or Redis).
// Falls back to in-memory storage when Redis is not available.
//
// Usage:
//   import { cache, CacheService } from 'najm-cache';
//
//   // Memory (default - no setup needed)
//   const server = new Server()
//     .use(cache())
//
//   // Redis (auto-fallback to memory if unavailable)
//   const server = new Server()
//     .use(cache({ redis: { url: process.env.REDIS_URL } }))
//
// In your services:
//   @Injectable()
//   class MyService {
//     constructor(private cache: CacheService) {}
//
//     async doSomething() {
//       await this.cache.set('key', 'value', 60000);  // 1 min TTL
//       const val = await this.cache.get('key');
//
//       // JSON helpers
//       await this.cache.setJson('user', { id: 1, name: 'John' });
//       const user = await this.cache.getJson<User>('user');
//
//       // Cache-aside pattern
//       const data = await this.cache.getOrSet('expensive', () => fetchData(), 300000);
//
//       // Rate limiting support
//       const { count, resetAt } = await this.cache.incr('ratelimit:user:1', 60000);
//     }
//   }
// ============================================================================

// Plugin
export { cache } from './CachePlugin';

// Service
export { CacheService } from './CacheService';

// Drivers
export { MemoryDriver, type MemoryDriverOptions } from './drivers/MemoryDriver';
export { RedisDriver, isRedisAvailable, type RedisDriverOptions } from './drivers/RedisDriver';
export type { Driver, DriverStats } from './drivers/Driver';

// Tokens
export { CACHE_CONFIG } from './tokens';

// Types
export type { CachePluginConfig, CacheConfig, RedisOptions } from './types';
