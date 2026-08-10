// ============================================================================
// najm-theme/server/react — one theme snapshot per React server request
// ============================================================================
//
// A configuration of `najm-kit/server/react`, not a second implementation of
// it. The kit already solved the hard part — collapsing every layout's and
// page's read into one request-scoped resolution through React's `cache()` —
// and re-solving it here would give an application two caches that disagree.
//
// What this adds is the part the kit cannot know: which paths a themed
// application serves, what a valid appearance or branding payload looks like,
// and how each falls back. Those are this package's contract, so an application
// stops writing the parse-and-fall-back module it used to own.
//
// The normal way in is the definition itself:
//
// ```ts
// // src/lib/serverTheme.ts
// import "server-only";
//
// import { appTheme } from "../../theme";
//
// const serverTheme = appTheme.react({
//   getServer: async () => (await import("@app/server")).server,
// });
//
// export const loadServerTheme = serverTheme.load;
// export const loadServerAppearance = serverTheme.loadAppearance;
// export const loadServerBranding = serverTheme.loadBranding;
// ```
//
// `createReactThemeBootstrap` below is the same thing without the definition —
// for a frontend that reaches a *remote* theme backend and therefore has no
// factory directory of its own to read.
//
// Call either **once, at module scope**, in a module the whole app imports.
// Calling it inside a layout, a page, or a component builds a fresh memoization
// entry per call and shares nothing — which looks like it works and quietly
// costs one round trip per component.
//
// That small module is the one file this package cannot delete for a consumer,
// and it is deliberate: the lazy server binding and the memoized instance are
// application-owned, so a package-level singleton would have to invent both.
// What it *does* delete is everything that used to sit around it — the fetch,
// the envelope unwrap, the validation, the factory callbacks, the fallback map,
// the per-resource independence.
//
// React Server Components only. Route handlers, server actions, and scripts
// have no request cache for `cache()` to write into, so this would silently
// re-fetch per call there; they should call the endpoints directly.
// ============================================================================

import { createReactServerUiBootstrap } from "najm-kit/server/react";
import type { NajmDesignConfig } from "najm-kit/server";

import type { PublicAppearance } from "../contracts/appearance";
import type { FactoryBranding, PublicBranding } from "../contracts/branding";
import { isNajmThemeDefinition, type NajmThemeDefinition } from "../contracts/factory";
import {
  buildThemeBootstrap,
  type ReactThemeBootstrap,
  type ThemeBootstrapPolicy,
  type ThemeBootstrapTransport,
} from "./reactBootstrap";

export type {
  ReactThemeBootstrap,
  ThemeBootstrapFetcher,
  ThemeBootstrapServer,
  ThemeBootstrapServerLoader,
  PublicBrandingWithFactory,
} from "./reactBootstrap";

export interface ReactThemeBootstrapFactoryValues {
  appearance: () => NajmDesignConfig;
  branding: () => FactoryBranding;
}

export type ReactThemeBootstrapConfig = ThemeBootstrapPolicy
  & ThemeBootstrapTransport
  & {
    /**
     * Factory values for a frontend with no factory directory to read.
     *
     * An application that has one passes the definition instead — as the first
     * argument here, or through `appTheme.react()` — and the package derives
     * both the design and the four asset URLs from it.
     */
    factory: ReactThemeBootstrapFactoryValues;
  };

export type ReactThemeBootstrapDefinitionConfig = ThemeBootstrapPolicy & ThemeBootstrapTransport;

/**
 * Appearance and branding fall back **independently**.
 *
 * A branding outage must not discard a perfectly good theme, and vice versa.
 * The kit resolves each resource on its own and only shares the *render*, which
 * is what makes that true without any coordination here.
 */
export function createReactThemeBootstrap(
  definition: NajmThemeDefinition,
  config: ReactThemeBootstrapDefinitionConfig,
): ReactThemeBootstrap;
export function createReactThemeBootstrap(
  config: ReactThemeBootstrapConfig,
): ReactThemeBootstrap;
export function createReactThemeBootstrap(
  definitionOrConfig: NajmThemeDefinition | ReactThemeBootstrapConfig,
  maybeConfig?: ReactThemeBootstrapDefinitionConfig,
): ReactThemeBootstrap {
  if (isNajmThemeDefinition(definitionOrConfig)) {
    const config = maybeConfig ?? ({} as ReactThemeBootstrapDefinitionConfig);
    return buildThemeBootstrap(createReactServerUiBootstrap, {
      basePath: config.basePath,
      onDiagnostic: config.onDiagnostic,
      select: config.select,
      transport: config as ThemeBootstrapTransport,
      factory: {
        appearance: () => definitionOrConfig.appearance(),
        branding: () => definitionOrConfig.branding(config.basePath),
      },
    });
  }

  const config = definitionOrConfig;
  if (!config?.factory || typeof config.factory.appearance !== "function") {
    throw new TypeError(
      "createReactThemeBootstrap needs a defineTheme() definition, or factory.appearance and factory.branding for a remote theme backend",
    );
  }

  return buildThemeBootstrap(createReactServerUiBootstrap, {
    basePath: config.basePath,
    onDiagnostic: config.onDiagnostic,
    select: config.select,
    transport: config as ThemeBootstrapTransport,
    factory: config.factory,
  });
}

export type { PublicAppearance, PublicBranding };
