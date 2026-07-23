import type { Container, HRequest } from 'najm-core';
import { ParamResolver, getParameterMetadata, type ParameterMetadata } from 'najm-core';
import type { GuardMetadata, GuardReturnType, GuardResult } from './types';
import { USER, OWNER, INFO, DATA, FILTER, ROLE, PERMISSIONS } from './tokens';
import type { Context } from 'hono';

type GuardExecutionContext = {
   context?: Context;
   request?: HRequest;
   parser?: { parseBody(): Promise<any>; parseFiles(): Promise<Record<string, any>> };
};

export async function runGuards(
   guards: GuardMetadata[],
   container: Container,
   resolver: ParamResolver,
   executionContext?: GuardExecutionContext,
): Promise<boolean> {
   for (const guard of guards) {
      const result = await executeGuard(guard, container, resolver, executionContext);
      const allowed = applyGuardResult(container, result);
      if (!allowed) return false;
   }
   return true;
}

async function executeGuard(
   guard: GuardMetadata,
   container: Container,
   resolver: ParamResolver,
   executionContext?: GuardExecutionContext,
): Promise<GuardReturnType> {
   const { guardClass, methodName = 'canActivate', params } = guard;

   const instance = await container.resolve(guardClass);
   const method = instance[methodName];
   if (typeof method !== 'function') return false;

   const args = await resolveGuardArgs(method, resolver, container, params, executionContext);
   return method.call(instance, ...args);
}

async function resolveGuardArgs(
   method: Function,
   resolver: ParamResolver,
   container: Container,
   guardParams: any,
   executionContext?: GuardExecutionContext,
): Promise<any[]> {
   const metadata = (getParameterMetadata(method) ?? []) as ParameterMetadata[];
   const paramCount = method.length;

   if (paramCount === 0) return [];

   if (metadata.length === 0) {
      return resolver.resolveArgs(method);
   }

   const args = new Array(paramCount).fill(undefined);

   await Promise.all(
      metadata.map(async (meta) => {
         args[meta.index] = await resolveGuardParameter(meta, resolver, container, guardParams, executionContext);
      })
   );

   return args;
}

async function resolveGuardParameter(
   meta: ParameterMetadata,
   resolver: ParamResolver,
   container: Container,
   guardParams: any,
   executionContext?: GuardExecutionContext,
): Promise<any> {
   const { type, propertyKey } = meta;
   const context = executionContext?.context;
   const request = executionContext?.request;
   const parser = executionContext?.parser;

   switch (type) {
      case 'guardParams':
         return propertyKey ? guardParams?.[propertyKey] : guardParams;

      case 'context':
         return context;

      case 'req':
         return request;

      case 'headers': {
         const headers = request?.headers;
         return propertyKey ? headers?.[propertyKey.toLowerCase()] : headers;
      }

      case 'ip':
         return request?.ip;

      case 'params': {
         const params = request?.params ?? context?.req.param();
         return propertyKey ? params?.[propertyKey] : params;
      }

      case 'body': {
         if (parser) {
            const body = await parser.parseBody();
            return propertyKey ? body?.[propertyKey] : body;
         }
         break;
      }

      case 'user':
         return getAlsValue(container, USER, propertyKey);
      case 'owner':
         return getAlsValue(container, OWNER, propertyKey);
      case 'info':
         return getAlsValue(container, INFO, propertyKey);
      case 'data':
         return getAlsValue(container, DATA, propertyKey);
      case 'filter':
         return getAlsValue(container, FILTER, propertyKey);
      case 'role':
         return getAlsValue(container, ROLE, propertyKey);
      case 'permissions':
         return getAlsValue(container, PERMISSIONS, propertyKey);
   }

   return resolver.extractParameterValue(meta);
}

function getAlsValue(container: Container, token: any, propertyKey?: string): any {
   const value = container.get(token);
   return propertyKey && value && typeof value === 'object' ? value[propertyKey] : value;
}

export function applyGuardResult(
   container: { set(token: any, value: any): void },
   result: GuardReturnType,
): boolean {
   if (typeof result === 'boolean') return result;

   if (result == null) return false;

   if (typeof result === 'object') {
      const { user, owner, info, data, filter, role, permissions } = result as GuardResult;

      if (user !== undefined) container.set(USER, user);
      if (owner !== undefined) container.set(OWNER, owner);
      if (info !== undefined) container.set(INFO, info);
      if (data !== undefined) container.set(DATA, data);
      if (filter !== undefined) container.set(FILTER, filter);
      if (role !== undefined) container.set(ROLE, role);
      if (permissions !== undefined) container.set(PERMISSIONS, permissions);

      return true;
   }

   return false;
}
