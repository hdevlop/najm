// ============================================================================
// decorators/factory.ts - Shared decorator factory
// ============================================================================

import { PARAMS } from '../tokens';
import { CustomParamOptions, ParameterMetadata, ParamResolve, ParamType } from '../types';
import { MetaHelper } from 'diject';

/**
 * Creates one of the built-in parameter decorators for a given type
 */
export function createBuiltInParamDecorator(type: ParamType) {
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

/**
 * Creates a parameter decorator whose value the application computes.
 *
 * `resolve` runs once per invocation, after the route's middlewares and
 * guards and before the handler, for REST routes and MCP tool calls alike. It
 * may be async; a rejection fails that invocation before the handler runs.
 * The value goes to that invocation's argument only and is kept in no shared
 * state, so concurrent requests and tool calls cannot see each other's value.
 *
 * @example
 * ```ts
 * export const Tenant = createParamDecorator(async ({ header, container }) => {
 *    const tenants = await container.resolve(TenantService);
 *    return tenants.require(header('x-tenant'));
 * });
 *
 * @Get('/')
 * list(@Tenant() tenant: TenantRecord, @User() user: AuthUser) {}
 * ```
 */
export function createParamDecorator<T = unknown, O = undefined>(resolve: ParamResolve<T, O>) {
   if (typeof resolve !== 'function') {
      throw new TypeError('createParamDecorator expects a resolve function.');
   }

   return (options?: O): ParameterDecorator => {
      return (target, method, index) => {
         const custom: CustomParamOptions = { resolve, options };
         MetaHelper.append<ParameterMetadata>(
            PARAMS,
            { index, type: 'custom', options: custom },
            target[method as string]
         );
      };
   };
}
