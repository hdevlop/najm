import { Context } from 'hono';
import { RedirectStatusCode } from 'hono/utils/http-status';
import type { InjectionDefinition, Constructor, Container } from 'diject';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface HRequest {
    // Path parameters
    params: Record<string, string>;
    query: Record<string, string>;
    queries: (name: string) => string[];
    body: unknown;
    headers: Record<string, string>;
    header: any;
    path: string;
    url: string;
    method: string;
    raw: Request;

    routePath: string;
    matchedRoutes: Array<{
        handler: Function;
        method: string;
        path: string;
    }>;
    routeIndex: number;

    json<T = any>(): Promise<T>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    valid: ValidFunction;
    cookies: Record<string, string>;
    files: Record<string, File | File[]>;
    ip: string;
}

export type ValidFunction = (target: 'form' | 'json' | 'query' | 'header' | 'cookie' | 'param') => any;

export type RedirectResponse = {
    redirect: string;
    status?: RedirectStatusCode;
};

// ============================================================================
// PARAMETER DECORATOR TYPES
// ============================================================================

export type ParamType =
   // Body types
   | 'body' | 'json' | 'text' | 'formData' | 'arrayBuffer' | 'blob'
   // URL/Route types
   | 'params' | 'query' | 'queries' | 'path' | 'url' | 'method'
   | 'routePath' | 'matchedRoutes' | 'routeIndex'
   // Header types
   | 'headers' | 'contentType' | 'contentLength' | 'origin' | 'referer'
   | 'language' | 'encoding' | 'connection' | 'upgrade' | 'protocol'
   // Context types
   | 'context' | 'req' | 'cookie' | 'file' | 'ip' | 'user' | 'owner'
   | 'info' | 'data' | 'filter' | 'valid' | 'guardParams' | 'raw'
   // Authorization types
   | 'role' | 'permissions'
   // Other
   | 'custom';

export interface ParameterMetadata {
   index: number;
   type: ParamType;
   propertyKey?: string;
   options?: any;
}

// ============================================================================
// CUSTOM PARAMETER TYPES
// ============================================================================

/**
 * What a `createParamDecorator` resolver can read about the invocation it
 * serves. REST routes and MCP tool calls pass the same shape, so one resolver
 * serves both transports.
 */
export interface ParamResolveContext {
   /** The transport invoking the handler. */
   readonly transport: 'http' | 'mcp';
   /** The container. Request values such as the authenticated user are read through it. */
   readonly container: Container;
   /**
    * A request header, by case-insensitive name. For an MCP tool call this is
    * the transport request's header, when there is one.
    */
   header(name: string): string | undefined;
   /**
    * A query value, read the way `@Query(name)` reads it: the validated query
    * when the route validated one, else the raw query string. For an MCP tool
    * call, the tool input's value for a declared query key.
    */
   query(name: string): unknown;
   /**
    * A route parameter, read the way `@Params(name)` reads it. For an MCP tool
    * call, the tool input's value for a declared params key.
    */
   param(name: string): unknown;
}

/** Computes a custom parameter's value for one invocation. */
export type ParamResolve<T = unknown, O = undefined> = (
   context: ParamResolveContext,
   options: O | undefined,
) => T | Promise<T>;

/** What `createParamDecorator` stores in `ParameterMetadata.options`. */
export interface CustomParamOptions {
   resolve: ParamResolve<unknown, any>;
   options?: unknown;
}

// ============================================================================
// PLUGIN CONFIG
// ============================================================================

export type ParamPluginConfig = boolean | any;

// ============================================================================
// INJECTION TYPES
// ============================================================================

/**
 * Parameter injection for parameter decorators (@Body, @Query, etc.)
 */
export interface ParamInjection extends InjectionDefinition {
   type: 'params';
   target: Constructor;
   methodName: string;
   metadata: ParameterMetadata[];
}
