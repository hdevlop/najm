// ============================================================================
// najm-theme/react — labels
// ============================================================================
//
// Three sources, in order: a consumer override, the application's own
// translator, then the package catalog for the active language.
//
// The translator comes second rather than first on purpose. An application that
// passes `t` has usually merged the package catalogs into `najm-i18n` and wants
// its own wording everywhere — but a `labels` override is a deliberate,
// component-level decision ("call it Branding here, Identity elsewhere") and
// must win over a catalog it may not even know about.
//
// The catalogs themselves live under `src/server/locales` and are shared with
// the response messages. One file per language for one feature, rather than one
// for the API and one for the UI that drift apart.
// ============================================================================

import ar from "../../server/locales/ar.json";
import en from "../../server/locales/en.json";
import es from "../../server/locales/es.json";
import fr from "../../server/locales/fr.json";

export const THEME_UI_LOCALES = { en, fr, ar, es } as const;

export type ThemeLanguage = keyof typeof THEME_UI_LOCALES;

export const THEME_LANGUAGES = Object.keys(THEME_UI_LOCALES) as ThemeLanguage[];

/** `"theme.actions.save"` and the like. Deliberately a string, not a union: */
/* a consumer's own slot definition names a `labelKey` this package never saw. */
export type ThemeLabelKey = string;

export type ThemeLabelOverrides = Record<ThemeLabelKey, string>;

export interface ThemeTranslatorOptions {
  language?: ThemeLanguage | string;
  /** The application's translator, usually `useTranslation().t`. */
  t?: (key: string, values?: Record<string, string | number>) => string;
  overrides?: ThemeLabelOverrides;
}

export type ThemeTranslator = (
  key: ThemeLabelKey,
  values?: Record<string, string | number>,
) => string;

function readPath(source: unknown, key: string): string | undefined {
  let current: unknown = source;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/** `{name}` only — enough for the handful of parameterized strings here. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function createThemeTranslator(options: ThemeTranslatorOptions = {}): ThemeTranslator {
  const catalog =
    (THEME_UI_LOCALES as Record<string, unknown>)[options.language ?? "en"] ?? THEME_UI_LOCALES.en;

  return (key, values) => {
    const override = options.overrides?.[key];
    if (override !== undefined) return interpolate(override, values);

    if (options.t) {
      const translated = options.t(key, values);
      // A translator that has no entry conventionally echoes the key. Treating
      // that as an answer would print `theme.actions.save` in the button, so it
      // falls through to the catalog instead.
      if (typeof translated === "string" && translated !== key) return translated;
    }

    const fromCatalog = readPath(catalog, key) ?? readPath(THEME_UI_LOCALES.en, key);
    // The key itself is the last resort. It is ugly, which is the point: a
    // consumer's custom slot with no label anywhere should be visibly missing
    // rather than silently blank.
    return interpolate(fromCatalog ?? key, values);
  };
}
