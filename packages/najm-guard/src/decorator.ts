// ============================================================================
// decorator.ts - Guard decorator factory
// ============================================================================

import { MetaHelper, Constructor } from 'najm-core';
import { GUARDS_META } from './tokens';
import type { GuardMetadata, CreateGuardOptions } from './types';

// ============================================================================
// GUARD FACTORY
// ============================================================================

export function createGuard<TParams = void>(
   guardClass: Constructor,
   options?: CreateGuardOptions
): TParams extends void
   ? () => ClassDecorator & MethodDecorator
   : (params: TParams) => ClassDecorator & MethodDecorator {

   const methodName = options?.methodName ?? 'canActivate';

   return ((params?: TParams) => {
      return function (target: any, propertyKey?: string | symbol) {
         const metadata: GuardMetadata = {
            guardClass,
            methodName,
            params
         };

         if (propertyKey) {
            MetaHelper.appendMany(GUARDS_META, [metadata], target, propertyKey);
         } else {
            MetaHelper.appendMany(GUARDS_META, [metadata], target);
         }
      };
   }) as any;
}

// ============================================================================
// GUARD COMPOSITION
// ============================================================================

/**
 * Compose multiple guard decorators to run sequentially.
 * All guards must pass for access to be granted.
 *
 * @example
 * export const isAdmin = composeGuards(isAuth(), Role(ROLES.ADMIN));
 *
 * @usage
 * @isAdmin()  // Note: called as a function
 * method() { ... }
 */
export function composeGuards(
   ...decorators: (ClassDecorator & MethodDecorator)[]
): () => ClassDecorator & MethodDecorator {

   return () => {
      return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
         for (const decoratorFn of decorators) {
            if (propertyKey !== undefined) {
               (decoratorFn as MethodDecorator)(target, propertyKey, descriptor!);
            } else {
               (decoratorFn as ClassDecorator)(target);
            }
         }
      };
   };
}

// ============================================================================
// METADATA GETTERS
// ============================================================================

export function getGuardMetadata(target: any, methodName?: string): GuardMetadata[] {
   if (methodName) {
      return MetaHelper.get<GuardMetadata[]>(GUARDS_META, target.prototype, methodName) || [];
   }
   return MetaHelper.get<GuardMetadata[]>(GUARDS_META, target) || [];
}

export function hasGuards(target: any, methodName?: string): boolean {
   return getGuardMetadata(target, methodName).length > 0;
}