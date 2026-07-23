// ============================================================================
// Locales Index - Export default translations
// ============================================================================

import en from './en.json';

/**
 * Default auth translations organized by language
 * Can be imported and merged with user translations
 */
export const AUTH_LOCALES = {
  en,
} as const;

/**
 * Get translations for a specific language
 * Falls back to English if language not found
 */
export function getAuthLocale(lang: string): Record<string, any> {
  return AUTH_LOCALES[lang as keyof typeof AUTH_LOCALES] ?? AUTH_LOCALES.en;
}

/**
 * All supported languages in auth package
 */
export const AUTH_SUPPORTED_LANGUAGES = Object.keys(AUTH_LOCALES);

// Direct exports for convenience
export { en as AUTH_EN };
