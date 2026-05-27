// ============================================================================
// Middleware Module Types
// ============================================================================

import type { Context, MiddlewareHandler, Next } from 'hono';
import type { Constructor, InjectionDefinition } from 'diject';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface MiddlewareConfig {
   debug?: boolean;
   requestIdHeader?: string;
   exclude?: string[];
   use?: MiddlewareHandler[];
}


export type MiddlewarePluginConfig = boolean | MiddlewareConfig | null | undefined;

// ============================================================================
// DECORATOR OPTIONS
// ============================================================================

export interface MiddlewareDecoratorOptions {
   order?: number;
   path?: string;
   name?: string;
}


export interface UseDecoratorOptions {
   order?: number;
   path?: string;
}

// ============================================================================
// INJECTION TYPES
// ============================================================================

export interface MiddlewareClassInjection extends InjectionDefinition {
   type: 'middleware:class';
   target: Constructor;
   options: MiddlewareDecoratorOptions;
}

export interface MiddlewareUseInjection extends InjectionDefinition {
   type: 'middleware:use';
   target: Constructor;
   propertyKey: string | symbol;
   options: UseDecoratorOptions;
}

export interface Interceptor extends InjectionDefinition {
   type: 'middleware';
   name: string;
   order: number;
   handler: MiddlewareHandler;
   path?: string;
}

// ============================================================================
// MIDDLEWARE CLASS INTERFACE
// ============================================================================

export interface MiddlewareClass {
   use(ctx: Context, next: Next): Promise<Response | void>;
}

