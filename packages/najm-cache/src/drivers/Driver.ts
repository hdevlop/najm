// ============================================================================
// Driver.ts - Cache Driver Interface
// ============================================================================

/**
 * Cache driver interface
 * Implement this to create custom storage backends (Redis, Memcached, etc.)
 */
export interface Driver {
  /** Driver type identifier */
  readonly type: 'memory' | 'redis' | string;

  /**
   * Get a value by key
   * @returns The value or null if not found/expired
   */
  get(key: string): Promise<string | null>;

  /** Get multiple values in key order. */
  getMany?(keys: string[]): Promise<Array<string | null>>;

  /**
   * Set a value with optional TTL
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlMs - Time to live in milliseconds (optional)
   */
  set(key: string, value: string, ttlMs?: number): Promise<void>;

  /**
   * Delete a key
   * @returns true if deleted, false if not found
   */
  del(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Atomically delete a key only if it still holds `expected`.
   *
   * This is the one-time-consumption primitive: exactly one concurrent caller
   * can observe `true` for a given stored value. It exists because a separate
   * `get()` + `del()` pair leaves a window in which two callers both read the
   * same value and both proceed.
   *
   * Optional on the interface so third-party drivers keep compiling, but a
   * driver that cannot implement it indivisibly must leave it undefined rather
   * than approximate it — `CacheService.compareAndDelete()` fails closed when
   * the primitive is missing.
   *
   * @returns true only for the caller whose comparison matched and whose
   * delete removed the key. A missing, expired, or differing value returns
   * false without deleting anything.
   */
  compareAndDelete?(key: string, expected: string): Promise<boolean>;

  /**
   * Increment a counter (atomic)
   * Creates key with value 1 if it doesn't exist
   * @param key - Cache key
   * @param ttlMs - TTL in milliseconds (only applied on first increment)
   * @returns Current count and reset timestamp
   */
  incr(key: string, ttlMs?: number): Promise<{ count: number; resetAt: number }>;

  /**
   * Set expiration on existing key
   * @param key - Cache key
   * @param ttlMs - TTL in milliseconds
   */
  expire(key: string, ttlMs: number): Promise<boolean>;

  /**
   * Get remaining TTL for a key
   * @returns TTL in milliseconds, -1 if no expiry, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Remove all keys from the store
   */
  flush?(): Promise<void> | void;

  /**
   * Liveness probe for stores that hold a connection.
   * Must resolve false rather than reject, and must never surface connection
   * details (URL, credentials) to the caller.
   */
  ping?(): Promise<boolean>;

  /**
   * Cleanup resources (optional)
   */
  destroy?(): Promise<void> | void;
}

/**
 * Driver statistics
 */
export interface DriverStats {
  type: 'memory' | 'redis' | string;
  connected: boolean;
  keys?: number;
  totalKeys?: number;
  activeKeys?: number;
  maxKeys?: number;
}
