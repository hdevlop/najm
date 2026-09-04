import { defineI18n } from 'najm-i18n';

import en from './en';
import fr from './fr';

/**
 * One definition for the whole app.
 *
 * The language union, the supported-language list, the normalizer the cookie
 * route needs, the formatting locales the provider needs, the writing direction
 * the layout needs, and the fallback policy both the server and React paths
 * need — all derived from the catalog rather than re-declared beside it.
 */
export const playgroundI18n = defineI18n({
  translations: { en, fr },
  defaultLanguage: 'en',
  // `fr.ts` deliberately omits `common.untranslated`. Without this, French
  // renders the key; with it, French renders the English string until a
  // translation lands. See the `/i18n` page.
  fallbackToDefaultLanguage: true,
  languageMetadata: {
    en: { locale: 'en-MA', direction: 'ltr' },
    fr: { locale: 'fr-MA', direction: 'ltr' },
  },
});

/** The nested `common` branch, by reference — no clone of either catalog. */
export const playgroundCommonI18n = playgroundI18n.scope('common');

export const translations = playgroundI18n.translations;
export type Locale = (typeof playgroundI18n.supportedLanguages)[number];

/** `{ en: 'en-MA', fr: 'fr-MA' }`, built from the definition's metadata. */
export const playgroundLocales = Object.fromEntries(
  playgroundI18n.supportedLanguages.map((language) => [
    language,
    playgroundI18n.locale(language),
  ]),
) as Record<Locale, string>;
