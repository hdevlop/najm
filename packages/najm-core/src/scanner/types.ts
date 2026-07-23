// ============================================================================
// scanner/types.ts - Scanner type definitions
// ============================================================================

import type { Constructor } from 'diject';

export const ScanType = {
   CONTROLLER: 'controller',
   SERVICE: 'service',
   REPOSITORY: 'repository',
   MIDDLEWARE: 'middleware',
   GUARD : 'guard',
   APP: 'app',
   PLUGIN: 'plugin',
   CORE: 'core',
} as const;

export type ScanTypeValue = typeof ScanType[keyof typeof ScanType];

export interface ScanCallbacks {
   onClass?: (target: Constructor) => void;
   onMethod?: (target: Constructor, methodName: string, method: Function) => void;
}

// ============================================================================
// Injection Types - Single source of truth for all plugin injections
// ============================================================================

export const INJECTION_TYPES = {
   // Router
   ROUTE: 'route',
   
   // Params
   PARAMS: 'params',
   
   // Middleware (used by: MiddlewareService, GuardService, CorsService, I18nService)
   MIDDLEWARE: 'middleware',
   MIDDLEWARE_CLASS: 'middleware:class',
   MIDDLEWARE_USE: 'middleware:use',
   
   // Events
   EVENT: 'event',
   
   // I18n
   I18N: 'i18n',
} as const;

export type InjectionType = typeof INJECTION_TYPES[keyof typeof INJECTION_TYPES];