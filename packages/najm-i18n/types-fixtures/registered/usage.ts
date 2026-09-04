// Compile-only. Nothing here runs; `tsc --noEmit` is the assertion.
import { useTranslation } from "najm-i18n/react";
import type { TranslationKeys } from "najm-i18n";

export function registeredKeysAreChecked() {
  const { t, language, changeLanguage } = useTranslation();

  // Valid keys resolve with no generic arguments at the call site.
  t("ui.greeting");
  t("ui.orders.title");
  t("email.subject", { count: 2 });

  // @ts-expect-error a key that is not in the registered catalog
  t("ui.orders.titel");

  // @ts-expect-error an object path is not a leaf, so it is not a key
  t("ui.orders");

  // The language union is narrowed too.
  const current: "ar" | "en" | "fr" = language;
  void changeLanguage("ar");

  // @ts-expect-error a language outside the registered union
  void changeLanguage("de");

  // @ts-expect-error the narrowed language is not assignable to a foreign union
  const foreign: "de" | "it" = language;

  return { current, foreign };
}

export function explicitGenericsStillOverrideTheRegistry() {
  const { t, language } = useTranslation<"only.this", "de">();

  t("only.this");
  // @ts-expect-error explicit generics win over the registry
  t("ui.greeting");

  const german: "de" = language;
  return german;
}

// `TranslationKeys` is exported from the root entry and usable on any catalog.
type Keys = TranslationKeys<{ a: string; b: { c: string } }>;
export const keys: Keys[] = ["a", "b.c"];
// @ts-expect-error 'b' is an object, not a leaf
export const notAKey: Keys = "b";

type MixedKeys = TranslationKeys<{
  title: string;
  count: number;
  flags: string[];
}>;
export const mixedKey: MixedKeys = "title";
// @ts-expect-error non-string leaves are excluded
export const numberIsNotAKey: MixedKeys = "count";
// @ts-expect-error arrays are excluded instead of contributing their methods
export const arrayIsNotAKey: MixedKeys = "flags.map";

// ---------------------------------------------------------------------------
// defineI18n inference
// ---------------------------------------------------------------------------

import { defineI18n } from "najm-i18n";

const definition = defineI18n({
  translations: {
    en: { ui: { greeting: "Hello" } },
    fr: { ui: { greeting: "Bonjour" } },
    ar: { ui: { greeting: "..." } },
  },
  defaultLanguage: "en",
  languageMetadata: {
    // Every catalog key is accepted here, not only the default language.
    en: { locale: "en-MA" },
    fr: { locale: "fr-MA" },
    ar: { locale: "ar-MA", direction: "rtl" },
  },
});

export function definitionInfersTheFullLanguageUnion() {
  // `defaultLanguage` keeps the literal that was passed.
  const fallbackLanguage: "en" = definition.defaultLanguage;

  // Everything else spans the whole catalog.
  const anySupported: "ar" | "en" | "fr" = definition.normalizeLanguage("fr");
  definition.translate("ar", "ui.greeting");
  // @ts-expect-error definition translators accept only default-catalog leaves
  definition.translate("ar", "ui.missing");
  definition.locale("fr");
  definition.direction("ar");

  // @ts-expect-error a language the catalog does not ship
  definition.translate("de", "ui.greeting");

  // A scope keeps both the language union and the default.
  const ui = definition.scope("ui");
  const scopedDefault: "en" = ui.defaultLanguage;
  ui.translate("fr", "greeting");
  // @ts-expect-error scoped translators accept keys relative to the scope
  ui.translate("fr", "ui.greeting");
  // @ts-expect-error a string leaf cannot be used as a scope
  definition.scope("ui.greeting");
  // @ts-expect-error an unknown scope cannot be selected
  definition.scope("missing");

  return { fallbackLanguage, anySupported, scopedDefault };
}

defineI18n({
  translations: { en: { a: "A" } },
  defaultLanguage: "en",
  // @ts-expect-error metadata for a language outside the catalog
  languageMetadata: { de: { locale: "de-DE" } },
});

defineI18n({
  translations: { en: { a: "A" } },
  // @ts-expect-error a default language that is not a catalog key
  defaultLanguage: "fr",
});
