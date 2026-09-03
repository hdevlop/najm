import type { Context } from 'hono';

// ============================================================
// TIME & KEY TYPES
// ============================================================

/** Time window: number (ms) or string format */
export type TimeWindow = number | `${number}s` | `${number}m` | `${number}h` | `${number}d`;

/**
 * Package-resolved values handed to a custom key function.
 *
 * Consumers must take the client address from here rather than parsing
 * forwarding headers themselves, so every strategy keys on the same trusted
 * value.
 */
export interface RateLimitKeyContext {
  /**
   * Client address resolved through the configured `trustedProxyHops`
   * boundary, already normalized. Equal to the fixed `'unresolved'` token when
   * the forwarded chain could not be trusted.
   */
  clientIp: string;
}

/**
 * Custom key function.
 *
 * The second argument is additive: existing one-argument callbacks stay
 * source-compatible and keep type-checking.
 */
export type CustomRateLimitKey = (
  ctx: Context,
  keyContext: RateLimitKeyContext,
) => string | Promise<string>;

/** Key strategies */
export type KeyStrategy = 'ip' | 'user' | 'api-key' | 'user+ip' | CustomRateLimitKey;

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

  /**
   * Number of known proxies between this application and the client.
   *
   * - `0` refuses forwarded headers and keys on the socket peer address.
   * - A positive value indexes the `X-Forwarded-For` chain from the right, so
   *   entries an attacker prepends fall outside the boundary and cannot rotate
   *   buckets. A direct-to-single-reverse-proxy topology is exactly `1`.
   * - Omitting it selects the deprecated legacy behavior of trusting the
   *   leftmost forwarded value. That path is spoofable and is scheduled for
   *   removal in the next major release; declare your topology instead.
   *
   * Chains shorter than the boundary, malformed literals, ports, and empty
   * elements all fail closed into one fixed bucket rather than becoming
   * attacker-selected key material.
   */
  trustedProxyHops?: number;
}

// ============================================================
// INTERNAL TYPES
// ============================================================

/** Internal counter entry */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}
