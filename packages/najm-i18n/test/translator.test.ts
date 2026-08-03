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
