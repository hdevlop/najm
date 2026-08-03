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
}

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
}: I18nProviderProps<Language>) {
   const [language, setLanguage] = useState<Language>(initialLanguage);
   const languages = useMemo(
      () => Object.keys(translations) as Language[],
      [translations],
   );

   const t = useMemo(
      () => createTranslator(translations, language, { defaultLanguage }),
      [defaultLanguage, language, translations],
   );

   const changeLanguage = useCallback(async (nextLanguage: Language) => {
      if (!Object.prototype.hasOwnProperty.call(translations, nextLanguage)) {
         return false;
      }

      setLanguage(nextLanguage);

      if (updateDocument && typeof document !== 'undefined') {
         document.documentElement.lang = nextLanguage;
         document.documentElement.dir = nextLanguage === 'ar' ? 'rtl' : 'ltr';
      }

      await onLanguageChange?.(nextLanguage);
      return true;
   }, [onLanguageChange, translations, updateDocument]);

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
   Key extends string = string,
   Language extends string = string,
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
