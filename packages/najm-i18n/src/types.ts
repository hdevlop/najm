// I18n Module Types

import type { InjectionDefinition } from 'najm-core';

// ============================================================================
// I18N TYPES
// ============================================================================

// Cookie options for language persistence
export interface I18nCookieOptions {
   path?: string;
   domain?: string;
   sameSite?: 'Strict' | 'Lax' | 'None';
   secure?: boolean;
   maxAge?: number;
   httpOnly?: boolean;
}

// Base i18n configuration options
export interface I18nOptions {
   translations: Record<string, Record<string, any>>;
   defaultLanguage?: string;
   supportedLanguages?: string[];
   order?: ('querystring' | 'header' | 'cookie' | 'path')[];
   lookupQueryString?: string;
   lookupCookie?: string;
   lookupFromHeaderKey?: string;
   lookupFromPathIndex?: number;
   caches?: ('cookie')[];
   cookieOptions?: I18nCookieOptions;
   ignoreCase?: boolean;
   convertDetectedLanguage?: (lang: string) => string;
   debug?: boolean;
}

// Decorator options
export interface I18nDecoratorOptions {
   prefix?: string;
   resolveKey?: string;
}

export type I18nPluginConfig = boolean | I18nOptions | null | undefined;

// Translation function type
export type TFn = (key: string, params?: Record<string, any>) => string;

// ============================================================================
// INJECTION TYPES
// ============================================================================

/**
 * I18n injection for @I18n decorator
 * Registers translation function injection for properties
 */
export interface I18nInjection extends InjectionDefinition {
   type: 'i18n';
   target: any;
   propertyKey: string | symbol;
   options?: I18nDecoratorOptions;
}

// Legacy alias for backward compatibility
export type I18nRegistration = I18nInjection;

export type Translations = Record<string, Record<string, unknown>>;