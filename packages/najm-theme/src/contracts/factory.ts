// ============================================================================
// najm-theme/contracts — the factory theme convention
// ============================================================================
//
// One directory, one JSON file, four images, four fixed names.
//
// Everything in this module is a *name*, and every name here is owned by the
// package rather than configured by an application. That is the whole point of
// the convention: a consumer that cannot choose the file names also cannot get
// them subtly wrong, cannot drift from the next consumer, and cannot end up
// repeating them in a backend config, a React fallback map, and a reverse proxy
// rule that all have to agree.
//
// The filesystem half of the convention — reading, probing, hashing — lives in
// `najm-theme/theme`, which is the only place that touches `node:fs`. This
// module stays universal so the client entry can type a slot without importing
// a server module.
// ============================================================================

import type { NajmDesignConfig } from "najm-kit/server";

import type { FactoryBranding } from "./branding";
import type {
  ReactThemeBootstrap,
  ThemeBootstrapPolicy,
  ThemeBootstrapTransport,
} from "../server/reactBootstrap";

/**
 * The canonical directory layout.
 *
 * ```text
 * theme/
 * |-- index.ts
 * |-- theme.json
 * |-- sidebar-logo-expanded.(png|webp)
 * |-- sidebar-logo-collapsed.(png|webp)
 * |-- auth-logo.(png|webp)
 * `-- auth-hero.(png|webp)
 * ```
 */
export const FACTORY_THEME_FILE = "theme.json";

/**
 * Factory basename to package-owned slot. Permanent, and permanently four.
 *
 * A file name is what a designer hands to a developer, so it is spelled the way
 * a file is spelled; a slot key is what code reads, so it is spelled the way a
 * property is spelled. Mapping them here once is what keeps the two spellings
 * from becoming a per-consumer decision.
 */
export const FACTORY_BRANDING_FILES = Object.freeze({
  "sidebar-logo-expanded": "sidebarLogoExpanded",
  "sidebar-logo-collapsed": "sidebarLogoCollapsed",
  "auth-logo": "authLogo",
  "auth-hero": "authHeroImage",
} as const);

export type FactoryBrandingBasename = keyof typeof FACTORY_BRANDING_FILES;

/** The four slots every factory directory fills. */
export type StandardBrandingSlotKey =
  (typeof FACTORY_BRANDING_FILES)[FactoryBrandingBasename];

export const FACTORY_BRANDING_BASENAMES = Object.freeze(
  Object.keys(FACTORY_BRANDING_FILES) as FactoryBrandingBasename[],
);

export const STANDARD_BRANDING_SLOT_KEYS = Object.freeze(
  Object.values(FACTORY_BRANDING_FILES) as StandardBrandingSlotKey[],
);

/**
 * PNG and WebP, and nothing else.
 *
 * JPEG is accepted for *uploads* — an administrator replacing a hero with a
 * photograph is the normal case — but a factory asset is a build artifact an
 * engineer commits, and for a logo committed to a repository the choice is
 * between a lossless raster and a lossy one. SVG is absent for the reason given
 * in `contracts/branding.ts`: it is a document, not an image.
 */
export const FACTORY_ASSET_EXTENSIONS = Object.freeze(["png", "webp"] as const);

export type FactoryAssetExtension = (typeof FACTORY_ASSET_EXTENSIONS)[number];

export const FACTORY_ASSET_MIME_TYPES: Readonly<Record<FactoryAssetExtension, string>> =
  Object.freeze({
    png: "image/png",
    webp: "image/webp",
  });

/** Appended after `/branding`, so factory files never collide with managed ones. */
export const FACTORY_ASSET_ROUTE_SEGMENT = "factory";

/**
 * `<slot>.<content hash>.<ext>` — e.g. `authLogo.3f9c1a2b4d5e6f70.webp`.
 *
 * The hash is what makes a one-year immutable cache header honest for a file
 * the application ships in its build: a deploy that changes the logo changes the
 * URL, so nothing between the server and the browser has to expire for the new
 * mark to appear. Without it the only safe policy would be revalidation on every
 * page load of every logo.
 */
export const FACTORY_ASSET_HASH_LENGTH = 16;

const FACTORY_ASSET_FILE_NAME_PATTERN =
  /^([a-zA-Z][a-zA-Z0-9]{0,47})\.([0-9a-f]{16})\.(png|webp)$/;

// ---------------------------------------------------------------------------
// The definition contract
// ---------------------------------------------------------------------------

/**
 * Registry symbol, not a class and not a module-local one.
 *
 * `najm-theme/theme` and `najm-theme/server` are separate bundles, so a
 * definition created through one and handed to the other was created by a
 * different copy of the loader. A `Symbol.for` key is the same value in both;
 * an `instanceof` or a `WeakSet` would not be — the same reasoning that makes
 * peer services resolve by symbol in `server/peers.ts`.
 */
export const THEME_DEFINITION_BRAND: symbol = Symbol.for("najm:theme:definition");

export interface FactoryThemeAsset {
  /** The package-owned slot this file fills. */
  readonly slot: StandardBrandingSlotKey;
  /** The consumer-owned file name, without extension. */
  readonly basename: FactoryBrandingBasename;
  readonly extension: FactoryAssetExtension;
  readonly mimeType: string;
  readonly bytes: number;
  /** First 16 hex characters of the file's SHA-256, used for cache busting. */
  readonly contentHash: string;
  /** `<slot>.<hash>.<ext>`, the only name the serving route answers to. */
  readonly fileName: string;
  /** The absolute source path, for error messages and packaging checks. */
  readonly sourcePath: string;
}

export interface FactoryAssetResponseOptions {
  /** `Cache-Control: max-age`. Defaults to one year. */
  cacheMaxAge?: number;
}

/**
 * One application's factory theme, loaded and validated once.
 *
 * Declared here rather than beside the loader so that the plugin, the RSC
 * adapter, and the loader all name one type without any of them importing
 * `node:fs`. `defineTheme()` in `najm-theme/theme` is the only implementation.
 */
export interface NajmThemeDefinition {
  /** The absolute directory the definition was resolved from. */
  readonly dir: string;
  /** The four validated factory assets, in slot order. */
  readonly assets: readonly FactoryThemeAsset[];
  /**
   * The design served when nothing is stored, and the target of a reset.
   *
   * A fresh clone per call. The plugin hands this straight to a response body
   * and the RSC fallback hands it to a React tree, and neither should be able to
   * edit the build's design for the next request.
   */
  appearance(): NajmDesignConfig;
  /**
   * Factory asset paths keyed by slot, as the browser will request them.
   *
   * @param mountPrefix Where the theme plugin is mounted, as the browser sees
   *   it — the server base plus the plugin's `basePath`. Defaults to
   *   `/api/theme`, which is what the standard mount produces.
   */
  branding(mountPrefix?: string): FactoryBranding;
  /** The asset for a slot, or `undefined` for a key that is not one of the four. */
  asset(slot: string): FactoryThemeAsset | undefined;
  /**
   * Serves a factory asset by its hashed file name, or `null` when the name is
   * unknown. Never touches the filesystem: the bytes were read at definition
   * time, so there is no path to traverse.
   */
  serveAsset(fileName: unknown, options?: FactoryAssetResponseOptions): Response | null;
  /**
   * The React server bootstrap for this definition — the same factory values,
   * no repeated callbacks, and the canonical route default.
   *
   * Call it **once, at module scope**, in the module every layout imports.
   */
  react(config: ThemeBootstrapPolicy & ThemeBootstrapTransport): ReactThemeBootstrap;
}

/** True for a definition produced by any copy of `defineTheme`. */
export function isNajmThemeDefinition(value: unknown): value is NajmThemeDefinition {
  return (
    typeof value === "object"
    && value !== null
    && (value as Record<symbol, unknown>)[THEME_DEFINITION_BRAND] === true
  );
}

/**
 * Drops declared `fallback` inheritance from a slot registry.
 *
 * The standard slots let a collapsed mark inherit the expanded one, which was
 * the right answer when a consumer supplied whichever factory paths it happened
 * to have. A factory theme directory supplies all four, so inheritance would
 * only ever fire for a *managed* upload — silently replacing the sign-in logo
 * because somebody changed the sidebar. Under the convention each slot resolves
 * to its own managed asset or its own factory file, and nothing else.
 */
export function withoutSlotInheritance<T extends { fallback?: unknown }>(
  slots: readonly T[],
): readonly T[] {
  return slots.map((slot) => {
    if (slot.fallback === undefined) return slot;
    const { fallback: _dropped, ...rest } = slot;
    return Object.freeze(rest) as T;
  });
}

export function factoryAssetFileName(
  slot: string,
  contentHash: string,
  extension: FactoryAssetExtension,
): string {
  return `${slot}.${contentHash}.${extension}`;
}

export interface ParsedFactoryAssetFileName {
  slot: string;
  contentHash: string;
  extension: FactoryAssetExtension;
}

/**
 * Narrows a route parameter before it is used for anything.
 *
 * Serving never joins this onto a path — the bytes were read at startup and are
 * held in memory — so this is not the traversal defence. It is the cheap reject
 * that keeps an unknown name from reaching a map lookup, and it keeps the 404
 * for `../../etc/passwd` indistinguishable from the 404 for a stale hash.
 */
export function parseFactoryAssetFileName(
  value: unknown,
): ParsedFactoryAssetFileName | null {
  if (typeof value !== "string") return null;
  const match = FACTORY_ASSET_FILE_NAME_PATTERN.exec(value);
  if (!match) return null;

  return {
    slot: match[1],
    contentHash: match[2],
    extension: match[3] as FactoryAssetExtension,
  };
}
