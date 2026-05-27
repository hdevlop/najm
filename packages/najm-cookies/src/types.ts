
// ============================================================================
// COOKIE TYPES
// ============================================================================

import { InjectionDefinition } from "najm-core";

/**
 * Cookie service configuration - includes custom prefix for cookie naming
 */
export interface CookieServiceConfig {
   httpOnly?: boolean;
   secure?: boolean;
   sameSite?: 'Strict' | 'Lax' | 'None';
   path?: string;
   domain?: string;
   maxAge?: number;
   expires?: Date;
   prefix?: string; // Custom prefix for all cookie names (e.g., 'app_')
}

/**
 * Hono-compatible cookie options (excludes our custom prefix to avoid conflicts)
 */
export type CookieOptions = Omit<HonoCookieOptions, 'prefix'>;

export interface HonoCookieOptions {
   domain?: string;
   expires?: Date;
   httpOnly?: boolean;
   maxAge?: number;
   path?: string;
   sameSite?: 'Strict' | 'Lax' | 'None' | boolean;
   secure?: boolean;
}

export interface CookiesDecoratorOptions {
   prefix?: string;
   secret?: string;
   signed?: boolean;
}

export type CookiePluginConfig = boolean | CookieServiceConfig | null | undefined;

// ============================================================================
// INJECTION TYPES
// ============================================================================

/**
 * Cookie injection for @Cookies decorator
 * Registers cookie access injection for properties
 */
export interface CookieInjection extends InjectionDefinition  {
   type: 'cookies';
   target: any;
   propertyKey: string | symbol;
   options?: CookiesDecoratorOptions;
}