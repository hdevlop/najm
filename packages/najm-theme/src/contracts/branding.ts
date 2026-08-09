// ============================================================================
// najm-theme/contracts — branding
// ============================================================================
//
// Branding is a slot registry, not four hard-coded columns.
//
// The four standard slots below cover what a Najm application chrome actually
// renders — an expanded and a collapsed sidebar mark, a login logo, a login
// hero. But the next consumer will want a favicon, or an emailheader, or a
// per-tenant watermark, and a package whose branding is four columns answers
// that with a migration in every consumer.
//
// So persistence is one validated JSON map from slot key to managed asset
// reference. Registering a new slot is configuration in one application; it
// needs no DDL here and none there.
// ============================================================================

import { isThemeRevision } from "./revisions";

export type BrandingSlotKind = "logo" | "hero" | "icon" | "image";

/** Drives the aspect a preview is boxed into. Presentation only. */
export type BrandingPreviewAspect = "square" | "wide" | "panel" | "natural";

/** A public path the application serves — a build asset, usually under `/`. */
export type FactoryPath = string;

/**
 * Where a slot lands when nothing managed is stored for it.
 *
 * A bare string is a literal public path. `{ inheritFrom }` names another slot,
 * which is what makes "the collapsed mark is the expanded one unless you
 * replace it" expressible without duplicating an upload.
 *
 * Optional, because the factory branding map is consulted first and covers the
 * ordinary case. A slot with neither resolves to `null`, and the chrome renders
 * its own placeholder — an application without a hero image is not broken.
 */
export type BrandingSlotFallback = FactoryPath | { inheritFrom: string };

export interface BrandingSlotDefinition {
  key: string;
  kind: BrandingSlotKind;
  /** A key into the package locale catalogs, or a consumer override. */
  labelKey: string;
  maxBytes: number;
  acceptedMimeTypes: string[];
  previewAspect?: BrandingPreviewAspect;
  fallback?: BrandingSlotFallback;
}

/** Factory values keyed by slot. What the application ships in its build. */
export type FactoryBranding = Record<string, FactoryPath | null | undefined>;

/**
 * The managed reference stored per slot.
 *
 * Only what the package put there itself. A consumer cannot store an arbitrary
 * path here — that is the difference between a branding slot and an open
 * redirect: the value is a file name inside the package's own storage
 * namespace, never a URL.
 */
export interface BrandingSlotAsset {
  /** Immutable file name inside the scope's storage namespace. */
  fileName: string;
  mimeType: string;
  bytes: number;
  /** ISO 8601. */
  uploadedAt: string;
}

/** The persisted shape of `najm_theme_branding.slot_config`. */
export type BrandingSlotConfig = Record<string, BrandingSlotAsset>;

/** What a public branding read returns: resolved paths and a revision. */
export interface PublicBranding {
  /** Slot key to the path the chrome should render, or `null`. */
  slots: Record<string, string | null>;
  revision: number;
}

/** One slot as an administrator sees it. */
export interface AdminBrandingSlot {
  key: string;
  kind: BrandingSlotKind;
  labelKey: string;
  maxBytes: number;
  acceptedMimeTypes: string[];
  previewAspect: BrandingPreviewAspect;
  /** The path in use, managed or inherited. */
  resolvedPath: string | null;
  /** True when a managed asset is stored for this slot specifically. */
  isCustom: boolean;
  /**
   * Where a non-custom slot's value came from — `"factory"`, or the key of the
   * slot it inherits. `null` when the slot resolved to nothing.
   *
   * Present so the UI can say "inherited from the sidebar mark" instead of
   * showing an identical image in two places with no explanation.
   */
  inheritedFrom: string | null;
  uploadedAt: string | null;
}

/**
 * What an administrative branding read returns.
 *
 * Filesystem paths, storage credentials, orphan lists, and candidate uploads
 * are all absent by construction: this type has nowhere to put them.
 */
export interface AdminBranding {
  slots: AdminBrandingSlot[];
  revision: number;
  updatedAt: string | null;
  updatedByActorId: string | null;
}

// ---------------------------------------------------------------------------
// Standard slots
// ---------------------------------------------------------------------------

/** 512 KB. Generous for a mark, small enough that a mistake is caught. */
const LOGO_MAX_BYTES = 512 * 1024;
/** 2 MB. A hero is a photograph, not an icon. */
const HERO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * SVG is absent on purpose, and it is the omission most likely to be
 * questioned.
 *
 * An SVG is a document: it can carry `<script>`, an `<image href>` that phones
 * home, and an XML external entity. Served from the application's own origin as
 * a top-level document it runs with that origin's privileges. Accepting one
 * safely means parsing and sanitizing it, which is a different project. An
 * application that has done that work can add SVG to its own slot definition;
 * the package will not do it by default.
 */
export const BRANDING_RASTER_MIME_TYPES: readonly string[] = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const STANDARD_BRANDING_SLOTS: readonly BrandingSlotDefinition[] = Object.freeze([
  Object.freeze({
    key: "sidebarLogoExpanded",
    kind: "logo",
    labelKey: "theme.branding.slots.sidebarLogoExpanded",
    maxBytes: LOGO_MAX_BYTES,
    acceptedMimeTypes: [...BRANDING_RASTER_MIME_TYPES],
    previewAspect: "wide",
  }),
  Object.freeze({
    key: "sidebarLogoCollapsed",
    kind: "logo",
    labelKey: "theme.branding.slots.sidebarLogoCollapsed",
    maxBytes: LOGO_MAX_BYTES,
    acceptedMimeTypes: [...BRANDING_RASTER_MIME_TYPES],
    previewAspect: "square",
    fallback: { inheritFrom: "sidebarLogoExpanded" },
  }),
  Object.freeze({
    key: "authLogo",
    kind: "logo",
    labelKey: "theme.branding.slots.authLogo",
    maxBytes: LOGO_MAX_BYTES,
    acceptedMimeTypes: [...BRANDING_RASTER_MIME_TYPES],
    previewAspect: "wide",
    fallback: { inheritFrom: "sidebarLogoExpanded" },
  }),
  Object.freeze({
    key: "authHeroImage",
    kind: "hero",
    labelKey: "theme.branding.slots.authHeroImage",
    maxBytes: HERO_MAX_BYTES,
    acceptedMimeTypes: [...BRANDING_RASTER_MIME_TYPES],
    previewAspect: "panel",
  }),
]) as readonly BrandingSlotDefinition[];

/** 8 MB. The ceiling a consumer's own slot definition may not exceed. */
export const MAX_BRANDING_SLOT_BYTES = 8 * 1024 * 1024;

/**
 * Slot keys reach a storage file name and a route parameter, so they are
 * restricted rather than escaped at each of the places they travel.
 */
const SLOT_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,47}$/;

export function isBrandingSlotKey(value: unknown): value is string {
  return typeof value === "string" && SLOT_KEY_PATTERN.test(value);
}

const SLOT_KINDS = new Set<BrandingSlotKind>(["logo", "hero", "icon", "image"]);
const PREVIEW_ASPECTS = new Set<BrandingPreviewAspect>([
  "square",
  "wide",
  "panel",
  "natural",
]);

/**
 * Validates a registry at plugin registration, not at first upload.
 *
 * Every failure here is a configuration mistake, and configuration mistakes
 * should stop a deployment rather than wait for an administrator to open a
 * settings sheet.
 */
export function assertBrandingSlotDefinitions(
  slots: readonly BrandingSlotDefinition[],
): readonly BrandingSlotDefinition[] {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new TypeError("brandingSlots must be a non-empty array");
  }

  const keys = new Set<string>();
  for (const slot of slots) {
    if (!isBrandingSlotKey(slot?.key)) {
      throw new TypeError(
        `brandingSlots[].key must be 1-48 alphanumeric characters starting with a letter (received ${JSON.stringify(slot?.key)})`,
      );
    }
    if (keys.has(slot.key)) {
      throw new TypeError(`brandingSlots contains a duplicate key: ${slot.key}`);
    }
    keys.add(slot.key);

    if (!SLOT_KINDS.has(slot.kind)) {
      throw new TypeError(`brandingSlots.${slot.key}.kind must be one of: ${[...SLOT_KINDS].join(", ")}`);
    }
    if (typeof slot.labelKey !== "string" || slot.labelKey.length === 0) {
      throw new TypeError(`brandingSlots.${slot.key}.labelKey must be a non-empty string`);
    }
    if (!Number.isSafeInteger(slot.maxBytes) || slot.maxBytes < 1) {
      throw new TypeError(`brandingSlots.${slot.key}.maxBytes must be a positive integer`);
    }
    if (slot.maxBytes > MAX_BRANDING_SLOT_BYTES) {
      throw new TypeError(
        `brandingSlots.${slot.key}.maxBytes must not exceed the package maximum of ${MAX_BRANDING_SLOT_BYTES}`,
      );
    }
    if (
      !Array.isArray(slot.acceptedMimeTypes)
      || slot.acceptedMimeTypes.length === 0
      || slot.acceptedMimeTypes.some((mime) => typeof mime !== "string" || !mime.includes("/"))
    ) {
      throw new TypeError(
        `brandingSlots.${slot.key}.acceptedMimeTypes must be a non-empty array of MIME types`,
      );
    }
    if (slot.previewAspect !== undefined && !PREVIEW_ASPECTS.has(slot.previewAspect)) {
      throw new TypeError(
        `brandingSlots.${slot.key}.previewAspect must be one of: ${[...PREVIEW_ASPECTS].join(", ")}`,
      );
    }
  }

  // Second pass: `inheritFrom` can name a slot declared later, so targets are
  // only knowable once every key is registered.
  for (const slot of slots) {
    const fallback = slot.fallback;
    if (fallback === undefined || typeof fallback === "string") continue;
    if (!keys.has(fallback.inheritFrom)) {
      throw new TypeError(
        `brandingSlots.${slot.key}.fallback.inheritFrom names an unregistered slot: ${fallback.inheritFrom}`,
      );
    }
    if (fallback.inheritFrom === slot.key) {
      throw new TypeError(`brandingSlots.${slot.key}.fallback.inheritFrom must not be the slot itself`);
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Stored slot config
// ---------------------------------------------------------------------------

/**
 * Immutable, content-independent, and unguessable.
 *
 * A UUID rather than the original file name: committed assets are served with a
 * one-year immutable cache header, so a replacement that reused a name would be
 * invisible behind every cache between the server and the browser.
 */
const FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;

export function isBrandingAssetFileName(value: unknown): value is string {
  return typeof value === "string" && FILE_NAME_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a stored slot map back, dropping anything that does not belong.
 *
 * Lenient by design and only here. This runs against a database column, where
 * the realistic failure is a slot that was deregistered in a deploy — throwing
 * would take down every page in the application over a row that is merely
 * stale. Unknown and malformed entries are dropped and reported; the caller
 * emits one diagnostic when `droppedKeys` is non-empty.
 *
 * The write path does not use this. A save that named an unregistered slot is a
 * client bug and is rejected outright.
 */
export function readBrandingSlotConfig(
  input: unknown,
  registeredKeys: ReadonlySet<string>,
): { config: BrandingSlotConfig; droppedKeys: string[] } {
  const config: BrandingSlotConfig = {};
  const droppedKeys: string[] = [];

  if (!isRecord(input)) {
    return { config, droppedKeys: input === null || input === undefined ? [] : ["<root>"] };
  }

  for (const [key, value] of Object.entries(input)) {
    if (!registeredKeys.has(key) || !isRecord(value)) {
      droppedKeys.push(key);
      continue;
    }
    if (
      !isBrandingAssetFileName(value.fileName)
      || typeof value.mimeType !== "string"
      || !Number.isSafeInteger(value.bytes)
      || (value.bytes as number) < 0
      || typeof value.uploadedAt !== "string"
    ) {
      droppedKeys.push(key);
      continue;
    }

    config[key] = {
      fileName: value.fileName,
      mimeType: value.mimeType,
      bytes: value.bytes as number,
      uploadedAt: value.uploadedAt,
    };
  }

  return { config, droppedKeys };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolveBrandingOptions {
  slots: readonly BrandingSlotDefinition[];
  config: BrandingSlotConfig;
  factory: FactoryBranding;
  /** Builds the public URL for a committed managed asset. */
  assetPath: (fileName: string) => string;
}

export interface ResolvedBrandingSlot {
  path: string | null;
  isCustom: boolean;
  inheritedFrom: string | null;
  uploadedAt: string | null;
}

/**
 * Managed asset, then factory value, then the declared fallback.
 *
 * `inheritFrom` recurses through the same order, so a collapsed mark inheriting
 * an expanded one picks up a *managed* expanded mark rather than the factory
 * file — which is what makes "upload one logo, both places update" work.
 *
 * The visited set is not defensive programming: `assertBrandingSlotDefinitions`
 * rejects self-inheritance but a longer cycle (a → b → a) across two consumer
 * slot definitions is only detectable here, and an infinite recursion inside a
 * page render is a worse outcome than a `null` mark.
 */
export function resolveBrandingSlots(
  options: ResolveBrandingOptions,
): Record<string, ResolvedBrandingSlot> {
  const { slots, config, factory, assetPath } = options;
  const byKey = new Map(slots.map((slot) => [slot.key, slot]));
  const resolved: Record<string, ResolvedBrandingSlot> = {};

  const resolveOne = (
    key: string,
    visited: Set<string>,
  ): ResolvedBrandingSlot => {
    const empty: ResolvedBrandingSlot = {
      path: null,
      isCustom: false,
      inheritedFrom: null,
      uploadedAt: null,
    };

    if (visited.has(key)) return empty;
    visited.add(key);

    const slot = byKey.get(key);
    if (!slot) return empty;

    const managed = config[key];
    if (managed) {
      return {
        path: assetPath(managed.fileName),
        isCustom: true,
        inheritedFrom: null,
        uploadedAt: managed.uploadedAt,
      };
    }

    const factoryPath = factory[key];
    if (typeof factoryPath === "string" && factoryPath.length > 0) {
      return { path: factoryPath, isCustom: false, inheritedFrom: "factory", uploadedAt: null };
    }

    const fallback = slot.fallback;
    if (typeof fallback === "string" && fallback.length > 0) {
      return { path: fallback, isCustom: false, inheritedFrom: "factory", uploadedAt: null };
    }
    if (fallback && typeof fallback === "object") {
      const inherited = resolveOne(fallback.inheritFrom, visited);
      return {
        path: inherited.path,
        isCustom: false,
        inheritedFrom: inherited.path === null ? null : fallback.inheritFrom,
        uploadedAt: null,
      };
    }

    return empty;
  };

  for (const slot of slots) {
    resolved[slot.key] = resolveOne(slot.key, new Set());
  }

  return resolved;
}

/**
 * Narrows a public branding response for the server-render bootstrap.
 *
 * Returns `undefined` rather than throwing; the bootstrap treats both the same
 * way and falls back to the factory marks.
 */
export function parsePublicBranding(input: unknown): PublicBranding | undefined {
  if (!isRecord(input)) return undefined;
  if (!isThemeRevision(input.revision)) return undefined;
  if (!isRecord(input.slots)) return undefined;

  const slots: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input.slots)) {
    if (value === null) {
      slots[key] = null;
      continue;
    }
    if (typeof value !== "string") return undefined;
    slots[key] = value;
  }

  return { slots, revision: input.revision };
}
