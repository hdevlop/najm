'use client';

import * as React from 'react';
import { I18nProvider, useTranslation } from 'najm-i18n/react';
import type { Translations } from 'najm-i18n';

import { NBrandingStateProvider } from '../components/branding';
import type { NBrandingInput } from '../components/branding';
import { NajmFormatProvider } from '../format/provider';
import { NajmNextUIProvider } from './next';
import type { NajmNextUIProviderProps } from './next';
import { FormDevToolsProvider } from '../components/form/FormDevToolsContext';
import type { FormDevToolsOptions } from '../components/form/formFill';

// Re-export the feedback state components directly, not via the root barrel:
// this entry is the Client Component boundary a Next Server Component route
// imports, and the root barrel would drag the rest of the kit into the same
// graph for the sake of these five exports.
export { NLoadingState } from '../components/feedback/NLoadingState';
export type { NLoadingStateProps } from '../components/feedback/NLoadingState';
export { NErrorState } from '../components/feedback/NErrorState';
export type { NErrorStateProps } from '../components/feedback/NErrorState';
export { NEmptyState } from '../components/feedback/NEmptyState';
export type { NEmptyStateProps } from '../components/feedback/NEmptyState';
export { NForbiddenState } from '../components/feedback/NForbiddenState';
export type { NForbiddenStateProps } from '../components/feedback/NForbiddenState';
export { NNotFoundState } from '../components/feedback/NNotFoundState';
export type { NNotFoundStateProps } from '../components/feedback/NNotFoundState';
export type {
  FeedbackKey,
  NFeedbackDefaults,
  NFeedbackLabelKeys,
  NFeedbackLabels,
} from '../components/feedback/feedbackDefaults';
export { DEFAULT_FEEDBACK_KEY_PREFIX } from '../components/feedback/feedbackDefaults';
export type { NFeedbackSurface } from '../components/feedback/NFeedbackStateFrame';

/** Branding shown by the kit's chrome. Purely presentational values. */
export interface NajmAppBranding {
  appName?: string;
  logoExpanded?: string | null;
  logoCollapsed?: string | null;
}

/**
 * The part of a `najm-i18n` definition this provider reads.
 *
 * Structural, so a whole definition satisfies it — its methods are simply
 * extra — and named for data rather than behaviour because everything derived
 * here (the writing direction, the formatting tags) is declared metadata.
 *
 * That also decides what a Server Component may pass. This provider is a
 * Client Component, and React rejects a prop carrying functions outright, so a
 * server layout passes `definition.snapshot` — the same fields without the
 * methods — while a client parent passes the definition itself.
 */
export interface NajmAppI18n {
  translations: Translations;
  defaultLanguage?: string;
  supportedLanguages?: readonly string[];
  fallbackToDefaultLanguage?: boolean;
  languageMetadata?: {
    readonly [language: string]:
      | { locale?: string; direction?: 'ltr' | 'rtl' }
      | undefined;
  };
}

export interface NajmAppProviderProps
  extends Omit<NajmNextUIProviderProps, 't'> {
  /**
   * Enables schema-driven form filling for every `NForm` and `WizardForm`.
   * `true` uses F8; an options object can choose another shortcut.
   */
  formDevTools?: boolean | FormDevToolsOptions;
  /**
   * A `najm-i18n` definition, standing in for five props: `translations`,
   * `defaultLanguage`, `fallbackToDefaultLanguage`, `locales` and
   * `getLanguageDirection`. All five are already declared in the definition, so
   * an application that has one should not have to take it apart and hand the
   * pieces back. Any of them passed explicitly still wins, which is how an
   * application overrides one facet without abandoning the definition.
   *
   * From a Server Component, pass `definition.snapshot` instead — see
   * `NajmAppI18n`.
   *
   * `initialLanguage` is deliberately not part of it: the active language is a
   * per-request value no definition can know.
   */
  i18n?: NajmAppI18n;
  /**
   * Catalog for `najm-i18n`. Supplying it mounts an `I18nProvider` and derives
   * the pagination labels from it, so `t` is not a prop here — the provider
   * already has the translator and passing one in would be a second source of
   * truth.
   *
   * Defaults to `i18n.translations`.
   */
  translations?: Translations;
  initialLanguage?: string;
  /** Defaults to `i18n.defaultLanguage`. */
  defaultLanguage?: string;
  /**
   * Resolves a key missing from the active language against `defaultLanguage`
   * instead of echoing the key. Forwarded to `najm-i18n`'s `I18nProvider`; see
   * that package's "Missing-key fallback" for the full matrix.
   *
   * Off by default, matching the package. An application shipping an
   * incomplete locale beside a complete one turns it on here rather than
   * pre-merging its catalogs.
   *
   * Defaults to `i18n.fallbackToDefaultLanguage`.
   */
  fallbackToDefaultLanguage?: boolean;
  /**
   * Maps a language to the writing direction applied to `<html>`.
   *
   * Defaults to `i18n.languageMetadata`, resolving an unsupported language
   * against `defaultLanguage` the way the definition's own `direction` does,
   * rather than falling through to `najm-i18n`'s built-in Arabic guess.
   */
  getLanguageDirection?: (language: string) => 'ltr' | 'rtl';
  /**
   * Where the chosen language is POSTed, as `{ language }`. Defaults to
   * `/api/ui-language`.
   *
   * Unlike theme and time zone, this deliberately does *not* refresh the
   * router: `najm-i18n` swaps catalogs reactively on the client, and a refresh
   * would discard that work to re-render the same strings from the server.
   */
  languageEndpoint?: string;

  /**
   * The product name, used as the logo's `alt` and by the kit's chrome.
   *
   * Separate from `initialBranding` because it is a constant rather than
   * something a branding editor swaps, and because it is the one mark no
   * branding endpoint returns. An `appName` inside `initialBranding` wins.
   */
  appName?: string;

  /**
   * ISO 4217 code for `useNajmFormat().money`, e.g. `"MAD"`.
   *
   * Omitted means the application does not format currency. It is not defaulted
   * to anything: rendering an amount in the wrong currency is worse than the
   * error thrown for the missing code.
   */
  currency?: string;
  /**
   * Maps a `najm-i18n` language onto the BCP 47 tag used for formatting, e.g.
   * `{ en: "en-MA", fr: "fr-MA" }`.
   *
   * The distinction matters because language and region are separate choices:
   * `fr` alone formats dates and separators the French way, which is not how
   * they are written in Morocco. Unmapped languages are used as-is.
   *
   * Defaults to the `locale` of each `i18n.languageMetadata` entry.
   */
  locales?: Record<string, string>;
  /**
   * Fixes the formatting locale, ignoring the active language. Escape hatch for
   * an application whose language and number formats are genuinely independent.
   */
  locale?: string;
  /** Rendered for absent values. Defaults to an em dash. */
  formatPlaceholder?: string;

  /**
   * Controlled marks. Prefer `initialBranding` — passing this means the
   * application holds the state itself, which is the file this provider exists
   * to delete.
   */
  branding?: NBrandingInput;
  /**
   * Seeds marks this provider owns from then on; ignored after mount. A
   * branding editor swaps them through `useNBrandingEditor`.
   *
   * Takes a branding endpoint's payload as-is — `sidebarLogoExpandedPath` and
   * `sidebarLogoCollapsedPath` are read straight off it, and unrelated fields
   * are ignored — so the application forwards its response rather than
   * renaming two keys here.
   */
  initialBranding?: NBrandingInput;
}

const DEFAULT_LANGUAGE_ENDPOINT = '/api/ui-language';

type InnerProps = Omit<
  NajmAppProviderProps,
  | 'i18n'
  | 'translations'
  | 'initialLanguage'
  | 'defaultLanguage'
  | 'fallbackToDefaultLanguage'
  | 'getLanguageDirection'
  | 'languageEndpoint'
  | 'appName'
  | 'formDevTools'
>;

/**
 * Reads the translator out of the `I18nProvider` this file just mounted.
 *
 * A component cannot consume a context it renders itself, so the read has to
 * happen one level down. Keeping that level *inside* the package is the whole
 * point: it is the boundary that used to force every application to author a
 * bridge component of its own.
 */
function NajmAppUI({
  children,
  branding,
  initialBranding,
  currency,
  locale,
  locales,
  formatPlaceholder,
  ...props
}: InnerProps) {
  const { t, language } = useTranslation();
  const resolved = locale ?? locales?.[language] ?? language;

  return (
    <NajmNextUIProvider t={t} {...props}>
      <NBrandingStateProvider
        branding={branding}
        initialBranding={initialBranding}
      >
        <NajmFormatProvider
          locale={resolved}
          currency={currency}
          placeholder={formatPlaceholder}
        >
          {children}
        </NajmFormatProvider>
      </NBrandingStateProvider>
    </NajmNextUIProvider>
  );
}

function NajmAppNoI18n({
  children,
  branding,
  initialBranding,
  currency,
  locale,
  locales,
  formatPlaceholder,
  ...props
}: InnerProps) {
  return (
    <NajmNextUIProvider {...props}>
      <NBrandingStateProvider
        branding={branding}
        initialBranding={initialBranding}
      >
        <NajmFormatProvider
          locale={locale ?? 'en'}
          currency={currency}
          placeholder={formatPlaceholder}
        >
          {children}
        </NajmFormatProvider>
      </NBrandingStateProvider>
    </NajmNextUIProvider>
  );
}

/**
 * The whole UI provider stack for a Najm application, as one component.
 *
 * Language, theme, time zone, design, branding and `NTable` defaults — the
 * concerns that were previously a per-project folder of wrapper files, each one
 * existing only to read the context the one above it published.
 *
 * Auth and react-query are deliberately *not* here. They are not UI concerns,
 * they would drag `najm-auth` and `@tanstack/react-query` into this package,
 * and an application that wants different query policy should not have to fork
 * a provider to get it. Mount them above this, from their own packages.
 *
 * Design and branding are optional, and both are *uncontrolled* through their
 * `initial*` props: an application with a runtime theme or branding editor
 * seeds them from the server once and drives them afterwards through
 * `useNajmDesignEditor` and `useNBrandingEditor`, rather than holding a draft
 * state machine of its own above this provider. The controlled `design` and
 * `branding` props still work for applications that already do.
 */
export function NajmAppProvider({
  i18n,
  translations = i18n?.translations,
  initialLanguage,
  defaultLanguage = i18n?.defaultLanguage,
  fallbackToDefaultLanguage = i18n?.fallbackToDefaultLanguage,
  getLanguageDirection: languageDirection,
  locales: localeTags,
  languageEndpoint = DEFAULT_LANGUAGE_ENDPOINT,
  appName,
  initialBranding,
  formDevTools,
  ...props
}: NajmAppProviderProps) {
  // Derived, not inlined: `I18nProvider` keys its context value on
  // `getLanguageDirection`, so a fresh closure per render would re-render every
  // `useTranslation()` consumer in the tree.
  const getLanguageDirection = React.useMemo(() => {
    if (languageDirection) return languageDirection;
    if (!i18n) return undefined;

    const metadata = i18n.languageMetadata;
    const languages = i18n.supportedLanguages ?? Object.keys(i18n.translations);
    const fallback = i18n.defaultLanguage;

    return (language: string) => {
      const known = languages.includes(language) ? language : (fallback ?? language);
      return metadata?.[known]?.direction ?? 'ltr';
    };
  }, [i18n, languageDirection]);

  const locales = React.useMemo(() => {
    if (localeTags) return localeTags;
    if (!i18n?.languageMetadata) return undefined;

    const metadata = i18n.languageMetadata;
    const languages = i18n.supportedLanguages ?? Object.keys(i18n.translations);

    // Unmapped languages are used as-is, matching the prop's own contract.
    return Object.fromEntries(
      languages.map((language) => [language, metadata[language]?.locale ?? language]),
    );
  }, [i18n, localeTags]);

  const persistLanguage = React.useCallback(
    async (language: string) => {
      const response = await fetch(languageEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to persist language to ${languageEndpoint}: ${response.status}`,
        );
      }
    },
    [languageEndpoint],
  );

  // Spread second so an `appName` inside the payload still wins. Only read at
  // mount by `NBrandingStateProvider`, so a fresh object per render costs
  // nothing.
  const seeded = appName ? { appName, ...initialBranding } : initialBranding;

  // Without a catalog there is nothing for `I18nProvider` to serve, and
  // mounting it empty would shadow one an application had already placed above.
  if (!translations) {
    return (
      <FormDevToolsProvider value={formDevTools}>
        <NajmAppNoI18n {...props} locales={locales} initialBranding={seeded} />
      </FormDevToolsProvider>
    );
  }

  return (
    <FormDevToolsProvider value={formDevTools}>
      <I18nProvider
        translations={translations}
        initialLanguage={initialLanguage ?? defaultLanguage ?? 'en'}
        defaultLanguage={defaultLanguage}
        fallbackToDefaultLanguage={fallbackToDefaultLanguage}
        getLanguageDirection={getLanguageDirection}
        onLanguageChange={persistLanguage}
      >
        <NajmAppUI {...props} locales={locales} initialBranding={seeded} />
      </I18nProvider>
    </FormDevToolsProvider>
  );
}
