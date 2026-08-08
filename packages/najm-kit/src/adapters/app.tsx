'use client';

import * as React from 'react';
import { I18nProvider, useTranslation } from 'najm-i18n/react';
import type { Translations } from 'najm-i18n';

import { NBrandingStateProvider } from '../components/branding';
import type { NBrandingInput } from '../components/branding';
import { NajmFormatProvider } from '../format/provider';
import { NajmNextUIProvider } from './next';
import type { NajmNextUIProviderProps } from './next';

/** Branding shown by the kit's chrome. Purely presentational values. */
export interface NajmAppBranding {
  appName?: string;
  logoExpanded?: string | null;
  logoCollapsed?: string | null;
}

export interface NajmAppProviderProps
  extends Omit<NajmNextUIProviderProps, 't'> {
  /**
   * Catalog for `najm-i18n`. Supplying it mounts an `I18nProvider` and derives
   * the pagination labels from it, so `t` is not a prop here — the provider
   * already has the translator and passing one in would be a second source of
   * truth.
   */
  translations?: Translations;
  initialLanguage?: string;
  defaultLanguage?: string;
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
  | 'translations'
  | 'initialLanguage'
  | 'defaultLanguage'
  | 'languageEndpoint'
  | 'appName'
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
  translations,
  initialLanguage,
  defaultLanguage,
  languageEndpoint = DEFAULT_LANGUAGE_ENDPOINT,
  appName,
  initialBranding,
  ...props
}: NajmAppProviderProps) {
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
  if (!translations) return <NajmAppNoI18n {...props} initialBranding={seeded} />;

  return (
    <I18nProvider
      translations={translations}
      initialLanguage={initialLanguage ?? defaultLanguage ?? 'en'}
      defaultLanguage={defaultLanguage}
      onLanguageChange={persistLanguage}
    >
      <NajmAppUI {...props} initialBranding={seeded} />
    </I18nProvider>
  );
}
