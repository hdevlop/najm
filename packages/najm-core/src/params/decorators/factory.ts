// ============================================================================
// decorators/factory.ts - Shared decorator factory
// ============================================================================

import { PARAMS } from '../tokens';
import { ParameterMetadata, ParamType } from '../types';
import { MetaHelper } from 'diject';

/**
 * Creates a parameter decorator for a given type
 */
export function createParamDecorator(type: ParamType) {
   return (propertyKey?: string): ParameterDecorator => {
      return (target, method, index) => {
         MetaHelper.append<ParameterMetadata>(
            PARAMS,
            { index, type, propertyKey },
            target[method as string]
         );
      };
   };
}