// ============================================================================
// ParamResolver.ts - Standalone parameter resolution logic
// ============================================================================

import { Container, createAlsToken } from 'diject';
import { ParameterMetadata, HRequest } from './types';
import { REQUEST, CONTEXT, PARSER } from './tokens';
import { Context } from 'hono';
import { Err } from '../errors';

const USER = createAlsToken<any>('user');
const ROLE = createAlsToken<string>('role');
const PERMISSIONS = createAlsToken<string[]>('permissions');
const OWNER = createAlsToken<any>('owner');
const INFO = createAlsToken<any>('info');
const DATA = createAlsToken<any>('data');
const FILTER = createAlsToken<any>('filter');
const GUARD_PARAMS = createAlsToken<any>('guardParams');
const VALIDATED_BODY = createAlsToken<any>('validated:body');
const VALIDATED_PARAMS = createAlsToken<any>('validated:params');
const VALIDATED_QUERY = createAlsToken<any>('validated:query');
const VALIDATED_HEADERS = createAlsToken<any>('validated:headers');


export class ParamResolver {
   private readonly parameterNamesCache = new WeakMap<Function, string[]>();
   private readonly parameterMetadataCache = new WeakMap<Function, ParameterMetadata[]>();

   constructor(private container: Container) { }

   async resolveArgs(handler: Function): Promise<any[]> {
      const paramMetadata = this.getCachedParameterMetadata(handler);
      const paramCount = handler.length;

      if (paramCount === 0) return [];

      const requestData = this.getRequestData();
      const context = this.getContext();

      if (paramMetadata.length === paramCount) {
         return Promise.all(
            paramMetadata
               .sort((a, b) => a.index - b.index)
               .map(meta => this.extractParameterValue(meta))
         );
      }

      const args: any[] = new Array(paramCount).fill(undefined);
      const decoratedIndices = new Set<number>();

      await Promise.all(
         paramMetadata.map(async (meta) => {
            args[meta.index] = await this.extractParameterValue(meta);
            decoratedIndices.add(meta.index);
         })
      );

      if (decoratedIndices.size < paramCount) {
         const paramNames = this.getParameterNames(handler);

         for (let i = 0; i < paramCount; i++) {
            if (decoratedIndices.has(i)) continue;
            args[i] = this.resolveLegacyParameter(paramNames[i], i, requestData, context);
         }
      }

      return args;
   }

   private resolveLegacyParameter(
      name: string,
      index: number,
      req: HRequest,
      ctx: Context
   ): any {
      if (!name) return undefined;
      const lowerName = name.toLowerCase();

      // Common legacy parameter names
      if (lowerName === 'req' || lowerName === 'request') return req;
      if (lowerName === 'ctx' || lowerName === 'context') return ctx;
      if (lowerName === 'body') return req.body;
      if (lowerName === 'params') return req.params;
      if (lowerName === 'query') return req.query;
      if (lowerName === 'headers') return req.headers;

      return undefined;
   }

   async extractParameterValue(meta: ParameterMetadata): Promise<any> {
      const { type, propertyKey } = meta;

      const getRequestData = () => this.getRequestData();
      const getContext = () => this.getContext();

      switch (type) {
         case 'body': {
            // Try validated data from ALS first
            const validated = this.container.get(VALIDATED_BODY);
            if (validated !== undefined) {
               return propertyKey ? validated?.[propertyKey] : validated;
            }
            // Fallback to parsing raw body
            const parser = this.container.get(PARSER);
            const body = await parser.parseBody();
            return propertyKey ? body?.[propertyKey] : body;
         }

         case 'file': {
            const parser = this.container.get(PARSER);
            const files = await parser.parseFiles();
            return propertyKey ? files?.[propertyKey] : files;
         }

         case 'params': {
            // Try validated data from ALS first
            const validated = this.container.get(VALIDATED_PARAMS);
            if (validated !== undefined) {
               return propertyKey ? validated?.[propertyKey] : validated;
            }
            // Fallback to raw params
            const context = this.getContext();
            const params = context.req.param();
            return propertyKey ? params?.[propertyKey] : params;
         }
         case 'query': {
            // Try validated data from ALS first
            const validated = this.container.get(VALIDATED_QUERY);
            if (validated !== undefined) {
               return propertyKey ? validated?.[propertyKey] : validated;
            }
            // Fallback to raw query
            const requestData = getRequestData();
            return propertyKey ? requestData.query?.[propertyKey] : requestData.query;
         }
         case 'headers': {
            // Try validated data from ALS first
            const validated = this.container.get(VALIDATED_HEADERS);
            if (validated !== undefined) {
               return propertyKey ? validated?.[propertyKey] : validated;
            }
            // Fallback to raw headers
            const requestData = getRequestData();
            return propertyKey ? requestData.headers?.[propertyKey] : requestData.headers;
         }
         case 'contentType': {
            const requestData = getRequestData();
            return requestData.headers?.['content-type'];
         }
         case 'contentLength': {
            const requestData = getRequestData();
            const len = requestData.headers?.['content-length'];
            return len ? parseInt(len, 10) : undefined;
         }
         case 'origin': {
            const requestData = getRequestData();
            return requestData.headers?.['origin'];
         }
         case 'referer': {
            const requestData = getRequestData();
            return requestData.headers?.['referer'];
         }
         case 'language': {
            const requestData = getRequestData();
            return requestData.headers?.['accept-language'];
         }
         case 'encoding': {
            const requestData = getRequestData();
            return requestData.headers?.['accept-encoding'];
         }
         case 'connection': {
            const requestData = getRequestData();
            return requestData.headers?.['connection'];
         }
         case 'upgrade': {
            const requestData = getRequestData();
            return requestData.headers?.['upgrade'];
         }
         case 'protocol': {
            const requestData = getRequestData();
            return requestData.headers?.['x-forwarded-proto'] || 'http';
         }
         case 'cookie': {
            const requestData = getRequestData();
            return propertyKey ? requestData.cookies?.[propertyKey] : requestData.cookies;
         }
         case 'ip': {
            const requestData = getRequestData();
            return requestData.ip;
         }

         case 'path': {
            const requestData = getRequestData();
            return requestData.path;
         }
         case 'url': {
            const requestData = getRequestData();
            return requestData.url;
         }
         case 'method': {
            const requestData = getRequestData();
            return requestData.method;
         }
         case 'routePath': {
            const context = this.getContext();
            return context.req.routePath;
         }
         case 'matchedRoutes': {
            const requestData = getRequestData();
            return requestData.matchedRoutes;
         }
         case 'routeIndex': {
            const requestData = getRequestData();
            return requestData.routeIndex;
         }
         case 'raw': {
            const requestData = getRequestData();
            return requestData.raw;
         }

         case 'json': {
            const requestData = getRequestData();
            return requestData.json();
         }
         case 'text': {
            const requestData = getRequestData();
            return requestData.text();
         }
         case 'arrayBuffer': {
            const requestData = getRequestData();
            return requestData.arrayBuffer();
         }
         case 'blob': {
            const requestData = getRequestData();
            return requestData.blob();
         }
         case 'formData': {
            const requestData = getRequestData();
            return requestData.formData();
         }
         case 'queries': {
            const requestData = getRequestData();
            return propertyKey ? requestData.queries(propertyKey) : requestData.queries;
         }
         case 'valid': {
            const requestData = getRequestData();
            return requestData.valid;
         }

         case 'user':
            return this.getFromAlsToken('user', propertyKey);
         case 'info':
            return this.getFromAlsToken('info', propertyKey);
         case 'owner':
            return this.getFromAlsToken('owner', propertyKey);
         case 'data':
            return this.getFromAlsToken('data', propertyKey);
         case 'filter':
            return this.getFromAlsToken('filter', propertyKey);
         case 'role':
            return this.getFromAlsToken('role', propertyKey);
         case 'permissions':
            return this.getFromAlsToken('permissions', propertyKey);
         case 'guardParams': {
            return this.getFromAlsToken('guardParams', propertyKey);
         }

         case 'req':
            return getRequestData();
         case 'context':
            return getContext();

         default:
            return undefined;
      }
   }

   // ============================================================================
   // UTILITIES
   // ============================================================================

   private getParameterNames(func: Function): string[] {
      let names = this.parameterNamesCache.get(func);

      if (!names) {
         const funcStr = func.toString();
         const start = funcStr.indexOf('(') + 1;
         const end = funcStr.indexOf(')');

         names = funcStr
            .slice(start, end)
            .split(',')
            .map(param => param.trim().split(/[=:]/)[0].trim())
            .filter(Boolean);

         this.parameterNamesCache.set(func, names);
      }

      return names;
   }

   private getCachedParameterMetadata(handler: Function): ParameterMetadata[] {
      let metadata = this.parameterMetadataCache.get(handler);

      if (!metadata) {
         const { getParameterMetadata } = require('./decorators');
         metadata = getParameterMetadata(handler) ?? [];
         this.parameterMetadataCache.set(handler, metadata);
      }

      return metadata;
   }

   private getRequestData(): HRequest {
      const requestData = this.container.get(REQUEST);
      if (!requestData) {
         Err('REQUEST not found. Ensure middleware is configured.');
      }
      return requestData;
   }

   private getContext(): Context {
      const context = this.container.get(CONTEXT);
      if (!context) {
         Err('CONTEXT not found. Ensure middleware is configured.');
      }
      return context;
   }

private getFromAlsToken<T>(tokenName: string, propertyKey?: string): any {
   const tokenMap = {
      'user': USER,
      'guardParams': GUARD_PARAMS,
      'owner': OWNER,
      'info': INFO,
      'data': DATA,
      'filter': FILTER,
      'role': ROLE,
      'permissions': PERMISSIONS,
   };

   const token = tokenMap[tokenName];
   if (!token) return undefined;

   const value = this.container.get(token);
   return propertyKey && value && typeof value === 'object' ? value[propertyKey] : value;
}
}
