// ============================================================================
// Playground — najm-theme factory values
// ============================================================================
//
// This file, plus five lines in `plugins.ts` and one spread in `schema.ts`, is
// the whole integration. There is no appearance controller here, no branding
// service, no preset repository, no query keys, no upload cleanup — those live
// in the package, and a consumer that reimplements one of them has taken on a
// maintenance burden the package exists to carry.
//
// What *is* application-owned: the design this deployment ships with, the paths
// to its built brand assets, and who may change them.
// ============================================================================

import { defineNajmDesignConfig } from 'najm-kit/server';
import type { FactoryBranding } from 'najm-theme/contracts';

/**
 * The design served before anybody customizes anything, and the target of a
 * reset. Authored in TypeScript so a token typo is a build error rather than a
 * runtime fallback.
 */
export const factoryDesign = defineNajmDesignConfig({
  version: 1,
  theme: {
    preset: 'light',
    tokens: {
      primary: 'oklch(0.55 0.18 255)',
      'primary-foreground': 'oklch(0.99 0 0)',
      sidebar: 'oklch(0.98 0.005 255)',
    },
  },
  typography: {
    fontSans: 'Inter, system-ui, sans-serif',
  },
});

/**
 * Where the built-in marks live. Public paths the application already serves —
 * the package never deletes these, and never writes to them.
 */
export const factoryBranding = (): FactoryBranding => ({
  sidebarLogoExpanded: '/logo.svg',
  authHeroImage: null,
});
