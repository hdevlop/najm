import 'reflect-metadata';
import { COOKIES_META } from './tokens';
import type { CookiesDecoratorOptions } from './types';
import { INJECT_PROPS, MetaHelper } from 'najm-core';
import { PARAMS, type ParameterMetadata } from 'najm-core';

// ============================================================================
// @Cookies - Property Decorator (injects CookieService)
// ============================================================================

export function Cookies(options?: CookiesDecoratorOptions): PropertyDecorator {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         INJECT_PROPS,
         {
            propertyKey,
            token: 'Cookies',
            options: options ?? {}
         },
         target.constructor
      );
   };
}

export function getCookiesOptions(target: any, propertyKey?: string | symbol): CookiesDecoratorOptions | undefined {
   const metadata = Reflect.getMetadata(COOKIES_META, target) || {};
   return propertyKey ? metadata[propertyKey] : undefined;
}

// ============================================================================
// @Cookie - Parameter Decorator (extracts cookie value in method params)
// Uses the same PARAMS token as najm-params for unified resolution
// ============================================================================

export function Cookie(name?: string): ParameterDecorator {
   return (target, methodKey, index) => {
      MetaHelper.append<ParameterMetadata>(
         PARAMS,
         { index, type: 'cookie', propertyKey: name },
         target[methodKey as string]
      );
   };
}