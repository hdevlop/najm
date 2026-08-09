// ============================================================================
// najm-theme/server — locale catalogs
// ============================================================================
//
// Four languages, one key set. The parity test compares every catalog against
// English key by key, because a missing translation is not a missing string at
// runtime — `najm-i18n` falls back and the user sees English in the middle of
// an Arabic settings sheet, which is harder to notice in review than an
// obviously untranslated screen.
//
// The same catalogs serve the server's response messages and the React
// package's UI labels. Splitting them would mean two files to keep in step for
// one feature, and a consumer overriding a label would have to guess which half
// it lived in.
// ============================================================================

import ar from "./ar.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";

export const THEME_LOCALES = { en, fr, ar, es } as const;

export type ThemeLocaleLanguage = keyof typeof THEME_LOCALES;

export const THEME_SUPPORTED_LANGUAGES = Object.keys(THEME_LOCALES) as ThemeLocaleLanguage[];

/** Falls back to English, which is the one catalog guaranteed to be complete. */
export function getThemeLocale(language: string): Record<string, unknown> {
  return (THEME_LOCALES as Record<string, Record<string, unknown>>)[language] ?? THEME_LOCALES.en;
}

export { ar as THEME_AR, en as THEME_EN, es as THEME_ES, fr as THEME_FR };
