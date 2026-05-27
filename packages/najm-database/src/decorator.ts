// ============================================================================
// database/decorator.ts - Database Decorators
// ============================================================================

import { Constructor, DIError, INJECT_PROPS, MetaHelper } from 'najm-core';
import type { TransactionalOptions } from './types';


// ============================================================================
// @DB() DECORATOR - Inject database connection
// ============================================================================

export function DB(name: string = 'default'): any {
   return (target: any, propertyKey: string | symbol) => {
      MetaHelper.append(
         INJECT_PROPS,
         { propertyKey, token: 'Database', databaseName: name },
         target.constructor
      );
   };
}

// ============================================================================
// @Transaction() DECORATOR - Wrap method in database transaction
// ============================================================================

export const TRANSACTIONAL_METHODS = Symbol.for('najm:meta:transactional_methods');

export interface TransactionalMethodMeta {
   propertyKey: string | symbol;
   options: TransactionalOptions;
}

export function Transaction(options: TransactionalOptions = {}): MethodDecorator {
   return function (target: any, propertyKey: string | symbol) {
      MetaHelper.append(TRANSACTIONAL_METHODS, { propertyKey, options }, target.constructor);
   };
}

export function getTransactionalMethods(target: any): TransactionalMethodMeta[] {
   return MetaHelper.get(TRANSACTIONAL_METHODS, target) ?? [];
}
