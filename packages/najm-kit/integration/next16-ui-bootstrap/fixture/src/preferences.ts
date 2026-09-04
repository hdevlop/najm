import { defineNajmPreferences } from 'najm-kit/server';

/**
 * The whole configuration a Najm application writes.
 *
 * Deliberately minimal: a catalog-shaped object, one default time zone, and
 * the compatibility cookie names an existing deployment would keep. No theme
 * list, no zone list, no cookie options, no guards.
 */
export const preferences = defineNajmPreferences({
  i18n: {
    supportedLanguages: ['en', 'fr'] as const,
    defaultLanguage: 'en',
    normalizeLanguage: (value: unknown) => (value === 'fr' ? 'fr' : 'en'),
  },
  defaultTimeZone: 'Africa/Casablanca',
  cookieNames: {
    language: 'fixture-ui-language',
    theme: 'fixture-ui-theme',
    timeZone: 'fixture-ui-timezone',
  },
});
