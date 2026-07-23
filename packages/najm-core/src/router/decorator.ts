// ============================================================================
// decorators/index.ts - Router decorators (Controller, Get, Post, etc.)
// ============================================================================

import { ROUTES_META } from './tokens';
import { HttpMethod, RouteDefinition } from './types';
import { MetaHelper } from 'diject';


function Route(method: HttpMethod) {
   return (path: string = '/'): MethodDecorator => {
      return (target, methodName, descriptor) => {
         MetaHelper.append(
            ROUTES_META,
            { path, method, methodName, handler: descriptor!.value },
            target.constructor
         );
      };
   };
}


export const Get = Route('get');
export const Post = Route('post');
export const Put = Route('put');
export const Patch = Route('patch');
export const Delete = Route('delete');


export function getRoutes(target: any): RouteDefinition[] {
   return MetaHelper.get<RouteDefinition[]>(ROUTES_META, target) ?? [];
}

// Re-export response decorators for convenience
export { ResMsg, ResCreated, ResNoContent, RawResponse, RawController } from './response';
