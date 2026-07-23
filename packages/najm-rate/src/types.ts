import type { Context } from 'hono';

// ============================================================
// TIME & KEY TYPES
// ============================================================

/** Time window: number (ms) or string format */
export type TimeWindow = number | `${number}s` | `${number}m` | `${number}h` | `${number}d`;

/** Key strategies */
export type KeyStrategy = 'ip' | 'user' | 'api-key' | 'user+ip' | ((ctx: Context) => string | Promise<string>);

// ============================================================
// DECORATOR OPTIONS
// ============================================================

/** Options for @RateLimit decorator */
export interface RateLimitOptions {
  /** Maximum requests allowed in window */
  limit: number;
  /** Time window duration */
  window: TimeWindow;
  /** Key generation strategy (default: 'ip') */
  key?: KeyStrategy;
  /** Custom error message */
  message?: string;
  /** HTTP status code for rate limited responses (default: 429) */
  statusCode?: number;
  /** Include rate limit headers in response (default: true) */
  headers?: boolean;
  /** Skip rate limiting for this route */
  skip?: boolean;
}

// ============================================================
// PLUGIN CONFIG
// ============================================================

/**
 * Plugin configuration options
 *
 * Storage is handled by najm-cache plugin (auto-dependency).
 * Configure cache plugin for Redis support.
 */
export interface RateLimitPluginConfig {
  /** Enable/disable rate limiting (default: true) */
  enabled?: boolean;

  /** Global rate limit applied to all routes (optional) */
  defaultLimit?: number;

  /** Global time window (default: '15m') */
  defaultWindow?: TimeWindow;

  /** Key generation strategy (default: 'ip') */
  keyGenerator?: KeyStrategy;

  /** Skip rate limiting for certain requests */
  skip?: (ctx: Context) => boolean;

  /** Key prefix for storage (default: 'rl:') */
  keyPrefix?: string;

  /** Maximum keys to store in memory (default: 10000) - only applies to memory driver */
  maxKeys?: number;
}

// ============================================================
// INTERNAL TYPES
// ============================================================

/** Internal counter entry */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}
