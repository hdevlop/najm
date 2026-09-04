'use client';

import {
   createContext,
   createElement,
   useCallback,
   useContext,
   useMemo,
   useState,
   type ReactNode,
} from 'react';

import { createTranslator } from './translator';
import type { TFn, TranslationParams, Translations } from './types';

export interface I18nProviderProps<Language extends string = string> {
   children: ReactNode;
   translations: Translations;
   initialLanguage: Language;
   defaultLanguage?: Language;
   onLanguageChange?: (language: Language) => void | Promise<void>;
   updateDocument?: boolean;
   /**
    * Resolves a key absent from the active language against `defaultLanguage`
    * rather than echoing the key. Off by default. See `TranslatorOptions`.
    */
   fallbackToDefaultLanguage?: boolean;
   /** Maps a language to the writing direction applied to `<html>`. */
   getLanguageDirection?: (language: Language) => 'ltr' | 'rtl';
}

function defaultLanguageDirection(language: string): 'ltr' | 'rtl' {
   return language === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Declaration-merging slot for an application's key and language unions.
 *
 * Augmenting it once per TypeScript program types every direct
 * `useTranslation()` call, so an application does not need a wrapper hook whose
 * only job is to pass the same two generic arguments at every call site:
 *
 * ```ts
 * // najm-i18n.d.ts
 * declare module 'najm-i18n/react' {
 *   interface NajmI18nRegistry {
 *     key: import('@acme/server/locales').UiTranslationKey;
 *     language: 'ar' | 'en' | 'fr';
 *   }
 * }
 * ```
 *
 * A TypeScript program has exactly one registration. React cannot infer these
 * from the provider — the hook and the provider are different call sites — and
 * a second catalog in the same program keeps using explicit generics, which
 * still work unchanged.
 */
export interface NajmI18nRegistry {}

type RegisteredKey = NajmI18nRegistry extends { key: infer Key extends string }
   ? Key
   : string;

type RegisteredLanguage = NajmI18nRegistry extends {
   language: infer Language extends string;
}
   ? Language
   : string;

export interface ReactI18n<Language extends string = string> {
   language: Language;
   languages: Language[];
   t: TFn;
   changeLanguage: (language: Language) => Promise<boolean>;
}

const I18nContext = createContext<ReactI18n | null>(null);

export function I18nProvider<Language extends string = string>({
   children,
   translations,
   initialLanguage,
   defaultLanguage = initialLanguage,
   onLanguageChange,
   updateDocument = true,
   fallbackToDefaultLanguage,
   getLanguageDirection = defaultLanguageDirection,
}: I18nProviderProps<Language>) {
   const [language, setLanguage] = useState<Language>(initialLanguage);
   const languages = useMemo(
      () => Object.keys(translations) as Language[],
      [translations],
   );

   const t = useMemo(
      () => createTranslator(translations, language, {
         defaultLanguage,
         fallbackToDefaultLanguage,
      }),
      [defaultLanguage, fallbackToDefaultLanguage, language, translations],
   );

   const changeLanguage = useCallback(async (nextLanguage: Language) => {
      if (!Object.prototype.hasOwnProperty.call(translations, nextLanguage)) {
         return false;
      }

      setLanguage(nextLanguage);

      if (updateDocument && typeof document !== 'undefined') {
         document.documentElement.lang = nextLanguage;
         document.documentElement.dir = getLanguageDirection(nextLanguage);
      }

      await onLanguageChange?.(nextLanguage);
      return true;
   }, [getLanguageDirection, onLanguageChange, translations, updateDocument]);

   const value = useMemo<ReactI18n<Language>>(
      () => ({ language, languages, t, changeLanguage }),
      [changeLanguage, language, languages, t],
   );

   return createElement(
      I18nContext.Provider,
      { value: value as ReactI18n },
      children,
   );
}

export function useTranslation<
   Key extends string = RegisteredKey,
   Language extends string = RegisteredLanguage,
>(): Omit<ReactI18n<Language>, 't'> & {
   t: (key: Key, params?: TranslationParams) => string;
} {
   const context = useContext(I18nContext);
   if (!context) {
      throw new Error('useTranslation must be used within an I18nProvider.');
   }
   return context as Omit<ReactI18n<Language>, 't'> & {
      t: (key: Key, params?: TranslationParams) => string;
   };
}
