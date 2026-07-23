import { Context } from 'hono';
import { RedirectStatusCode } from 'hono/utils/http-status';
import type { InjectionDefinition, Constructor } from 'diject';

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
