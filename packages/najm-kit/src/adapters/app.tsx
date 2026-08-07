'use client';

import * as React from 'react';
import { I18nProvider, useTranslation } from 'najm-i18n/react';
import type { Translations } from 'najm-i18n';

import { NBrandingProvider } from '../components/branding';
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

  branding?: NajmAppBranding;
}

const DEFAULT_LANGUAGE_ENDPOINT = '/api/ui-language';

type InnerProps = Omit<
  NajmAppProviderProps,
  'translations' | 'initialLanguage' | 'defaultLanguage' | 'languageEndpoint'
>;

/**
 * Reads the translator out of the `I18nProvider` this file just mounted.
 *
 * A component cannot consume a context it renders itself, so the read has to
 * happen one level down. Keeping that level *inside* the package is the whole
 * point: it is the boundary that used to force every application to author a
 * bridge component of its own.
 */
function NajmAppUI({ children, branding, ...props }: InnerProps) {
  const { t } = useTranslation();

  return (
    <NajmNextUIProvider t={t} {...props}>
      <NBrandingProvider
        appName={branding?.appName}
        logoExpanded={branding?.logoExpanded}
        logoCollapsed={branding?.logoCollapsed}
      >
        {children}
      </NBrandingProvider>
    </NajmNextUIProvider>
  );
}

function NajmAppNoI18n({ children, branding, ...props }: InnerProps) {
  return (
    <NajmNextUIProvider {...props}>
      <NBrandingProvider
        appName={branding?.appName}
        logoExpanded={branding?.logoExpanded}
        logoCollapsed={branding?.logoCollapsed}
      >
        {children}
      </NBrandingProvider>
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
 * Design is optional. Applications that resolve a design config at runtime — a
 * theme editor — compute it above and pass it down; everything else omits it.
 */
export function NajmAppProvider({
  translations,
  initialLanguage,
  defaultLanguage,
  languageEndpoint = DEFAULT_LANGUAGE_ENDPOINT,
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

  // Without a catalog there is nothing for `I18nProvider` to serve, and
  // mounting it empty would shadow one an application had already placed above.
  if (!translations) return <NajmAppNoI18n {...props} />;

  return (
    <I18nProvider
      translations={translations}
      initialLanguage={initialLanguage ?? defaultLanguage ?? 'en'}
      defaultLanguage={defaultLanguage}
      onLanguageChange={persistLanguage}
    >
      <NajmAppUI {...props} />
    </I18nProvider>
  );
}
