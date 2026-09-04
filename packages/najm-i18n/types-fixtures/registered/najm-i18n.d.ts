/**
 * The one registration an application writes.
 *
 * Deliberately a `.d.ts` beside the program rather than an import: augmentation
 * is program-wide, so there is nothing for a source file to import from it.
 */
import type { TranslationKeys } from "najm-i18n";

declare const catalog: {
  ui: {
    greeting: string;
    orders: { title: string; empty: string };
  };
  email: { subject: string };
};

declare module "najm-i18n/react" {
  interface NajmI18nRegistry {
    key: TranslationKeys<typeof catalog>;
    language: "ar" | "en" | "fr";
  }
}
