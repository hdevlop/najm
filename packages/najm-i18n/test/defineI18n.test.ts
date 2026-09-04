import { describe, expect, test } from 'bun:test';

import { defineI18n } from '../src/defineI18n';

const translations = {
   en: {
      ui: { greeting: 'Hello', onlyInBase: 'Base only {{n}}' },
      email: { subject: 'Welcome' },
   },
   fr: {
      ui: { greeting: 'Bonjour' },
      email: { subject: 'Bienvenue' },
   },
   ar: {
      ui: { greeting: 'مرحبا' },
      email: { subject: 'أهلا' },
   },
};

const definition = defineI18n({
   translations,
   defaultLanguage: 'en',
   fallbackToDefaultLanguage: true,
   languageMetadata: {
      en: { locale: 'en-MA', direction: 'ltr' },
      fr: { locale: 'fr-MA', direction: 'ltr' },
      ar: { locale: 'ar-MA', direction: 'rtl' },
   },
});

describe('defineI18n', () => {
   test('infers the language union from the catalog keys', () => {
      expect([...definition.supportedLanguages].sort()).toEqual(['ar', 'en', 'fr']);
      expect(definition.defaultLanguage).toBe('en');

      // Compile-time proof that the union is narrowed, not `string`.
      const language: 'ar' | 'en' | 'fr' = definition.defaultLanguage;
      expect(language).toBe('en');
   });

   test('validates and normalizes a language', () => {
      expect(definition.isLanguage('fr')).toBe(true);
      expect(definition.isLanguage('de')).toBe(false);
      expect(definition.isLanguage(42)).toBe(false);
      expect(definition.normalizeLanguage('ar')).toBe('ar');
      expect(definition.normalizeLanguage('de')).toBe('en');
      expect(definition.normalizeLanguage(undefined)).toBe('en');
   });

   test('rejects a default language absent from the catalog', () => {
      expect(() =>
         defineI18n({ translations, defaultLanguage: 'de' as 'en' }),
      ).toThrow(/defaultLanguage 'de' is not a key of translations/);
   });

   test('rejects metadata for an unknown language', () => {
      expect(() =>
         defineI18n({
            translations,
            defaultLanguage: 'en',
            languageMetadata: { de: { locale: 'de-DE' } } as never,
         }),
      ).toThrow(/languageMetadata has an entry for 'de'/);
   });

   test('binds the fallback policy into translate and createTranslator', () => {
      expect(definition.translate('fr', 'ui.greeting')).toBe('Bonjour');
      expect(definition.translate('fr', 'ui.onlyInBase', { n: 2 }))
         .toBe('Base only 2');

      const t = definition.createTranslator('ar');
      expect(t('ui.greeting')).toBe('مرحبا');
      expect(t('ui.onlyInBase', { n: 1 })).toBe('Base only 1');
      expect(t('ui.nowhere' as 'ui.greeting')).toBe('ui.nowhere');
   });

   test('leaves the fallback off when it was not requested', () => {
      const strict = defineI18n({ translations, defaultLanguage: 'en' });
      expect(strict.translate('fr', 'ui.onlyInBase')).toBe('ui.onlyInBase');
      expect(strict.fallbackToDefaultLanguage).toBe(false);
   });

   test('reports locale and direction, defaulting direction to ltr', () => {
      expect(definition.locale('ar')).toBe('ar-MA');
      expect(definition.direction('ar')).toBe('rtl');
      expect(definition.direction('fr')).toBe('ltr');

      const bare = defineI18n({ translations, defaultLanguage: 'en' });
      expect(bare.locale('fr')).toBe('fr');
      expect(bare.direction('ar')).toBe('ltr');
   });

   test('scope projects every language by reference, without cloning', () => {
      const ui = definition.scope('ui');

      expect(ui.translations.en).toBe(translations.en.ui);
      expect(ui.translations.fr).toBe(translations.fr.ui);
      expect(ui.translate('fr', 'greeting')).toBe('Bonjour');
      expect(ui.translate('fr', 'onlyInBase', { n: 3 })).toBe('Base only 3');
      expect(ui.defaultLanguage).toBe('en');
      expect(ui.fallbackToDefaultLanguage).toBe(true);
   });

   test('scope preserves a language missing the branch, and still falls back', () => {
      const partial = defineI18n({
         translations: {
            en: { ui: { greeting: 'Hello' } },
            fr: { email: { subject: 'Bienvenue' } },
         },
         defaultLanguage: 'en',
         fallbackToDefaultLanguage: true,
      });

      const ui = partial.scope('ui');
      expect(Object.keys(ui.translations)).toEqual(['en', 'fr']);
      expect(ui.translations.fr).toBeUndefined();
      expect(ui.supportedLanguages).toEqual(['en', 'fr']);
      expect(ui.isLanguage('fr')).toBe(true);
      expect(ui.normalizeLanguage('fr')).toBe('fr');
      // `fr` has no `ui` branch at all, so the whole-dictionary fallback applies.
      expect(ui.translate('fr', 'greeting')).toBe('Hello');
   });

   test('rejects a scope that is absent from the default language', () => {
      expect(() => definition.scope('nope')).toThrow(
         /scope 'nope' is not an object in the default language 'en'/,
      );
      expect(() => definition.scope('ui.greeting')).toThrow(
         /scope 'ui.greeting' is not an object/,
      );
   });

   test('exposes plugin options without mutating or cloning the catalog', () => {
      expect(definition.options.translations).toBe(translations);
      expect(definition.options.defaultLanguage).toBe('en');
      expect(definition.options.fallbackToDefaultLanguage).toBe(true);
      expect([...(definition.options.supportedLanguages ?? [])].sort())
         .toEqual(['ar', 'en', 'fr']);
   });

   test('supportedLanguages is frozen', () => {
      expect(Object.isFrozen(definition.supportedLanguages)).toBe(true);
   });
});
