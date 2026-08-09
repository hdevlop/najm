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
// @example
// ```ts
// // src/lib/serverTheme.ts
// import "server-only";
//
// import { createReactThemeBootstrap } from "najm-theme/server/react";
//
// const serverTheme = createReactThemeBootstrap({
//   fetcher: (path) => server.fetch(new Request(`http://internal${path}`)),
//   basePath: "/api/theme",
//   factory: { appearance: () => factoryDesign, branding: () => factoryBranding },
//   onDiagnostic: reportThemeDiagnostic,
// });
//
// export const loadServerTheme = serverTheme.load;
// export const loadServerAppearance = serverTheme.loadAppearance;
// export const loadServerBranding = serverTheme.loadBranding;
// ```
//
// Call the factory **once, at module scope**, in a module the whole app
// imports. Calling it inside a layout, a page, or a component builds a fresh
// memoization entry per call and shares nothing — which looks like it works and
// quietly costs one round trip per component.
//
// That small module is the one file this package cannot delete for a consumer,
// and it is deliberate: the fetcher, the factory values, and the diagnostic
// sink are all application-owned, so a package-level singleton would have to
// invent all three. What it *does* delete is everything that used to sit around
// it — the fetch, the envelope unwrap, the validation, the fallback, the
// per-resource independence.
//
// React Server Components only. Route handlers, server actions, and scripts
// have no request cache for `cache()` to write into, so this would silently
// re-fetch per call there; they should call the endpoints directly.
// ============================================================================

import { createReactServerUiBootstrap } from "najm-kit/server/react";
import type { NajmDesignConfig } from "najm-kit/server";

import { parsePublicAppearance, type PublicAppearance } from "../contracts/appearance";
import { parsePublicBranding, type PublicBranding } from "../contracts/branding";
import type { FactoryBranding } from "../contracts/branding";
import { INITIAL_THEME_REVISION } from "../contracts/revisions";

export type ThemeBootstrapFetcher = (path: string) => Promise<Response>;

export interface ReactThemeBootstrapConfig {
  /** Reaches the application's own backend. The path is absolute and resource-relative. */
  fetcher: ThemeBootstrapFetcher;
  /**
   * Where the theme routes are mounted *as the browser and this fetcher see
   * them* — usually the plugin's `basePath` behind the server's own base, e.g.
   * `/api/theme`. Defaults to `/api/theme`.
   */
  basePath?: string;
  factory: {
    appearance: () => NajmDesignConfig;
    branding: () => FactoryBranding;
  };
  /**
   * Called once per fallback, never for a successful load.
   *
   * The diagnostic is the kit's shape — resource, reason, path, status — and
   * carries no response body, header, or cookie by construction.
   */
  onDiagnostic?: Parameters<typeof createReactServerUiBootstrap>[0]["onDiagnostic"];
  /** Overrides the `{ data }` envelope for an application behind a different one. */
  select?: (payload: unknown) => unknown;
}

export interface ReactThemeBootstrap {
  /** Appearance and branding for this request, resolved once and shared. */
  load(): Promise<{ appearance: PublicAppearance; branding: PublicBranding }>;
  /** Appearance alone, read off the same shared resolution. */
  loadAppearance(): Promise<PublicAppearance>;
  /** Branding alone, read off the same shared resolution. */
  loadBranding(): Promise<PublicBranding>;
}

/**
 * Appearance and branding fall back **independently**.
 *
 * A branding outage must not discard a perfectly good theme, and vice versa.
 * The kit resolves each resource on its own and only shares the *render*, which
 * is what makes that true without any coordination here.
 */
export function createReactThemeBootstrap(
  config: ReactThemeBootstrapConfig,
): ReactThemeBootstrap {
  const basePath = (config.basePath ?? "/api/theme").replace(/\/+$/, "");

  const bootstrap = createReactServerUiBootstrap({
    fetcher: config.fetcher,
    onDiagnostic: config.onDiagnostic,
    select: config.select,
    resources: {
      appearance: {
        path: `${basePath}/appearance`,
        parse: parsePublicAppearance,
        // Revision `1` is the same value the endpoint reports for a scope that
        // has never been saved, so a client seeded from a fallback and one
        // seeded from an untouched database behave identically — including
        // getting a clean conflict if it tries to save against a scope that has
        // moved on.
        fallback: (): PublicAppearance => ({
          designConfig: config.factory.appearance(),
          revision: INITIAL_THEME_REVISION,
        }),
      },
      branding: {
        path: `${basePath}/branding`,
        parse: parsePublicBranding,
        fallback: (): PublicBranding => {
          const factory = config.factory.branding();
          const slots: Record<string, string | null> = {};
          for (const [key, value] of Object.entries(factory)) {
            slots[key] = typeof value === "string" && value.length > 0 ? value : null;
          }
          return { slots, revision: INITIAL_THEME_REVISION };
        },
      },
    },
  });

  return {
    load: bootstrap.load,
    loadAppearance: bootstrap.loaders.appearance,
    loadBranding: bootstrap.loaders.branding,
  };
}

export type { PublicAppearance, PublicBranding };
