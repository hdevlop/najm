// ============================================================================
// ParamResolver.ts - Standalone parameter resolution logic
// ============================================================================

import { Container, createAlsToken } from 'diject';
import { ParameterMetadata, HRequest } from './types';
import { CONTEXT } from './tokens';
import { Context } from 'hono';
import { Err } from '../errors';
import { getParameterMetadata } from './metadata';
import { getRequestData, getRequestParser } from './requestContext';

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

type Extractor = (ctx: Context) => unknown;
type AsyncExtractor = (ctx: Context) => Promise<unknown>;

interface CompiledExtractor {
   index: number;
   extract: Extractor | AsyncExtractor;
   async: boolean;
}

interface CompiledPlan {
   extractors: CompiledExtractor[];
   allSync: boolean;
}

export class ParamResolver {
   private readonly parameterNamesCache = new WeakMap<Function, string[]>();
   private readonly parameterMetadataCache = new WeakMap<Function, ParameterMetadata[]>();
   private readonly compiledPlanCache = new WeakMap<Function, CompiledPlan>();

   constructor(private container: Container) { }

   async resolveArgs(handler: Function): Promise<any[]> {
      const paramMetadata = this.getCachedParameterMetadata(handler);
      const paramCount = handler.length;

      if (paramCount === 0) return [];

      if (paramMetadata.length === paramCount) {
         return this.resolveCompiledArgs(handler);
      }

      const requestData = this.getRequestData();
      const context = this.getContext();
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

   public compile(handler: Function): CompiledPlan {
      let plan = this.compiledPlanCache.get(handler);

      if (!plan) {
         const extractors = this.getCachedParameterMetadata(handler)
            .map((meta) => this.createCompiledExtractor(meta));

         plan = {
            extractors,
            allSync: extractors.every((extractor) => !extractor.async),
         };
         this.compiledPlanCache.set(handler, plan);
      }

      return plan;
   }

   public resolveArgsSync(handler: Function): any[] {
      const plan = this.compile(handler);
      if (!plan.allSync) {
         Err('Cannot resolve async parameters synchronously.');
      }

      const context = this.getContext();
      const args = new Array(plan.extractors.length);

      for (let i = 0; i < plan.extractors.length; i++) {
         args[i] = (plan.extractors[i].extract as Extractor)(context);
      }

      return args;
   }

   private async resolveCompiledArgs(handler: Function): Promise<any[]> {
      const plan = this.compile(handler);
      const context = this.getContext();
      const args = new Array(plan.extractors.length);

      if (plan.allSync) {
         for (let i = 0; i < plan.extractors.length; i++) {
            args[i] = (plan.extractors[i].extract as Extractor)(context);
         }
         return args;
      }

      for (let i = 0; i < plan.extractors.length; i++) {
         const extractor = plan.extractors[i];
         const value = extractor.extract(context);
         args[i] = extractor.async ? await value : value;
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
            const parser = this.getParser();
            const body = await parser.parseBody();
            return propertyKey ? body?.[propertyKey] : body;
         }

         case 'file': {
            const parser = this.getParser();
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

   private createCompiledExtractor(meta: ParameterMetadata): CompiledExtractor {
      const { index, type, propertyKey } = meta;
      let async = false;
      let extract: Extractor | AsyncExtractor;

      switch (type) {
         case 'body':
            async = true;
            extract = async () => {
               const validated = this.container.get(VALIDATED_BODY);
               if (validated !== undefined) {
                  return propertyKey ? validated?.[propertyKey] : validated;
               }

               const parser = this.getParser();
               const body = await parser.parseBody();
               return propertyKey ? body?.[propertyKey] : body;
            };
            break;

         case 'file':
            async = true;
            extract = async () => {
               const parser = this.getParser();
               const files = await parser.parseFiles();
               return propertyKey ? files?.[propertyKey] : files;
            };
            break;

         case 'params':
            extract = (context) => {
               const validated = this.container.get(VALIDATED_PARAMS);
               if (validated !== undefined) {
                  return propertyKey ? validated?.[propertyKey] : validated;
               }

               if (propertyKey) {
                  return context.req.param(propertyKey);
               }

               return context.req.param();
            };
            break;

         case 'query':
            extract = (context) => {
               const validated = this.container.get(VALIDATED_QUERY);
               if (validated !== undefined) {
                  return propertyKey ? validated?.[propertyKey] : validated;
               }

               if (propertyKey) {
                  return context.req.query(propertyKey);
               }

               return context.req.query();
            };
            break;

         case 'headers':
            extract = (context) => {
               const validated = this.container.get(VALIDATED_HEADERS);
               if (validated !== undefined) {
                  return propertyKey ? validated?.[propertyKey] : validated;
               }

               return propertyKey
                  ? this.extractHeaders(context)?.[propertyKey]
                  : this.extractHeaders(context);
            };
            break;

         case 'contentType':
            extract = (context) => context.req.header('content-type');
            break;
         case 'contentLength':
            extract = (context) => {
               const len = context.req.header('content-length');
               return len ? parseInt(len, 10) : undefined;
            };
            break;
         case 'origin':
            extract = (context) => context.req.header('origin');
            break;
         case 'referer':
            extract = (context) => context.req.header('referer');
            break;
         case 'language':
            extract = (context) => context.req.header('accept-language');
            break;
         case 'encoding':
            extract = (context) => context.req.header('accept-encoding');
            break;
         case 'connection':
            extract = (context) => context.req.header('connection');
            break;
         case 'upgrade':
            extract = (context) => context.req.header('upgrade');
            break;
         case 'protocol':
            extract = (context) => context.req.header('x-forwarded-proto') || 'http';
            break;
         case 'cookie':
            extract = (context) => {
               const cookies = this.parseCookies(context);
               return propertyKey ? cookies?.[propertyKey] : cookies;
            };
            break;
         case 'ip':
            extract = (context) => this.extractClientIP(context);
            break;
         case 'path':
            extract = (context) => context.req.path;
            break;
         case 'url':
            extract = (context) => context.req.url;
            break;
         case 'method':
            extract = (context) => context.req.method;
            break;
         case 'routePath':
            extract = (context) => context.req.routePath;
            break;
         case 'matchedRoutes':
            extract = (context) => context.req.matchedRoutes;
            break;
         case 'routeIndex':
            extract = (context) => context.req.routeIndex;
            break;
         case 'raw':
            extract = (context) => context.req.raw;
            break;
         case 'json':
            async = true;
            extract = (context) => context.req.json();
            break;
         case 'text':
            async = true;
            extract = (context) => context.req.text();
            break;
         case 'arrayBuffer':
            async = true;
            extract = (context) => context.req.arrayBuffer();
            break;
         case 'blob':
            async = true;
            extract = (context) => context.req.blob();
            break;
         case 'formData':
            async = true;
            extract = (context) => context.req.formData();
            break;
         case 'queries':
            extract = (context) => propertyKey
               ? context.req.queries(propertyKey)
               : context.req.queries.bind(context.req);
            break;
         case 'valid':
            extract = (context) => context.req.valid.bind(context.req);
            break;
         case 'user':
            extract = () => this.getFromAlsToken('user', propertyKey);
            break;
         case 'info':
            extract = () => this.getFromAlsToken('info', propertyKey);
            break;
         case 'owner':
            extract = () => this.getFromAlsToken('owner', propertyKey);
            break;
         case 'data':
            extract = () => this.getFromAlsToken('data', propertyKey);
            break;
         case 'filter':
            extract = () => this.getFromAlsToken('filter', propertyKey);
            break;
         case 'role':
            extract = () => this.getFromAlsToken('role', propertyKey);
            break;
         case 'permissions':
            extract = () => this.getFromAlsToken('permissions', propertyKey);
            break;
         case 'guardParams':
            extract = () => this.getFromAlsToken('guardParams', propertyKey);
            break;
         case 'req':
            extract = () => this.getRequestData();
            break;
         case 'context':
            extract = (context) => context;
            break;
         default:
            extract = () => undefined;
            break;
      }

      return { index, extract, async };
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
         metadata = [...getParameterMetadata(handler)].sort((a, b) => a.index - b.index);
         this.parameterMetadataCache.set(handler, metadata);
      }

      return metadata;
   }

   private getRequestData(): HRequest {
      return getRequestData(this.getContext());
   }

   private getContext(): Context {
      const context = this.container.get(CONTEXT);
      if (!context) {
         Err('CONTEXT not found. Ensure middleware is configured.');
      }
      return context;
   }

   private getParser() {
      return getRequestParser(this.getContext());
   }

   private extractHeaders(context: Context): Record<string, string> {
      const headers: Record<string, string> = {};
      context.req.raw.headers.forEach((value, key) => {
         headers[key] = value;
      });
      return headers;
   }

   private parseCookies(context: Context): Record<string, string> {
      const cookieHeader = context.req.header('cookie');
      if (!cookieHeader) return {};

      const cookies: Record<string, string> = {};
      for (const cookie of cookieHeader.split(';')) {
         const [name, ...rest] = cookie.trim().split('=');
         if (name && rest.length > 0) {
            cookies[name] = decodeURIComponent(rest.join('='));
         }
      }
      return cookies;
   }

   private extractClientIP(context: Context): string {
      const headers = context.req.raw.headers;
      const ipHeaders = [
         'x-forwarded-for',
         'x-real-ip',
         'cf-connecting-ip',
         'x-client-ip',
         'x-forwarded',
         'forwarded-for',
         'forwarded',
      ];

      for (const header of ipHeaders) {
         const value = headers.get(header);
         if (value) {
            return value.split(',')[0].trim();
         }
      }

      return 'unknown';
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
