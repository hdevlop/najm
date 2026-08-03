import type { TFn, TranslationParams, Translations } from './types';

export interface TranslatorOptions {
   defaultLanguage?: string;
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
   const dictionary = translations[language] ?? translations[defaultLanguage];
   const template = getNestedTranslation(dictionary, key) ?? key;
   return interpolateTranslation(template, params);
}

export function createTranslator(
   translations: Translations,
   language: string,
   options: TranslatorOptions = {},
): TFn {
   return (key, params) => translate(translations, language, key, params, options);
}
