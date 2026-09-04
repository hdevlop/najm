import { describe, expect, test } from 'bun:test';

import {
   createTranslator,
   getNestedTranslation,
   interpolateTranslation,
   translate,
} from '../src/translator';

const translations = {
   en: {
      greeting: 'Hello {{name}}',
      applicants: { gender: { female: 'Female' } },
      untranslated: 'Base only {{count}}',
   },
   fr: {
      greeting: 'Bonjour {name}',
      applicants: { gender: { female: 'Femme' } },
   },
};

describe('shared translator', () => {
   test('resolves nested keys and both supported interpolation styles', () => {
      expect(getNestedTranslation(translations.en, 'applicants.gender.female'))
         .toBe('Female');
      expect(interpolateTranslation('Hello {{name}}', { name: 'Amina' }))
         .toBe('Hello Amina');
      expect(interpolateTranslation('Bonjour {name}', { name: 'Amina' }))
         .toBe('Bonjour Amina');
   });

   test('provides language fallback and a bound translator', () => {
      expect(translate(translations, 'ar', 'greeting', { name: 'Amina' }, {
         defaultLanguage: 'en',
      })).toBe('Hello Amina');

      const t = createTranslator(translations, 'fr', { defaultLanguage: 'en' });
      expect(t('applicants.gender.female')).toBe('Femme');
      expect(t('missing.key')).toBe('missing.key');
   });
});

describe('missing-key fallback', () => {
   const withFallback = { defaultLanguage: 'en', fallbackToDefaultLanguage: true };
   const withoutFallback = { defaultLanguage: 'en' };

   test('selected language and key both present: selected value, either way', () => {
      expect(translate(translations, 'fr', 'greeting', { name: 'Amina' }, withFallback))
         .toBe('Bonjour Amina');
      expect(translate(translations, 'fr', 'greeting', { name: 'Amina' }, withoutFallback))
         .toBe('Bonjour Amina');
   });

   test('selected language absent: default value, either way', () => {
      expect(translate(translations, 'ar', 'greeting', { name: 'Amina' }, withFallback))
         .toBe('Hello Amina');
      expect(translate(translations, 'ar', 'greeting', { name: 'Amina' }, withoutFallback))
         .toBe('Hello Amina');
   });

   test('key absent from a present language: echoes unless enabled', () => {
      expect(translate(translations, 'fr', 'untranslated', undefined, withoutFallback))
         .toBe('untranslated');
      expect(translate(translations, 'fr', 'untranslated', undefined, {}))
         .toBe('untranslated');
      expect(translate(translations, 'fr', 'untranslated', undefined, withFallback))
         .toBe('Base only {{count}}');
   });

   test('interpolates the fallen-back template', () => {
      expect(translate(translations, 'fr', 'untranslated', { count: 3 }, withFallback))
         .toBe('Base only 3');
   });

   test('key absent from both: echoes even when enabled', () => {
      expect(translate(translations, 'fr', 'nowhere.at.all', undefined, withFallback))
         .toBe('nowhere.at.all');
   });

   test('absent default dictionary does not throw', () => {
      expect(translate(translations, 'fr', 'untranslated', undefined, {
         defaultLanguage: 'de',
         fallbackToDefaultLanguage: true,
      })).toBe('untranslated');
      expect(translate(translations, 'de', 'greeting', undefined, {
         defaultLanguage: 'de',
         fallbackToDefaultLanguage: true,
      })).toBe('greeting');
   });

   test('a bound translator carries the policy', () => {
      const t = createTranslator(translations, 'fr', withFallback);
      expect(t('untranslated', { count: 1 })).toBe('Base only 1');
      expect(t('applicants.gender.female')).toBe('Femme');
      expect(t('missing.key')).toBe('missing.key');
   });

   test('no defaultLanguage means the option has nothing to fall back to', () => {
      expect(translate(translations, 'fr', 'untranslated', undefined, {
         fallbackToDefaultLanguage: true,
      })).toBe('untranslated');
   });
});
