import 'server-only';

import { parseNajmDesignConfig, type NajmDesignConfig } from 'najm-kit/server';
import { createReactServerUiBootstrap } from 'najm-kit/server/react';

import { fixtureFetch, recordDiagnostic } from './uiBackend';

export interface Appearance {
  designConfig: NajmDesignConfig;
  revision: number;
}

export interface Branding {
  sidebarLogoExpandedPath: string;
  revision: number;
}

export const FACTORY_APPEARANCE: Appearance = {
  designConfig: { version: 1, theme: { preset: 'light' } },
  revision: 0,
};
export const FACTORY_BRANDING: Branding = {
  sidebarLogoExpandedPath: '/factory-logo.svg',
  revision: 0,
};

const positiveRevision = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

/**
 * The application's one module-level bootstrap.
 *
 * Created here and nowhere else: calling the factory inside a layout would
 * build a fresh memoization entry per render and share nothing, which is
 * exactly what this fixture measures.
 */
export const serverUi = createReactServerUiBootstrap({
  fetcher: fixtureFetch,
  resources: {
    appearance: {
      path: '/api/appearance',
      parse: (input): Appearance | undefined => {
        if (!input || typeof input !== 'object') return undefined;
        const value = input as Record<string, unknown>;
        if (!positiveRevision(value.revision)) return undefined;
        return {
          designConfig: parseNajmDesignConfig(value.designConfig),
          revision: value.revision,
        };
      },
      fallback: (): Appearance => structuredClone(FACTORY_APPEARANCE),
    },
    branding: {
      path: '/api/branding',
      parse: (input): Branding | undefined => {
        if (!input || typeof input !== 'object') return undefined;
        const value = input as Record<string, unknown>;
        if (!positiveRevision(value.revision)) return undefined;
        if (typeof value.sidebarLogoExpandedPath !== 'string') return undefined;
        return {
          sidebarLogoExpandedPath: value.sidebarLogoExpandedPath,
          revision: value.revision,
        };
      },
      fallback: (): Branding => structuredClone(FACTORY_BRANDING),
    },
  },
  onDiagnostic: (diagnostic) => {
    recordDiagnostic(`${diagnostic.resource}:${diagnostic.reason}:${diagnostic.status ?? ''}`);
  },
});

export const loadServerUiBootstrap = serverUi.load;
export const { appearance: loadServerAppearance, branding: loadServerBranding } = serverUi.loaders;
