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
   /**
    * Resolves a key absent from the detected language against `defaultLanguage`
    * rather than echoing the key. Off by default. See `TranslatorOptions`.
    */
   fallbackToDefaultLanguage?: boolean;
}

// Decorator options
export interface I18nDecoratorOptions {
   prefix?: string;
   resolveKey?: string;
}

export type I18nPluginConfig = boolean | I18nOptions | null | undefined;

export type TranslationValue = string | number | boolean | null | undefined;
export type TranslationParams = Record<string, TranslationValue>;

// Translation function type
export type TFn<Key extends string = string> = (
   key: Key,
   params?: TranslationParams,
) => string;

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

// ============================================================================
// CATALOG KEY TYPES
// ============================================================================

type JoinKey<Key extends string, Suffix> = Suffix extends string
   ? `${Key}.${Suffix}`
   : never;

type CatalogDepth = readonly [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
type NextDepth<Depth extends readonly unknown[]> =
   Depth extends readonly [unknown, ...infer Rest] ? Rest : readonly [];

/**
 * Every dotted path in a catalog that ends at a string.
 *
 * Applied to one language's dictionary — `TranslationKeys<typeof en>` — it is
 * the union an application registers through `NajmI18nRegistry`, so a typo in
 * `t('operator.oders.title')` fails to compile instead of rendering the key.
 *
 * Object-valued branches are traversed; anything that is not a string leaf
 * contributes nothing, which is what keeps a catalog carrying arrays or numbers
 * from widening the union to `string`.
 */
export type TranslationKeys<
   Catalog,
   Depth extends readonly unknown[] = CatalogDepth,
> = Depth extends readonly []
   ? never
   : Catalog extends readonly unknown[]
     ? never
     : Catalog extends object
       ? string extends keyof Catalog
         ? string
         : {
              [Key in Extract<keyof Catalog, string>]: Catalog[Key] extends string
                 ? Key
                 : JoinKey<
                      Key,
                      TranslationKeys<Catalog[Key], NextDepth<Depth>>
                   >;
           }[Extract<keyof Catalog, string>]
       : never;
