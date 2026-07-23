import type { Context, MiddlewareHandler, Next } from 'hono';
import { Service, Meta, DI, Inject, Container, Constructor } from 'najm-core';
import { LoggerService, ScannerService, Scan, ScanType, INJECTION_TYPES, Err } from 'najm-core';
import { CacheService } from 'najm-cache';
import { USER } from 'najm-guard';
import { RATE_LIMIT_CONFIG } from './tokens';
import { getRateLimitOptions, isRateLimitSkipped } from './decorator';
import type {
  RateLimitPluginConfig,
  RateLimitOptions,
  RateLimitEntry,
  TimeWindow,
  KeyStrategy,
} from './types';
import { CONTEXT, HRequest, getRequestData } from 'najm-core';

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_WINDOW = '15m';
const DEFAULT_KEY_PREFIX = 'rl:';

/**
 * Bucket scoping for a rate-limit registration:
 * - 'route'       — per matched route (method-level decorators)
 * - 'global'      — one bucket for the whole app (plugin default limit)
 * - `ctrl:<Name>` — shared across a controller's routes (class-level decorators)
 */
type KeyScope = 'route' | 'global' | `ctrl:${string}`;

const TIME_MULTIPLIERS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

@Service()
@Meta({ layer: 'plugin', order: 15 })
export class RateLimitService {
  @DI() private container!: Container;
  @Scan() private scanner!: ScannerService;
  @Inject(RATE_LIMIT_CONFIG) private config!: RateLimitPluginConfig;
  @Inject(LoggerService) private log!: LoggerService;
  @Inject(CacheService) private cache!: CacheService;

  private keyPrefix!: string;
  private routeCount = 0;
  private globalEnabled = false;
  private windowCache = new Map<string, number>();
  private keyIndex = new Map<string, Set<string>>();

  // ============================================================
  // LIFECYCLE: SCAN
  // ============================================================
  async scan(): Promise<void> {
    this.keyPrefix = this.config.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.routeCount = 0;

    this.scanner.scan(ScanType.CONTROLLER, {
      onClass: (controller) => {
        const options = getRateLimitOptions(controller);
        if (options && !options.skip) {
          this.registerMiddleware(controller, undefined, options);
        }
      },
      onMethod: (controller, methodName) => {
        // Check if method has skip decorator
        if (isRateLimitSkipped(controller, methodName)) return;

        const options = getRateLimitOptions(controller, methodName);
        if (options && !options.skip) {
          this.registerMiddleware(controller, methodName, options);
          this.routeCount++;
        }
      },
    });

    this.log.debug?.(`Scanned ${this.routeCount} rate-limited route(s)`);
  }

  private registerMiddleware(
    controller: Constructor,
    methodName: string | undefined,
    options: RateLimitOptions
  ): void {
    const windowMs = this.parseWindow(options.window);

    // Method-level limits get a per-route bucket; controller-level limits
    // share one bucket across all of the controller's routes (a controller
    // budget), keyed by controller name so distinct controllers never share.
    const scope: KeyScope = methodName !== undefined ? 'route' : `ctrl:${controller.name}`;

    this.container.setInjection({
      type: INJECTION_TYPES.MIDDLEWARE,
      target: controller,
      methodName,
      handler: this.createMiddleware(options, windowMs, scope),
      order: 15,
      source: 'rate-limit',
    });
  }

  // ============================================================
  // LIFECYCLE: CONFIGURE
  // ============================================================
  async configure(): Promise<void> {
    if (this.config.defaultLimit) {
      this.globalEnabled = true;
      const windowMs = this.parseWindow(this.config.defaultWindow ?? DEFAULT_WINDOW);

      this.container.setInjection({
        type: INJECTION_TYPES.MIDDLEWARE,
        scope: 'global',
        name: 'rate-limit-global',
        handler: this.createMiddleware(
          {
            limit: this.config.defaultLimit,
            window: this.config.defaultWindow ?? DEFAULT_WINDOW,
            key: this.config.keyGenerator ?? 'ip',
          },
          windowMs,
          'global',
        ),
        order: 15,
      });
    }

    const storeType = this.cache.type;
    this.log.debug?.(`Rate limit plugin configured (${storeType} store)`);
  }

  // ============================================================
  // LIFECYCLE: ACTIVATE & READY
  // ============================================================
  async activate(): Promise<void> {}

  async onReady(): Promise<void> {
    const storeType = this.cache.type;
    if (this.globalEnabled) {
      this.log.debug(
        `Global rate limit: ${this.config.defaultLimit}/${this.config.defaultWindow ?? DEFAULT_WINDOW} (${storeType})`
      );
    }
    if (this.routeCount > 0) {
      this.log.debug(`Route rate limits: ${this.routeCount} route(s)`);
    }
  }

  // ============================================================
  // LIFECYCLE: DESTROY
  // ============================================================
  async onDestroy(): Promise<void> {
    this.windowCache.clear();
    this.keyIndex.clear();
  }

  // ============================================================
  // MIDDLEWARE FACTORY
  // ============================================================
  private createMiddleware(options: RateLimitOptions, windowMs: number, scope: KeyScope): MiddlewareHandler {
    const { limit, key = 'ip', message = 'Too many requests', statusCode = 429, headers = true } = options;

    return async (_: Context, next: Next) => {
      const context = this.getContext();

      if (this.config.skip?.(context)) {
        return next();
      }

      const request = this.getRequest();
      const baseKey = await this.generateKey(request, context, key);
      const rateLimitKey = this.buildRateLimitKey(request, baseKey, scope);
      this.rememberKey(baseKey, rateLimitKey);
      const { count, resetAt } = await this.cache.incr(rateLimitKey, windowMs);
      const remaining = Math.max(0, limit - count);

      if (headers) {
        context.header('X-RateLimit-Limit', String(limit));
        context.header('X-RateLimit-Remaining', String(remaining));
        context.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      }

      if (count > limit) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        context.header('Retry-After', String(Math.max(1, retryAfter)));
        Err(statusCode, message);
      }

      return next();
    };
  }

  // ============================================================
  // ALS DATA ACCESS
  // ============================================================
  private getRequest(): HRequest {
    // Request data is built lazily per Context since the Tier 1 hot-path work
    // (the ALS store only carries { requestId, context } now).
    return getRequestData(this.getContext());
  }

  private getContext(): Context {
    const context = this.container.get<Context>(CONTEXT);
    if (!context) Err('CONTEXT not found in ALS');
    return context;
  }

  private getUser(): { id?: string } | undefined {
    try {
      return this.container.get(USER);
    } catch {
      return undefined;
    }
  }

  // ============================================================
  // KEY GENERATION
  // ============================================================
  private async generateKey(request: HRequest, context: Context, strategy: KeyStrategy): Promise<string> {
    if (typeof strategy === 'function') {
      return strategy(context);
    }

    switch (strategy) {
      case 'ip':
        return this.extractClientIP(request);
      case 'user':
        return this.getUser()?.id ?? 'anonymous';
      case 'api-key':
        return request.headers['x-api-key'] ?? 'no-key';
      case 'user+ip': {
        const user = this.getUser();
        const ip = this.extractClientIP(request);
        return user?.id ? `${user.id}:${ip}` : ip;
      }
      default:
        return 'global';
    }
  }

  private extractClientIP(request: HRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';

    const realIp = request.headers['x-real-ip'];
    if (realIp) return realIp;

    return request.ip ?? 'unknown';
  }

  private buildRateLimitKey(request: HRequest, baseKey: string, scope: KeyScope): string {
    const resolved = scope === 'route' ? this.getRouteScope(request) : scope;
    return `${this.keyPrefix}${resolved}:${baseKey}`;
  }

  private rememberKey(baseKey: string, fullKey: string): void {
    let keys = this.keyIndex.get(baseKey);
    if (!keys) {
      keys = new Set<string>();
      this.keyIndex.set(baseKey, keys);
    }
    keys.add(fullKey);
  }

  private getCandidateKeys(key: string): string[] {
    const candidates = new Set<string>();

    if (key.startsWith(this.keyPrefix)) {
      candidates.add(key);
    } else {
      candidates.add(this.keyPrefix + key);
    }

    const indexed = this.keyIndex.get(key);
    if (indexed) {
      for (const fullKey of indexed) {
        candidates.add(fullKey);
      }
    }

    return [...candidates];
  }

  private forgetKey(key: string, fullKey: string): void {
    if (this.keyIndex.has(key)) {
      this.keyIndex.delete(key);
      return;
    }

    for (const [baseKey, keys] of this.keyIndex) {
      keys.delete(fullKey);
      if (keys.size === 0) {
        this.keyIndex.delete(baseKey);
      }
    }
  }

  private getRouteScope(request: HRequest): string {
    const method = request.method?.toUpperCase() || 'ALL';
    const route = request.routePath || request.path || 'unknown';
    return `${method}:${route}`;
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  private parseWindow(window: TimeWindow): number {
    if (typeof window === 'number') return window;

    const cached = this.windowCache.get(window);
    if (cached !== undefined) return cached;

    const match = window.match(/^(\d+)(s|m|h|d)$/);
    if (!match) Err(`Invalid time window: ${window}`);

    const [, value, unit] = match;
    const ms = parseInt(value, 10) * TIME_MULTIPLIERS[unit];
    this.windowCache.set(window, ms);

    return ms;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Check current rate limit status for a key
   */
  async check(key: string): Promise<RateLimitEntry | undefined> {
    for (const fullKey of this.getCandidateKeys(key)) {
      const value = await this.cache.get(fullKey);
      if (!value) continue;

      const ttl = await this.cache.ttl(fullKey);
      return {
        count: parseInt(value, 10),
        resetAt: ttl > 0 ? Date.now() + ttl : Date.now(),
      };
    }

    return undefined;
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<boolean> {
    let deleted = false;

    for (const fullKey of this.getCandidateKeys(key)) {
      deleted = (await this.cache.del(fullKey)) || deleted;
      this.forgetKey(key, fullKey);
    }

    return deleted;
  }

  /**
   * Get rate limit statistics
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    return {
      type: this.cache.type,
      keyPrefix: this.keyPrefix,
      globalEnabled: this.globalEnabled,
      routeCount: this.routeCount,
      ...cacheStats, // Include cache driver stats (keys, maxKeys, etc.)
    };
  }
}
