import { Context, Hono, MiddlewareHandler } from 'hono';
import { RedirectStatusCode } from 'hono/utils/http-status';
import type { Constructor, InjectionDefinition } from 'diject';
import { INJECTION_TYPES } from '../scanner';
import type { ResponseConfig } from './response';

// Re-export types from params package
export type { HRequest, ValidFunction } from '../params';

// Re-export for backward compatibility
export { INJECTION_TYPES };

export interface ControllerOptions {
   path?: string;
   metadata?: Record<string, any>;
}

export interface RouteDefinition {
   method: HttpMethod;
   path: string;
   handler: Function;
   methodName: string;
}

export interface RouteEntry extends InjectionDefinition {
   type: 'route';
   target: Constructor;
   methodName: string;
   method: string;
   path: string;
   handler: Function;
}

export interface RouterPluginConfig {
   basePath?: string;
   app?: Hono;
   
   /**
    * Response formatting configuration
    */
   response?: ResponseConfig;
}

export type RedirectResponse = {
    redirect: string;
    status?: RedirectStatusCode;
};

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

/** Supported HTTP methods */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/** Base interface for middleware-providing injections */
export interface MiddlewareInjection {
   type: string;
   target: Constructor;
   methodName?: string;
   handler: MiddlewareHandler;
   order?: number;
}

export const HTTP_METHODS: readonly HttpMethod[] = [
   'get', 'post', 'put', 'patch', 'delete', 'head', 'options'
] as const;

export interface ParamsInjection {
   type: typeof INJECTION_TYPES.PARAMS;
   target: Constructor;
   methodName: string;
   metadata?: unknown[];
   resolve?: () => Promise<unknown[]>;
   resolveSync?: () => unknown[];
}
