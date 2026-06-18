// ============================================================================
// MemoryDriver.ts - In-Memory Cache Driver
// ============================================================================

import type { Driver, DriverStats } from './Driver';

export interface MemoryDriverOptions {
  /** Maximum keys to store (default: 10000) */
  maxKeys?: number;
  /** Cleanup interval in ms (default: 60000 = 1 minute) */
  cleanupInterval?: number;
}

interface CacheEntry {
  value: string;
  expiresAt: number | null; // null = no expiration
}

/**
 * In-memory cache driver
 *
 * Best for:
 * - Development and testing
 * - Single-server deployments
 * - Low-traffic applications
 *
 * Limitations:
 * - Not shared across server instances
 * - Lost on server restart
 * - Memory bound (use maxKeys to limit)
 */
export class MemoryDriver implements Driver {
  readonly type = 'memory' as const;

  private data = new Map<string, CacheEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private maxKeys: number;

  constructor(options: MemoryDriverOptions = {}) {
    this.maxKeys = options.maxKeys ?? 10000;

    const cleanupInterval = options.cleanupInterval ?? 60000;
    if (cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);
      // Don't prevent process from exiting
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async getMany(keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    // Check max keys limit before adding new key
    if (!this.data.has(key) && this.data.size >= this.maxKeys) {
      this.cleanup();
      // If still at limit after cleanup, remove oldest entry
      if (this.data.size >= this.maxKeys) {
        const firstKey = this.data.keys().next().value;
        if (firstKey) this.data.delete(firstKey);
      }
    }

    this.data.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  async del(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return false;
    }

    return true;
  }

  async incr(key: string, ttlMs?: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const entry = this.data.get(key);

    // Existing valid entry
    if (entry && (entry.expiresAt === null || entry.expiresAt > now)) {
      const count = parseInt(entry.value, 10) + 1;
      entry.value = String(count);
      return {
        count,
        resetAt: entry.expiresAt ?? now + (ttlMs ?? 0),
      };
    }

    // New entry or expired - enforce max keys
    if (!entry && this.data.size >= this.maxKeys) {
      this.cleanup();
      if (this.data.size >= this.maxKeys) {
        const firstKey = this.data.keys().next().value;
        if (firstKey) this.data.delete(firstKey);
      }
    }

    const expiresAt = ttlMs ? now + ttlMs : null;
    this.data.set(key, {
      value: '1',
      expiresAt,
    });

    return {
      count: 1,
      resetAt: expiresAt ?? now,
    };
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.data.get(key);
    if (!entry) return -2; // Key doesn't exist

    if (entry.expiresAt === null) return -1; // No expiration

    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) {
      this.data.delete(key);
      return -2;
    }

    return remaining;
  }

  getStats(): DriverStats {
    const now = Date.now();
    let activeKeys = 0;

    for (const entry of this.data.values()) {
      if (entry.expiresAt === null || entry.expiresAt > now) {
        activeKeys++;
      }
    }

    return {
      type: 'memory',
      connected: true,
      keys: activeKeys,
      totalKeys: this.data.size,
      activeKeys,
      maxKeys: this.maxKeys,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.data) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.data.delete(key);
      }
    }
  }

  flush(): void {
    this.data.clear();
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.data.clear();
  }
}
