import type { TFn, TranslationParams, Translations } from './types';

export interface TranslatorOptions {
   defaultLanguage?: string;
   /**
    * Resolves a key that is absent from the selected language against
    * `defaultLanguage` instead of echoing the key.
    *
    * Off by default: echoing a missing key is how an untranslated string stays
    * visible in the UI and in `najm-kit`'s label diagnostics. Applications that
    * ship an incomplete locale beside a complete one turn this on so a key
    * added to the base catalog renders readable text everywhere until its
    * translation lands.
    *
    * It never affects an entirely absent language — that already falls back to
    * `defaultLanguage`, with or without this option.
    */
   fallbackToDefaultLanguage?: boolean;
}

export function getNestedTranslation(
   dictionary: unknown,
   key: string,
): string | undefined {
   const value = key.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
   }, dictionary);

   return typeof value === 'string' ? value : undefined;
}

export function interpolateTranslation(
   template: string,
   params?: TranslationParams,
): string {
   if (!params) return template;

   return template.replace(
      /\{\{(\w+)\}\}|\{(\w+)\}/g,
      (placeholder, doubleBraceName: string | undefined, singleBraceName: string | undefined) => {
         const name = doubleBraceName ?? singleBraceName;
         return name && Object.prototype.hasOwnProperty.call(params, name)
            ? String(params[name])
            : placeholder;
      },
   );
}

export function translate(
   translations: Translations,
   language: string,
   key: string,
   params?: TranslationParams,
   options: TranslatorOptions = {},
): string {
   const defaultLanguage = options.defaultLanguage ?? language;
   const defaultDictionary = translations[defaultLanguage];
   // An absent selected language falls back to the default dictionary wholesale.
   // That predates `fallbackToDefaultLanguage` and is deliberately unconditional.
   const selectedDictionary = translations[language] ?? defaultDictionary;

   const template =
      getNestedTranslation(selectedDictionary, key) ??
      (options.fallbackToDefaultLanguage && selectedDictionary !== defaultDictionary
         ? getNestedTranslation(defaultDictionary, key)
         : undefined) ??
      key;

   return interpolateTranslation(template, params);
}

export function createTranslator(
   translations: Translations,
   language: string,
   options: TranslatorOptions = {},
): TFn {
   return (key, params) => translate(translations, language, key, params, options);
}
