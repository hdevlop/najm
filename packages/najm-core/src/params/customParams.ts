// ============================================================================
// customParams.ts - Resolution of createParamDecorator() parameters
// ============================================================================

import type { CustomParamOptions, ParameterMetadata, ParamResolveContext } from './types';

/**
 * Resolves a parameter declared with `createParamDecorator` for one
 * invocation. Transports call this after their guards, once per invocation;
 * applications do not need to.
 */
export async function resolveCustomParam(
   meta: ParameterMetadata,
   context: ParamResolveContext,
): Promise<unknown> {
   const custom = meta.options as CustomParamOptions | undefined;
   if (meta.type !== 'custom' || typeof custom?.resolve !== 'function') {
      return undefined;
   }

   return custom.resolve(context, custom.options);
}
