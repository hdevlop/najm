/**
 * The playground's one i18n type registration.
 *
 * With this file present, `useTranslation()` needs no generic arguments
 * anywhere in the app, and a mistyped key fails `tsc` rather than rendering as
 * literal key text. A program registers exactly once — see `najm-i18n`'s
 * "Typed keys without a wrapper hook".
 */
import type { TranslationKeys } from 'najm-i18n';
import type en from './locales/en';

declare module 'najm-i18n/react' {
  interface NajmI18nRegistry {
    key: TranslationKeys<typeof en>;
    language: 'en' | 'fr';
  }
}
