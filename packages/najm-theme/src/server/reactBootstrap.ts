// ============================================================================
// najm-theme/server — the RSC bootstrap, without the React import
// ============================================================================
//
// Everything `najm-theme/server/react` does *except* reaching `najm-kit`'s
// React server entry: the path rules, the default diagnostic, the fetcher
// resolution, and the two resource descriptions.
//
// Split out for one reason. A theme definition exposes `.react()`, and a
// definition is created in `theme/index.ts` — a file the backend imports at
// boot. If the code that builds the bootstrap imported `najm-kit/server/react`
// at module scope, every Najm backend would load React to register a plugin,
// and a backend without React installed would fail at boot instead of failing
// where React is actually needed.
//
// So the kit's factory arrives as an argument: `najm-theme/server/react` passes
// the one it imported statically, and `definition.react()` passes the one it
// imported dynamically. One implementation, two module graphs.
// ============================================================================

import type { NajmDesignConfig, UiBootstrapDiagnostic } from "najm-kit/server";

import { parsePublicAppearance, type PublicAppearance } from "../contracts/appearance";
import { parsePublicBranding, type PublicBranding } from "../contracts/branding";
import type { FactoryBranding } from "../contracts/branding";
import { INITIAL_THEME_REVISION } from "../contracts/revisions";

/** The kit factory, as a value this module receives rather than imports. */
export type CreateReactServerUiBootstrap =
  typeof import("najm-kit/server/react").createReactServerUiBootstrap;

export type ThemeBootstrapFetcher = (path: string) => Promise<Response>;

export interface ThemeBootstrapServer {
  fetch(request: Request): Response | Promise<Response>;
}

export type ThemeBootstrapServerLoader = () =>
  | ThemeBootstrapServer
  | Promise<ThemeBootstrapServer>;

/**
 * The mount every Najm application produces by default: the plugin's `/theme`
 * behind the server's `/api` base.
 */
export const DEFAULT_THEME_BOOTSTRAP_BASE_PATH = "/api/theme";

export function normalizeThemeBootstrapBasePath(value: string | undefined): string {
  const basePath = (value ?? DEFAULT_THEME_BOOTSTRAP_BASE_PATH).replace(/\/+$/, "");

  if (
    !basePath.startsWith("/")
    || basePath.includes("?")
    || basePath.includes("#")
    || basePath.includes("//")
    || basePath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError(
      `theme bootstrap basePath must be an absolute path prefix such as "/api/theme" (received ${JSON.stringify(value)})`,
    );
  }

  return basePath;
}

export function reportThemeBootstrapDiagnostic(diagnostic: UiBootstrapDiagnostic): void {
  const status = diagnostic.status ? `, status ${diagnostic.status}` : "";
  const fallback = diagnostic.resource === "appearance" ? "factory theme" : "factory assets";

  // Custom sinks still receive the normalized error summary. The default log
  // deliberately keeps the narrowest surface and never includes it.
  console.warn(
    `[najm-theme] ${diagnostic.resource} bootstrap failed (${diagnostic.reason}${status}, path ${diagnostic.path}); using ${fallback}`,
  );
}

export interface ThemeBootstrapPolicy {
  /**
   * Where the theme routes are mounted *as the browser and this fetcher see
   * them* — the plugin's `basePath` behind the server's own base. Defaults to
   * `/api/theme`, which is what the standard mount produces; override it only
   * for a legacy or intentionally different mount.
   */
  basePath?: string;
  /**
   * Called once per fallback, never for a successful load. Defaults to a
   * package-owned sanitized `console.warn`; pass `false` to silence it.
   *
   * The diagnostic is the kit's shape — resource, reason, path, status — and
   * carries no response body, header, or cookie by construction.
   */
  onDiagnostic?: false | UiBootstrapConfigDiagnostic;
  /** Overrides the `{ data }` envelope for an application behind a different one. */
  select?: (payload: unknown) => unknown;
}

type UiBootstrapConfigDiagnostic = (diagnostic: UiBootstrapDiagnostic) => void;

export type ThemeBootstrapTransport =
  | {
      /** Reaches a custom or remote backend. Mutually exclusive with `getServer`. */
      fetcher: ThemeBootstrapFetcher;
      getServer?: never;
    }
  | {
      /**
       * Lazily resolves this application's Fetch-compatible server. The package
       * builds the internal absolute Request for each theme path.
       */
      getServer: ThemeBootstrapServerLoader;
      fetcher?: never;
    };

export function resolveThemeBootstrapFetcher(
  transport: ThemeBootstrapTransport,
): ThemeBootstrapFetcher {
  const hasFetcher = typeof transport.fetcher === "function";
  const hasServerLoader = typeof transport.getServer === "function";

  if (hasFetcher === hasServerLoader) {
    throw new TypeError(
      "the theme RSC bootstrap requires exactly one of fetcher or getServer",
    );
  }

  if (transport.fetcher) return transport.fetcher;
  const getServer = transport.getServer!;

  return async (path) => {
    const server = await getServer();
    if (!server || typeof server.fetch !== "function") {
      throw new TypeError("theme bootstrap getServer must resolve a Fetch-compatible server");
    }
    return server.fetch(new Request(`http://najm.internal${path}`));
  };
}

export interface PublicBrandingWithFactory extends PublicBranding {
  /**
   * Slot key to the factory URL the package would serve for the slot.
   *
   * Attached to every `loadBranding` return so the React tree has a managed →
   * factory chain on the client without the consumer building the factory URL
   * map itself. The REST endpoint does not include this — it does not have a
   * definition — so the chain still degrades to a missing-mark rather than a
   * wrong one when the bootstrap is bypassed.
   */
  factory: Record<string, string | null>;
}

export interface ReactThemeBootstrap {
  /** Appearance and branding for this request, resolved once and shared. */
  load(): Promise<{ appearance: PublicAppearance; branding: PublicBrandingWithFactory }>;
  /** Appearance alone, read off the same shared resolution. */
  loadAppearance(): Promise<PublicAppearance>;
  /** Branding alone, with the factory fallback attached. */
  loadBranding(): Promise<PublicBrandingWithFactory>;
}

export interface ThemeBootstrapFactoryValues {
  appearance: () => NajmDesignConfig;
  /** Keyed by slot, already resolved to the paths the browser will request. */
  branding: () => FactoryBranding;
}

export interface BuildThemeBootstrapOptions extends ThemeBootstrapPolicy {
  transport: ThemeBootstrapTransport;
  factory: ThemeBootstrapFactoryValues;
}

/**
 * Appearance and branding fall back **independently**.
 *
 * A branding outage must not discard a perfectly good theme, and vice versa.
 * The kit resolves each resource on its own and only shares the *render*, which
 * is what makes that true without any coordination here.
 */
export function buildThemeBootstrap(
  create: CreateReactServerUiBootstrap,
  options: BuildThemeBootstrapOptions,
): ReactThemeBootstrap {
  const basePath = normalizeThemeBootstrapBasePath(options.basePath);
  const fetcher = resolveThemeBootstrapFetcher(options.transport);
  const onDiagnostic =
    options.onDiagnostic === false
      ? undefined
      : (options.onDiagnostic ?? reportThemeBootstrapDiagnostic);

  const bootstrap = create({
    fetcher,
    onDiagnostic,
    select: options.select,
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
          designConfig: options.factory.appearance(),
          revision: INITIAL_THEME_REVISION,
        }),
      },
      branding: {
        path: `${basePath}/branding`,
        parse: parsePublicBranding,
        fallback: (): PublicBranding => {
          const factory = options.factory.branding();
          const slots: Record<string, string | null> = {};
          for (const [key, value] of Object.entries(factory)) {
            slots[key] = typeof value === "string" && value.length > 0 ? value : null;
          }
          return { slots, revision: INITIAL_THEME_REVISION };
        },
      },
    },
  });

  // The factory map the bootstrap will attach to every branding it returns.
  // Computed once because the four factory URLs do not change between reads,
  // and the route suffix comes from the same `basePath` the fetcher will hit.
  const factoryMap = (): Record<string, string | null> => {
    const factory = options.factory.branding();
    const map: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(factory)) {
      map[key] = typeof value === "string" && value.length > 0 ? value : null;
    }
    return map;
  };

  const enrichBranding = (
    branding: PublicBranding | undefined,
  ): PublicBrandingWithFactory => ({
    slots: branding?.slots ?? factoryMap(),
    factory: factoryMap(),
    revision: branding?.revision ?? INITIAL_THEME_REVISION,
  });

  return {
    load: async () => {
      const result = await bootstrap.load();
      return {
        appearance: result.appearance,
        branding: enrichBranding(result.branding),
      };
    },
    loadAppearance: bootstrap.loaders.appearance,
    loadBranding: async () => enrichBranding(await bootstrap.loaders.branding()),
  };
}

/**
 * A bootstrap whose kit factory is not imported yet.
 *
 * `definition.react()` is called at module scope in a file the backend may also
 * load, so the kit's React entry is imported on first use instead. The promise
 * is created once, which is what keeps `cache()` to a single memoization entry
 * for the process — the property the whole bootstrap depends on.
 */
export function lazyThemeBootstrap(
  load: () => Promise<CreateReactServerUiBootstrap>,
  options: BuildThemeBootstrapOptions,
): ReactThemeBootstrap {
  // Run now, discard the results, and let `buildThemeBootstrap` run them again
  // for real. A malformed `basePath` or a missing transport is a configuration
  // mistake, and this package's rule is that those fail where they are written
  // rather than on the first render that happens to need them.
  normalizeThemeBootstrapBasePath(options.basePath);
  resolveThemeBootstrapFetcher(options.transport);

  let pending: Promise<ReactThemeBootstrap> | null = null;

  const ensure = () => (pending ??= load().then((create) => buildThemeBootstrap(create, options)));

  return {
    load: async () => (await ensure()).load(),
    loadAppearance: async () => (await ensure()).loadAppearance(),
    loadBranding: async () => (await ensure()).loadBranding(),
  };
}
