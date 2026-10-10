// ============================================================================
// redisCacheConfig.ts - Validated Redis cache config with an app-built client
// ============================================================================

import type { RedisClient } from './drivers/RedisDriver';
import type { CachePluginConfig } from './types';

/** The client options every Najm application uses for its cache connection. */
export interface RedisCacheClientOptions {
  keyPrefix?: string;
  lazyConnect: boolean;
  maxRetriesPerRequest: number;
  retryStrategy: (times: number) => number | null;
}

/**
 * The ioredis constructor (`import Redis from 'ioredis'`). The application
 * passes it so its bundler sees a static import; the driver's own fallback
 * loads ioredis with a dynamic `require`, which a server bundle such as Next's
 * does not trace.
 */
export type RedisConstructor = new (url: string, options: RedisCacheClientOptions) => {
  on(event: 'error', listener: (error: Error) => void): unknown;
};

export interface RedisCacheConfigOptions {
  /** The Redis URL as read from the environment; blank means unset. */
  url: string | undefined;
  /** The ioredis constructor. */
  Redis: RedisConstructor;
  /** Prefix for every key, e.g. `'myapp:'`. */
  keyPrefix?: string;
  /**
   * Redis must be configured and reachable (default false). Requires the URL
   * and a password in it. Use it wherever the cache backs a security control
   * such as rate limiting, typically `isProduction()`.
   */
  required?: boolean;
  /**
   * The process is a build, not a runtime (e.g. `isNextBuildPhase()`): use an
   * unrequired memory cache and contact no Redis server.
   */
  buildPhase?: boolean;
  /** Variable named in errors (default `'REDIS_URL'`). */
  variable?: string;
}

/**
 * Cache config for Redis when a URL is configured, otherwise memory.
 *
 * - `buildPhase` → memory, not required, whatever else is set.
 * - no URL → memory when not `required`; throws when `required`.
 * - a URL → must be `redis:` or `rediss:` with a hostname, and include a
 *   password when `required`; the client is built with the shared options.
 *
 * Errors name the variable and never include the URL or its credentials.
 */
export function redisCacheConfig({
  url,
  Redis,
  keyPrefix,
  required = false,
  buildPhase = false,
  variable = 'REDIS_URL',
}: RedisCacheConfigOptions): CachePluginConfig {
  if (buildPhase) return { driver: 'memory', required: false };

  const resolved = url?.trim() || undefined;
  if (!resolved) {
    if (required) throw new Error(`${variable} is required.`);
    return { driver: 'memory', required: false };
  }

  validateRedisUrl(resolved, required, variable);

  return {
    driver: 'redis',
    required,
    redis: { client: redisClient(Redis, resolved, keyPrefix), keyPrefix, url: resolved },
  };
}

function validateRedisUrl(url: string, required: boolean, variable: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${variable} must be a valid redis:// or rediss:// URL.`);
  }
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${variable} must be a valid redis:// or rediss:// URL.`);
  }
  if (required && !parsed.password) {
    throw new Error(`${variable} must include a password.`);
  }
}

function redisClient(Redis: RedisConstructor, url: string, keyPrefix: string | undefined): RedisClient {
  const client = new Redis(url, {
    ...(keyPrefix ? { keyPrefix } : {}),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 2_000)),
  });
  // Connection errors surface through the driver's commands; without a
  // listener ioredis reports each one as an unhandled 'error' event.
  client.on('error', () => void 0);
  return client as unknown as RedisClient;
}
