import { createTranslator, translate } from './translator';
import type {
   I18nOptions,
   TFn,
   TranslationKeys,
   TranslationParams,
   Translations,
} from './types';

/**
 * Optional per-language presentation facts.
 *
 * `locale` is the BCP 47 tag used for number, date, and currency formatting,
 * which is a separate choice from the language: `fr` alone formats the French
 * way, which is not how amounts are written in Morocco.
 *
 * `direction` is declared rather than derived. Arabic is not the only RTL
 * language, and an application that adds Hebrew or Persian should not have to
 * discover that the package guessed from a hard-coded list.
 */
export interface LanguageMetadata {
   locale?: string;
   direction?: 'ltr' | 'rtl';
}

/**
 * The definition's data fields, without its methods.
 *
 * Every field here is also on the definition, so a *client* component passes
 * `definition` itself and a consumer reads what it needs. This exists for the
 * one boundary where that fails: a Server Component cannot pass an object
 * carrying functions to a client component — React rejects the whole prop, not
 * just the methods — so a server layout passes `definition.snapshot` instead.
 */
export interface I18nSnapshot<Catalogs extends Translations = Translations> {
   readonly translations: Catalogs;
   readonly defaultLanguage: LanguageOf<Catalogs>;
   readonly supportedLanguages: readonly LanguageOf<Catalogs>[];
   readonly fallbackToDefaultLanguage: boolean;
   readonly languageMetadata: Readonly<
      Partial<Record<LanguageOf<Catalogs>, LanguageMetadata>>
   >;
}

/** The language union a catalog object declares, from its own keys. */
export type LanguageOf<Catalogs extends Translations> = Extract<
   keyof Catalogs,
   string
>;

type JoinPath<Key extends string, Suffix> = Suffix extends string
   ? `${Key}.${Suffix}`
   : never;

type CatalogDepth = readonly [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
type NextDepth<Depth extends readonly unknown[]> =
   Depth extends readonly [unknown, ...infer Rest] ? Rest : readonly [];

/** Every dotted path in a catalog whose value is another dictionary. */
export type TranslationScopes<
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
              [Key in Extract<keyof Catalog, string>]: Catalog[Key] extends readonly unknown[]
                 ? never
                 : Catalog[Key] extends object
                   ? Key |
                        JoinPath<
                           Key,
                           TranslationScopes<Catalog[Key], NextDepth<Depth>>
                        >
                   : never;
           }[Extract<keyof Catalog, string>]
       : never;

type ValueAtPath<Catalog, Prefix extends string> =
   Prefix extends `${infer Head}.${infer Tail}`
      ? Head extends keyof Catalog
         ? ValueAtPath<Catalog[Head], Tail>
         : never
      : Prefix extends keyof Catalog
        ? Catalog[Prefix]
        : never;

type ScopeDictionary<Catalog, Prefix extends string> =
   string extends keyof Catalog
      ? Record<string, unknown> | undefined
      : ValueAtPath<Catalog, Prefix> extends infer Value
        ? Value extends readonly unknown[]
           ? undefined
           : Value extends Record<string, unknown>
             ? Value
             : undefined
        : undefined;

export type ScopedTranslations<
   Catalogs extends Translations,
   Prefix extends string,
> = {
   readonly [Language in keyof Catalogs]: ScopeDictionary<
      Catalogs[Language],
      Prefix
   >;
};

type DefinitionKey<
   Catalogs extends Translations,
   Default extends LanguageOf<Catalogs>,
> = TranslationKeys<Catalogs[Default]>;

export interface DefineI18nOptions<
   Catalogs extends Translations,
   Default extends LanguageOf<Catalogs>,
> {
   translations: Catalogs;
   /** One of the catalog's own keys. */
   defaultLanguage: Default;
   /** See `TranslatorOptions.fallbackToDefaultLanguage`. Off by default. */
   fallbackToDefaultLanguage?: boolean;
   /**
    * Keyed by *every* supported language, not just the default — the union
    * comes from the catalog rather than from `defaultLanguage`, so an entry for
    * a language the catalog does not ship is a compile error.
    */
   languageMetadata?: Partial<Record<LanguageOf<Catalogs>, LanguageMetadata>>;
}

/**
 * A catalog, its language union, and the helpers an application would otherwise
 * rewrite around it — with no React, Next.js, or `najm-core` import anywhere in
 * the module.
 *
 * The same definition serves the server plugin (through `options`) and the
 * React provider (through `translations` plus `fallbackToDefaultLanguage`), so
 * the two paths cannot disagree about fallback policy.
 */
export interface I18nDefinition<
   Catalogs extends Translations,
   Default extends LanguageOf<Catalogs> = LanguageOf<Catalogs>,
> {
   readonly translations: Catalogs;
   /** Narrowed to the literal that was passed, not widened to the union. */
   readonly defaultLanguage: Default;
   readonly supportedLanguages: readonly LanguageOf<Catalogs>[];
   readonly fallbackToDefaultLanguage: boolean;

   isLanguage(value: unknown): value is LanguageOf<Catalogs>;
   normalizeLanguage(value: unknown): LanguageOf<Catalogs>;

   translate(
      language: LanguageOf<Catalogs>,
      key: DefinitionKey<Catalogs, Default>,
      params?: TranslationParams,
   ): string;
   createTranslator(
      language: LanguageOf<Catalogs>,
   ): TFn<DefinitionKey<Catalogs, Default>>;

   locale(language: LanguageOf<Catalogs>): string;
   direction(language: LanguageOf<Catalogs>): 'ltr' | 'rtl';

   /**
    * Projects every language onto a nested branch of its catalog.
    *
    * The returned catalogs hold the *same object references* as the input — no
    * clone — because a UI scope of a 100 KB catalog is read on every render and
    * copying it would cost more than the whole translator.
    */
   scope<const Prefix extends TranslationScopes<Catalogs[Default]>>(
      prefix: Prefix,
   ): I18nDefinition<ScopedTranslations<Catalogs, Prefix>, Default>;

   /**
    * The declared metadata, as data.
    *
    * `locale()` and `direction()` read it, but a consumer that has to *derive*
    * something per language — a formatting-tag map, a direction resolver it
    * owns — needs the table rather than two accessors, and a React provider
    * needs it as data because a function cannot be a prop it re-derives from.
    */
   readonly languageMetadata: Readonly<
      Partial<Record<LanguageOf<Catalogs>, LanguageMetadata>>
   >;

   /** Config for `i18n()`, ready to spread into the server plugin. */
   readonly options: I18nOptions;

   /**
    * Plain-data projection, safe to pass from a Server Component to a client
    * provider. Frozen and built once, so it can be passed as a prop without
    * giving a memo a new identity on every render.
    */
   readonly snapshot: I18nSnapshot<Catalogs>;
}

function readScope(
   dictionary: Record<string, unknown>,
   prefix: string,
): Record<string, unknown> | undefined {
   const value = prefix.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
   }, dictionary);

   return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
}

export function defineI18n<
   const Catalogs extends Translations,
   const Default extends LanguageOf<Catalogs>,
>(
   options: DefineI18nOptions<Catalogs, Default>,
): I18nDefinition<Catalogs, Default> {
   const {
      translations,
      defaultLanguage,
      fallbackToDefaultLanguage = false,
      languageMetadata,
   } = options;

   const supportedLanguages = Object.keys(translations) as LanguageOf<Catalogs>[];

   if (!supportedLanguages.includes(defaultLanguage)) {
      throw new Error(
         `defineI18n: defaultLanguage '${String(defaultLanguage)}' is not a key of translations ` +
            `(${supportedLanguages.map(String).join(', ') || 'none'}).`,
      );
   }

   for (const language of Object.keys(languageMetadata ?? {})) {
      if (!supportedLanguages.includes(language as LanguageOf<Catalogs>)) {
         throw new Error(
            `defineI18n: languageMetadata has an entry for '${language}', which is not a ` +
               `key of translations (${supportedLanguages.map(String).join(', ')}).`,
         );
      }
   }

   const languageSet: ReadonlySet<string> = new Set(supportedLanguages as string[]);
   const translatorOptions = { defaultLanguage, fallbackToDefaultLanguage };

   const frozenLanguages = Object.freeze([...supportedLanguages]);
   const frozenMetadata = Object.freeze({ ...languageMetadata });
   const snapshot: I18nSnapshot<Catalogs> = Object.freeze({
      translations,
      defaultLanguage,
      supportedLanguages: frozenLanguages,
      fallbackToDefaultLanguage,
      languageMetadata: frozenMetadata,
   });

   const definition: I18nDefinition<Catalogs, Default> = {
      translations,
      defaultLanguage,
      supportedLanguages: frozenLanguages,
      fallbackToDefaultLanguage,

      isLanguage(value): value is LanguageOf<Catalogs> {
         return typeof value === 'string' && languageSet.has(value);
      },

      normalizeLanguage(value) {
         return typeof value === 'string' && languageSet.has(value)
            ? (value as LanguageOf<Catalogs>)
            : defaultLanguage;
      },

      translate(language, key, params) {
         return translate(
            translations,
            language,
            key as string,
            params,
            translatorOptions,
         );
      },

      createTranslator(language) {
         return createTranslator(
            translations,
            language,
            translatorOptions,
         ) as TFn<DefinitionKey<Catalogs, Default>>;
      },

      locale(language) {
         return languageMetadata?.[language]?.locale ?? language;
      },

      direction(language) {
         return languageMetadata?.[language]?.direction ?? 'ltr';
      },

      scope(prefix) {
         const scoped: Translations = {};

         const defaultBranch = readScope(
            translations[defaultLanguage] as Record<string, unknown>,
            prefix,
         );
         if (!defaultBranch) {
            throw new Error(
               `defineI18n: scope '${prefix}' is not an object in the default language ` +
                  `'${String(defaultLanguage)}'.`,
            );
         }

         for (const language of supportedLanguages) {
            const branch = readScope(
               translations[language] as Record<string, unknown>,
               prefix,
            );
            // Keep the own property even when the dictionary is absent. React
            // enumerates it as supported, while the translator sees
            // `undefined` and applies its unconditional whole-language
            // fallback to the default scoped dictionary.
            scoped[language] = branch;
         }

         // A missing scope in a partial locale is normal — the fallback policy
         // Missing branches in non-default locales stay as own `undefined`
         // properties, preserving the full language union while fallback
         // supplies readable strings.
         return defineI18n({
            translations: scoped,
            defaultLanguage: defaultLanguage as string,
            fallbackToDefaultLanguage,
            languageMetadata: languageMetadata as Partial<
               Record<string, LanguageMetadata>
            >,
         }) as unknown as I18nDefinition<ScopedTranslations<Catalogs, typeof prefix>, Default>;
      },

      languageMetadata: frozenMetadata,
      snapshot,

      get options(): I18nOptions {
         return {
            translations,
            defaultLanguage,
            supportedLanguages: [...supportedLanguages],
            fallbackToDefaultLanguage,
         };
      },
   };

   return definition;
}
