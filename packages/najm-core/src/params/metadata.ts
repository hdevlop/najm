import { MetaHelper } from 'diject';
import { PARAMS } from './tokens';
import type { ParameterMetadata } from './types';

export const getParameterMetadata = (target: any): ParameterMetadata[] =>
   MetaHelper.get<ParameterMetadata[]>(PARAMS, target) ?? [];

/**
 * Number of arguments a handler takes. `handler.length` stops at the first
 * defaulted or rest parameter, so a decorated `q = 'x'` would be dropped;
 * decorator indices are the authoritative positions.
 */
export const getParameterCount = (handler: Function, metadata: ParameterMetadata[]): number => {
   let count = handler.length;
   for (const meta of metadata) {
      if (meta.index >= count) count = meta.index + 1;
   }
   return count;
};
