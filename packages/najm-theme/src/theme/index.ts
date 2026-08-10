// ============================================================================
// najm-theme/theme — the factory theme definition
// ============================================================================
//
// One call, one directory, one validated definition:
//
// ```ts
// // theme/index.ts
// import { defineTheme } from "najm-theme/theme";
//
// export const appTheme = defineTheme(import.meta.url);
// ```
//
// What that replaces is the reason this module exists. Before it, an
// application supplied a design callback to the plugin, a *second* design
// callback to the RSC bootstrap, four asset paths it had to serve itself, and a
// fallback map in the React tree — five places that had to agree about names the
// package already owns, in two processes, with no check that they did.
//
// Three properties are load-bearing:
//
// - **Module-relative, never `process.cwd()`.** The working directory differs
//   between a root script, a workspace script, a test runner, and a container
//   entrypoint, so a design discovered relative to it is a design that resolves
//   differently in each. `import.meta.url` is a property of the file that asked.
// - **Read once, eagerly.** Every byte is loaded and validated while the
//   consumer's module initializes, so a missing logo is a boot failure with a
//   file name in it rather than a broken image three screens into the product.
//   It also means serving a factory asset touches no filesystem at all, which is
//   what makes the route traversal-proof by construction rather than by check.
// - **Immutable.** The parsed design is cloned per read, so a caller that
//   mutates what it was handed cannot change what the next request is served.
//
// This entry is deliberately light: contracts, `node:fs`, and the package's own
// image probe. No controller, no Drizzle, no decorator, no React. That is what
// lets the consumer's `theme/index.ts` be imported by a React Server Component
// and by the backend without dragging one into the other.
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NajmDesignConfig } from "najm-kit/server";

import {
  parseSafeDesignConfig,
  resolveAppearanceLimits,
  type ThemeAppearanceLimits,
} from "../contracts/appearance";
import {
  MAX_BRANDING_SLOT_BYTES,
  STANDARD_BRANDING_SLOTS,
  type FactoryBranding,
} from "../contracts/branding";
import {
  FACTORY_ASSET_EXTENSIONS,
  FACTORY_ASSET_HASH_LENGTH,
  FACTORY_ASSET_MIME_TYPES,
  FACTORY_ASSET_ROUTE_SEGMENT,
  FACTORY_BRANDING_FILES,
  FACTORY_THEME_FILE,
  THEME_DEFINITION_BRAND,
  factoryAssetFileName,
  parseFactoryAssetFileName,
  type FactoryAssetExtension,
  type FactoryAssetResponseOptions,
  type FactoryBrandingBasename,
  type FactoryThemeAsset,
  type NajmThemeDefinition,
  type StandardBrandingSlotKey,
} from "../contracts/factory";
import { probeImage } from "../server/branding/imageProbe";
import {
  DEFAULT_THEME_BOOTSTRAP_BASE_PATH,
  lazyThemeBootstrap,
  type ThemeBootstrapTransport,
} from "../server/reactBootstrap";

export {
  isNajmThemeDefinition,
  type FactoryThemeAsset,
  type NajmThemeDefinition,
} from "../contracts/factory";

export interface DefineThemeLimits {
  /** Ceiling for the three logo assets. Defaults to the standard slot ceiling. */
  logoBytes?: number;
  /** Ceiling for the hero asset. Defaults to the standard slot ceiling. */
  heroBytes?: number;
  /** Passed to the appearance parser when validating `theme.json`. */
  appearance?: Partial<ThemeAppearanceLimits>;
}

export interface DefineThemeOptions {
  limits?: DefineThemeLimits;
}

const SLOT_MAX_BYTES = new Map(
  STANDARD_BRANDING_SLOTS.map((slot) => [slot.key, slot.maxBytes]),
);

function ceilingFor(slot: StandardBrandingSlotKey, limits: DefineThemeLimits | undefined): number {
  const configured = slot === "authHeroImage" ? limits?.heroBytes : limits?.logoBytes;
  const ceiling = configured ?? SLOT_MAX_BYTES.get(slot) ?? MAX_BRANDING_SLOT_BYTES;

  if (!Number.isSafeInteger(ceiling) || ceiling < 1 || ceiling > MAX_BRANDING_SLOT_BYTES) {
    throw new TypeError(
      `defineTheme limits for ${slot} must be a positive integer no greater than ${MAX_BRANDING_SLOT_BYTES}`,
    );
  }
  return ceiling;
}

/**
 * Accepts what `import.meta.url` produces, and also a plain directory path.
 *
 * A module URL names a *file*, so its directory is the factory directory. A
 * path is taken as the directory itself, which is what a test fixture or a
 * packaging check has.
 */
function resolveFactoryDir(source: string | URL): string {
  const value = typeof source === "string" ? source : source.href;

  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(
      "defineTheme(import.meta.url) requires the calling module's URL or a directory path",
    );
  }

  if (value.startsWith("file:")) {
    const filePath = fileURLToPath(value);
    return isDirectory(filePath) ? filePath : dirnameOf(filePath);
  }

  // A bare path. `import.meta.url` is always a URL, so this is the fixture and
  // packaging form rather than something a consumer is expected to write.
  return isDirectory(value) ? value : dirnameOf(value);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function dirnameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? normalized : filePath.slice(0, index);
}

function readIfPresent(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

function loadAppearance(
  dir: string,
  limits: Partial<ThemeAppearanceLimits> | undefined,
): NajmDesignConfig {
  const path = join(dir, FACTORY_THEME_FILE);
  const raw = readIfPresent(path);

  if (!raw) {
    throw new TypeError(
      `[najm-theme] ${FACTORY_THEME_FILE} is missing from the factory theme directory ${dir}. `
        + `Add ${FACTORY_THEME_FILE} next to the module that calls defineTheme(import.meta.url).`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new TypeError(
      `[najm-theme] ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    // The same ceilings a *stored* design is held to, so a factory theme cannot
    // be one the appearance editor would refuse to save back.
    return parseSafeDesignConfig(parsed, limits ? resolveAppearanceLimits(limits) : undefined);
  } catch (error) {
    throw new TypeError(
      `[najm-theme] ${path} is not a valid Najm design: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function loadAsset(
  dir: string,
  basename: FactoryBrandingBasename,
  slot: StandardBrandingSlotKey,
  limits: DefineThemeLimits | undefined,
): { asset: FactoryThemeAsset; bytes: Buffer } {
  const found: { extension: FactoryAssetExtension; path: string; bytes: Buffer }[] = [];

  for (const extension of FACTORY_ASSET_EXTENSIONS) {
    const path = join(dir, `${basename}.${extension}`);
    const bytes = readIfPresent(path);
    if (bytes) found.push({ extension, path, bytes });
  }

  if (found.length === 0) {
    throw new TypeError(
      `[najm-theme] the factory theme directory ${dir} is missing ${basename}.png or ${basename}.webp. `
        + `All four factory assets are required: ${Object.keys(FACTORY_BRANDING_FILES).join(", ")}.`,
    );
  }
  if (found.length > 1) {
    throw new TypeError(
      `[najm-theme] the factory theme directory ${dir} contains both ${basename}.png and ${basename}.webp. `
        + "Exactly one file per branding name — two would make the served asset depend on directory order.",
    );
  }

  const [{ extension, path, bytes }] = found;
  const expectedMime = FACTORY_ASSET_MIME_TYPES[extension];

  const probed = probeImage(bytes);
  if (!probed) {
    throw new TypeError(
      `[najm-theme] ${path} is not a readable PNG or WebP image.`,
    );
  }
  // The extension is a claim by whoever named the file; the header is not. A
  // WebP renamed to `.png` would otherwise be served as `image/png`, and the
  // browsers that sniff past that are exactly the ones that should not have to.
  if (probed.mimeType !== expectedMime) {
    throw new TypeError(
      `[najm-theme] ${path} is a ${probed.mimeType} file with a .${extension} name. `
        + "Rename it to match its real format, or re-encode it.",
    );
  }

  const ceiling = ceilingFor(slot, limits);
  if (bytes.byteLength > ceiling) {
    throw new TypeError(
      `[najm-theme] ${path} is ${bytes.byteLength} bytes; ${slot} accepts at most ${ceiling}.`,
    );
  }

  const contentHash = createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, FACTORY_ASSET_HASH_LENGTH);

  return {
    asset: Object.freeze({
      slot,
      basename,
      extension,
      mimeType: expectedMime,
      bytes: bytes.byteLength,
      contentHash,
      fileName: factoryAssetFileName(slot, contentHash, extension),
      sourcePath: path,
    }),
    bytes,
  };
}

function normalizeMountPrefix(value: string | undefined): string {
  const prefix = (value ?? DEFAULT_THEME_BOOTSTRAP_BASE_PATH).replace(/\/+$/, "");
  if (prefix === "") return "";

  if (!prefix.startsWith("/") || prefix.includes("//") || prefix.includes("\\")) {
    throw new TypeError(
      `theme mount prefix must be an absolute path such as "/api/theme" (received ${JSON.stringify(value)})`,
    );
  }
  return prefix;
}

/**
 * Loads, validates, and freezes one factory theme directory.
 *
 * Every failure below is a build or deployment mistake, and every message names
 * the file and the fix. They are thrown while the consumer's module initializes,
 * which is early enough to fail a container start rather than a page render.
 */
export function defineTheme(
  source: string | URL,
  options: DefineThemeOptions = {},
): NajmThemeDefinition {
  const dir = resolveFactoryDir(source);
  const design = loadAppearance(dir, options.limits?.appearance);

  const loaded = (Object.entries(FACTORY_BRANDING_FILES) as [
    FactoryBrandingBasename,
    StandardBrandingSlotKey,
  ][]).map(([basename, slot]) => loadAsset(dir, basename, slot, options.limits));

  const assets = Object.freeze(loaded.map((entry) => entry.asset));
  const bySlot = new Map(assets.map((asset) => [asset.slot as string, asset]));
  const byFileName = new Map(assets.map((asset) => [asset.fileName, asset]));
  const bytesByFileName = new Map(
    loaded.map((entry) => [entry.asset.fileName, entry.bytes]),
  );

  // One resolved map per mount prefix. There is exactly one in an application,
  // and the RSC fallback asks for it on every miss.
  const brandingByPrefix = new Map<string, FactoryBranding>();

  const definition: NajmThemeDefinition = {
    dir,
    assets,

    appearance: () => structuredClone(design) as NajmDesignConfig,

    branding(mountPrefix?: string): FactoryBranding {
      const prefix = normalizeMountPrefix(mountPrefix);
      let resolved = brandingByPrefix.get(prefix);
      if (!resolved) {
        resolved = Object.freeze(
          Object.fromEntries(
            assets.map((asset) => [
              asset.slot,
              `${prefix}/branding/${FACTORY_ASSET_ROUTE_SEGMENT}/${asset.fileName}`,
            ]),
          ),
        ) as FactoryBranding;
        brandingByPrefix.set(prefix, resolved);
      }
      return resolved;
    },

    asset: (slot: string) => bySlot.get(slot),

    serveAsset(fileName: unknown, responseOptions?: FactoryAssetResponseOptions) {
      const parsed = parseFactoryAssetFileName(fileName);
      if (!parsed) return null;

      const asset = byFileName.get(fileName as string);
      const bytes = asset ? bytesByFileName.get(asset.fileName) : undefined;
      if (!asset || !bytes) return null;

      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": asset.mimeType,
          "Content-Length": String(asset.bytes),
          "X-Content-Type-Options": "nosniff",
          // Immutable is honest here because the content hash is in the name: a
          // deploy that changes the logo changes the URL.
          "Cache-Control": `public, max-age=${responseOptions?.cacheMaxAge ?? 31_536_000}, immutable`,
          ETag: `"${asset.contentHash}"`,
        },
      });
    },

    react(config) {
      return lazyThemeBootstrap(
        async () => (await import("najm-kit/server/react")).createReactServerUiBootstrap,
        {
          basePath: config.basePath,
          onDiagnostic: config.onDiagnostic,
          select: config.select,
          transport: config as ThemeBootstrapTransport,
          factory: {
            appearance: () => definition.appearance(),
            branding: () => definition.branding(config.basePath),
          },
        },
      );
    },
  };

  Object.defineProperty(definition, THEME_DEFINITION_BRAND, {
    value: true,
    enumerable: false,
  });

  return Object.freeze(definition);
}
