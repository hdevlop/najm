import { MetaHelper } from 'najm-core';
import { RATE_LIMIT_META, RATE_LIMIT_SKIP } from './tokens';
import type { RateLimitOptions } from './types';

/**
 * Apply rate limiting to controller or method
 *
 * @example
 * @RateLimit({ limit: 100, window: '15m' })
 * @Controller('/api')
 * class ApiController { ... }
 *
 * @example
 * @RateLimit({ limit: 10, window: '1m', key: 'user' })
 * @Post('/submit')
 * submit() { ... }
 */
export function RateLimit(options: RateLimitOptions): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    if (propertyKey) {
      MetaHelper.define(RATE_LIMIT_META, options, target[propertyKey]);
    } else {
      MetaHelper.define(RATE_LIMIT_META, options, target);
    }
  };
}

/**
 * Skip rate limiting for this method
 *
 * @example
 * @RateLimit({ limit: 100, window: '15m' })
 * @Controller('/api')
 * class ApiController {
 *   @SkipRateLimit()
 *   @Get('/health')
 *   health() { ... }
 * }
 */
export function SkipRateLimit(): MethodDecorator {
  return (target, propertyKey) => {
    MetaHelper.define(RATE_LIMIT_SKIP, true, target[propertyKey as string]);
  };
}

/**
 * Get rate limit options from metadata
 * @internal
 */
export function getRateLimitOptions(target: any, methodName?: string): RateLimitOptions | null {
  if (methodName) {
    return MetaHelper.get<RateLimitOptions>(RATE_LIMIT_META, target.prototype?.[methodName]) ?? null;
  }
  return MetaHelper.get<RateLimitOptions>(RATE_LIMIT_META, target) ?? null;
}

/**
 * Check if rate limiting is skipped
 * @internal
 */
export function isRateLimitSkipped(target: any, methodName?: string): boolean {
  if (methodName) {
    return MetaHelper.get<boolean>(RATE_LIMIT_SKIP, target.prototype?.[methodName]) ?? false;
  }
  return false;
}