// ============================================================================
// Middleware Decorators
// ============================================================================

import { MetaHelper, SERVICE, container, Scope } from 'diject';
import { MIDDLEWARE_LAYER, MIDDLEWARE_META, MIDDLEWARE_USE_META } from './tokens';
import type { MiddlewareDecoratorOptions, UseDecoratorOptions } from './types';

export function Middleware(options: MiddlewareDecoratorOptions = {}): ClassDecorator {
   return (target: any) => {
      const normalizedOptions = {
         order: 50,
         path: '*',
         name: target.name,
         ...options,
      };

      // Store middleware metadata (Reflect)
      MetaHelper.define(MIDDLEWARE_META, {
         type: 'class',
         options: normalizedOptions,
      }, target);

      // Also mark as injectable service
      MetaHelper.define(SERVICE, true, target);
      MetaHelper.define(MIDDLEWARE_LAYER, 'middleware', target);

      // Register in container with proper metadata (like @Controller and @Service do)
      container.set(target, {
         scope: Scope.SINGLETON,
         metadata: { 
            type: 'middleware',
            ...normalizedOptions
         }
      });

      return target;
   };
}

// ============================================================================
// @Use() - Property Decorator
// ============================================================================

/**
 * Property decorator for declaring functional middleware
 *
 * @example
 * ```typescript
 * @Service()
 * class AppConfig {
 *   @Use({ order: 10 })
 *   cors = cors({ origin: '*' });
 *
 *   @Use({ order: 20, path: '/api/*' })
 *   rateLimit = rateLimiter({ max: 100 });
 * }
 * ```
 */
export function Use(options: UseDecoratorOptions = {}): PropertyDecorator {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         MIDDLEWARE_USE_META,  // ✅ Fixed - use separate metadata key
         {
            propertyKey,
            options: {
               order: 50,
               path: '*',
               ...options,
            },
         },
         target.constructor
      );
   };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface MiddlewareMeta {
   type: string;
   options: MiddlewareDecoratorOptions;
}

interface UseMetadata {
   propertyKey: string | symbol;
   options: UseDecoratorOptions;
}

/**
 * Check if a class is decorated with @Middleware()
 */
export function isMiddlewareClass(target: any): boolean {
   const meta = MetaHelper.get<MiddlewareMeta>(MIDDLEWARE_META, target);
   return meta?.type === 'class';
}

/**
 * Get @Middleware() decorator options from a class
 */
export function getMiddlewareOptions(target: any): MiddlewareDecoratorOptions | null {
   const meta = MetaHelper.get<MiddlewareMeta>(MIDDLEWARE_META, target);
   return meta?.options ?? null;
}

/**
 * Get @Use() decorated properties from a class
 */
export function getUseInjections(target: any): Array<{
   propertyKey: string | symbol;
   options: UseDecoratorOptions;
}> {
   return MetaHelper.get<UseMetadata[]>(MIDDLEWARE_USE_META, target) ?? [];
}