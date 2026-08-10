// ============================================================================
// najm-theme/server — plugin configuration
// ============================================================================
//
// Everything an application supplies, and everything the package refuses to
// guess. The resolution below fails at registration rather than at first
// request, on the principle that a theme feature nobody can save into is a
// deployment problem and should stop a deployment.
//
// Named `NajmThemePluginConfig`, not `NajmThemeConfig`: `najm-kit` already
// exports `NajmThemeConfig` for the serializable token set, and a consumer will
// routinely import both. The same reasoning keeps the React provider called
// `NThemeSettingsProvider` rather than `NajmThemeProvider`.
// ============================================================================

import type { NajmDesignConfig } from "najm-kit/server";

import {
  DEFAULT_APPEARANCE_LIMITS,
  resolveAppearanceLimits,
  type ThemeAppearanceLimits,
} from "../contracts/appearance";
import {
  STANDARD_BRANDING_SLOTS,
  assertBrandingSlotDefinitions,
  type BrandingSlotDefinition,
  type FactoryBranding,
} from "../contracts/branding";
import {
  assertFeatureDependencies,
  type NajmThemeFeatures,
} from "../contracts/capabilities";
import type { ThemeDiagnosticSink } from "../contracts/diagnostics";
import {
  isNajmThemeDefinition,
  withoutSlotInheritance,
  type NajmThemeDefinition,
} from "../contracts/factory";
import {
  DEFAULT_MAX_THEME_PRESETS,
  MAX_THEME_PRESETS_CEILING,
} from "../contracts/presets";
import {
  DEFAULT_THEME_SCOPE_ID,
  assertThemeScopeId,
  platformScope,
  type ThemeScopeResolver,
} from "../contracts/scope";
import { themeSchema as pgThemeSchema } from "../schema/pg";
import { themeSchema as sqliteThemeSchema } from "../schema/sqlite";
import type { ThemeAuditSink } from "./audit/ThemeAuditSink";

/**
 * A Najm guard decorator, usable on a class or a method.
 *
 * Deliberately not imported from `najm-guard`: guards created by `createGuard`
 * satisfy this shape, and so does a hand-written decorator, so an application
 * with its own authorization layer is not forced to adopt the guard plugin.
 */
export type ThemeGuardDecorator = ClassDecorator & MethodDecorator;

export interface ThemeRouteGuards {
  /** Public appearance read. Required unless `publicRead` is true. */
  readAppearance?: ThemeGuardDecorator[];
  /** Administrative appearance read, save, preset apply, and reset. */
  manageAppearance?: ThemeGuardDecorator[];
  /** Public branding read and managed asset delivery. Required unless `publicRead`. */
  readBranding?: ThemeGuardDecorator[];
  /** Administrative branding read, save, reset, upload, delete, reconcile. */
  manageBranding?: ThemeGuardDecorator[];
  /** Preset list. Defaults to `managePresets` — presets are never public. */
  readPresets?: ThemeGuardDecorator[];
  /** Preset create, apply, and delete. */
  managePresets?: ThemeGuardDecorator[];
}

export interface ThemeStorageConfig {
  /**
   * The `najm-storage` namespace prefix for managed assets.
   *
   * Per-scope suffixed at runtime (`theme-branding-<scopeId>`), so one tenant
   * cannot reference another's file even by guessing its name.
   */
  namespace?: string;
  /**
   * Re-encode raster uploads through Sharp before committing.
   *
   * On by default when Sharp resolves, because it is what turns "the bytes
   * claim to be a PNG" into "the bytes *are* a PNG": a decode-and-re-encode
   * drops trailing payloads, malformed chunks, and embedded metadata. Turning
   * it off is legitimate for an installation that has no native dependencies
   * available, and the MIME and decode checks still run.
   */
  normalize?: boolean;
  /** `Cache-Control: max-age` for committed assets. Defaults to one year. */
  cacheMaxAge?: number;
  /**
   * How long an unreferenced asset must have existed before reconciliation may
   * delete it. Defaults to 24 hours.
   *
   * Not zero, and not configurable below one hour. An upload that is not yet
   * referenced is the normal state of a draft somebody is still editing, and a
   * grace period is the only thing separating "clean up an orphan" from
   * "delete the logo they are about to save".
   */
  orphanGraceMs?: number;
}

export interface ThemeLimits {
  appearance?: Partial<ThemeAppearanceLimits>;
  maxPresets?: number;
  /**
   * Whether a built-in preset may be deleted. Defaults to `false`.
   *
   * Whatever this is set to, the UI reads it from the server projection rather
   * than deciding for itself — a delete button that 403s is worse than no
   * button, and a hidden button in front of a permissive backend is worse
   * still.
   */
  allowBuiltInPresetDeletion?: boolean;
}

/**
 * @deprecated Supply a `defineTheme()` definition instead. Removed in 0.3.0.
 *
 * Four consumer-supplied callbacks and paths were the thing the factory theme
 * convention replaced: they had to be repeated in the plugin and in the RSC
 * bootstrap, and nothing checked that the two agreed or that the files existed.
 */
export interface ThemeFactoryValues {
  /**
   * The design served when nothing is stored, and the target of a reset.
   *
   * Required when `features.appearance` is on. It is called per read and its
   * failure is deliberately *not* caught: a factory theme that cannot be built
   * is a broken build, and a second fallback would hide it behind a page that
   * looks merely unstyled.
   */
  appearance?: () => NajmDesignConfig;
  /** Factory asset paths keyed by slot. Required when `features.branding` is on. */
  branding?: () => FactoryBranding;
}

export interface NajmThemePluginConfig {
  features: NajmThemeFeatures;
  /** Named database from `najm-database`. Defaults to `"default"`. */
  database?: string;
  /** Chooses the built-in schema when `schema` is not supplied. Defaults to `"pg"`. */
  dialect?: "pg" | "sqlite";
  /**
   * The composed tables, when the application would rather pass them than have
   * the package pick by dialect. Must be the objects exported from
   * `najm-theme/pg` or `najm-theme/sqlite`.
   */
  schema?: ThemeSchema;
  /** Route prefix. Defaults to `"/theme"`. */
  basePath?: string;
  scope?: ThemeScopeResolver;
  /**
   * The canonical factory theme directory, from `defineTheme(import.meta.url)`.
   *
   * Supplies the factory design, the four factory assets, and the bytes the
   * package serves them from. Supersedes `factory`, which cannot express any of
   * the last part.
   */
  definition?: NajmThemeDefinition;
  /** @deprecated Pass a `definition` instead. Removed in 0.3.0. */
  factory?: ThemeFactoryValues;
  /** Defaults to the four standard slots. */
  brandingSlots?: readonly BrandingSlotDefinition[];
  /**
   * Serve appearance and branding reads without a guard.
   *
   * No default. An unauthenticated visitor needs the theme and the logo to
   * render the login page, so `true` is the common answer — but it is a
   * decision about what leaves the building, and a package that defaulted it
   * either way would be making that decision for the application.
   */
  publicRead?: boolean;
  guards: ThemeRouteGuards;
  storage?: ThemeStorageConfig;
  audit?: ThemeAuditSink;
  diagnostics?: ThemeDiagnosticSink;
  limits?: ThemeLimits;
  /**
   * Projects the authenticated user onto an attribution string.
   *
   * Defaults to the first of `id`, `sub`, or `userId` that is a string. An
   * application whose principal is shaped differently supplies its own; one
   * with no authentication at all gets `null` and stores `null`.
   */
  resolveActorId?: (user: unknown) => string | null;
}

/**
 * What an application still decides once the factory theme directory exists.
 *
 * Everything absent from this interface is either owned by the package (slot
 * names, route suffixes, resolution order, managed file names) or derived from
 * the definition (the factory design, the four assets, their URLs). What is left
 * is genuinely application policy: who may change the theme, where it is
 * persisted, what is recorded, and which ceilings this deployment wants.
 */
export interface NajmThemeOptions {
  /**
   * Who may change appearance, branding, and presets.
   *
   * One list rather than three. Three separate guard lists were the shape of
   * the pre-0.2.0 configuration, and in every real consumer they held the same
   * guard — the split invited a deployment where presets were administrable and
   * branding was not, which nobody wanted and nothing detected. Applications
   * that genuinely separate them still can, through `guards`.
   */
  manage: ThemeGuardDecorator[];
  /**
   * Guards for the *public* appearance and branding reads.
   *
   * Omitted, reads are public — the sign-in page needs the theme and the logo
   * before there is a session, which is the case this package exists to serve.
   * Supplying guards here makes the reads authenticated instead.
   */
  read?: ThemeGuardDecorator[];
  /** Turns individual features off. All are on except `mcp`, which needs `mcp()`. */
  features?: Partial<NajmThemeFeatures>;
  /** Named database from `najm-database`. Defaults to `"default"`. */
  database?: string;
  /** Chooses the built-in schema. Defaults to `"pg"`. */
  dialect?: "pg" | "sqlite";
  /** Overrides the built-in schema for the chosen dialect. Rarely needed. */
  schema?: ThemeSchema;
  /** Route prefix under the server base. Defaults to `"/theme"`. */
  basePath?: string;
  scope?: ThemeScopeResolver;
  storage?: ThemeStorageConfig;
  audit?: ThemeAuditSink;
  /** Defaults to a sanitized `console.warn`; pass `false` to silence it. */
  diagnostics?: false | ThemeDiagnosticSink;
  limits?: {
    /** Upload ceiling for the three logo slots, in bytes. */
    logoBytes?: number;
    /** Upload ceiling for the hero slot, in bytes. */
    heroBytes?: number;
    appearance?: Partial<ThemeAppearanceLimits>;
    maxPresets?: number;
    allowBuiltInPresetDeletion?: boolean;
  };
  resolveActorId?: (user: unknown) => string | null;
  /**
   * Per-route guards, for an application that genuinely separates reading a
   * preset from changing a logo. Anything set here wins over `manage`/`read`.
   */
  guards?: ThemeRouteGuards;
  /** A registry beyond the four standard slots. Advanced. */
  brandingSlots?: readonly BrandingSlotDefinition[];
}

/** The table objects, as exported by either dialect module. */
export interface ThemeSchema {
  najmThemeAppearance?: unknown;
  najmThemeBranding?: unknown;
  najmThemePresets?: unknown;
}

export interface ResolvedThemeConfig {
  features: NajmThemeFeatures;
  database: string;
  dialect: "pg" | "sqlite";
  schema: ThemeSchema;
  basePath: string;
  scope: ThemeScopeResolver;
  definition?: NajmThemeDefinition;
  factoryAppearance: () => NajmDesignConfig;
  /**
   * Factory asset paths keyed by slot.
   *
   * Takes the prefix the theme routes are mounted under *as a browser sees
   * them*, because that is the one thing a definition cannot know for itself:
   * the plugin's `basePath` is configuration this package owns, and the server
   * base in front of it belongs to `najm-core`.
   */
  factoryBranding: (mountPrefix: string) => FactoryBranding;
  brandingSlots: readonly BrandingSlotDefinition[];
  publicRead: boolean;
  guards: Required<{ [K in keyof ThemeRouteGuards]: ThemeGuardDecorator[] }>;
  storage: Required<ThemeStorageConfig>;
  audit?: ThemeAuditSink;
  diagnostics?: ThemeDiagnosticSink;
  limits: {
    appearance: ThemeAppearanceLimits;
    maxPresets: number;
    allowBuiltInPresetDeletion: boolean;
  };
  resolveActorId: (user: unknown) => string | null;
}

const MIN_ORPHAN_GRACE_MS = 60 * 60 * 1000;
const DEFAULT_ORPHAN_GRACE_MS = 24 * MIN_ORPHAN_GRACE_MS;

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/") return "";
  if (!trimmed.startsWith("/")) {
    throw new TypeError(`theme.basePath must start with "/" (received ${JSON.stringify(value)})`);
  }
  if (trimmed.includes("//") || trimmed.includes("\\") || trimmed.includes(":")) {
    throw new TypeError("theme.basePath must be a simple path segment such as \"/theme\"");
  }
  return trimmed.replace(/\/+$/, "");
}

function defaultActorId(user: unknown): string | null {
  if (typeof user !== "object" || user === null) return null;
  const record = user as Record<string, unknown>;
  for (const key of ["id", "sub", "userId"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function requireGuards(
  guards: ThemeGuardDecorator[] | undefined,
  key: string,
): ThemeGuardDecorator[] {
  if (!Array.isArray(guards) || guards.length === 0) {
    throw new TypeError(
      `theme.guards.${key} must be a non-empty array of guards — every theme mutation is authorized explicitly`,
    );
  }
  return guards;
}

/**
 * The default diagnostic sink.
 *
 * A theme diagnostic reports something the package recovered from — a dropped
 * stale slot, an asset that could not be cleaned up. Silence was the old
 * default, and silence is how a consumer discovers months later that branding
 * reconciliation has been failing since a storage credential rotated. This
 * prints the code and the sanitized detail and nothing else; anything richer is
 * the application's own sink to write.
 */
const reportThemeDiagnostic: ThemeDiagnosticSink = (diagnostic) => {
  console.warn(`[najm-theme] ${diagnostic.code}${diagnostic.detail ? `: ${diagnostic.detail}` : ""}`);
};

/**
 * Projects a definition plus application policy onto the full configuration.
 *
 * Every default here is one the pre-0.2.0 contract made a consumer write out,
 * and every one of them had the same value in each consumer that wrote it.
 */
export function themePluginConfig(
  definition: NajmThemeDefinition,
  options: NajmThemeOptions = {} as NajmThemeOptions,
): NajmThemePluginConfig {
  if (!options || typeof options !== "object") {
    throw new TypeError("theme(definition, options) requires an options object");
  }

  const manage = options.manage;
  if (!Array.isArray(manage) || manage.length === 0) {
    throw new TypeError(
      "theme.manage must be a non-empty array of guards — every theme mutation is authorized explicitly",
    );
  }

  const features: NajmThemeFeatures = {
    appearance: true,
    branding: true,
    presets: true,
    assetUploads: true,
    // The only one off by default: it requires the `mcp()` plugin, and turning
    // it on for an application that has not registered one would fail boot.
    mcp: false,
    ...options.features,
  };

  const dialect = options.dialect ?? "pg";
  if (dialect !== "pg" && dialect !== "sqlite") {
    throw new TypeError('theme.dialect must be "pg" or "sqlite"');
  }

  const read = options.read;
  const publicRead = !Array.isArray(read) || read.length === 0;

  return {
    features,
    database: options.database,
    dialect,
    // Both dialect modules are already in this bundle; picking one here is what
    // spares every consumer the import and the chance of pairing a `sqlite`
    // dialect with the `pg` tables.
    schema: options.schema ?? (dialect === "sqlite" ? sqliteThemeSchema : pgThemeSchema),
    basePath: options.basePath,
    scope: options.scope,
    definition,
    brandingSlots: applySlotCeilings(
      options.brandingSlots ?? withoutSlotInheritance(STANDARD_BRANDING_SLOTS),
      options.limits,
    ),
    publicRead,
    guards: {
      readAppearance: read,
      readBranding: read,
      manageAppearance: manage,
      manageBranding: manage,
      managePresets: manage,
      ...options.guards,
    },
    storage: options.storage,
    audit: options.audit,
    diagnostics:
      options.diagnostics === false ? undefined : (options.diagnostics ?? reportThemeDiagnostic),
    limits: {
      appearance: options.limits?.appearance,
      maxPresets: options.limits?.maxPresets,
      allowBuiltInPresetDeletion: options.limits?.allowBuiltInPresetDeletion,
    },
    resolveActorId: options.resolveActorId,
  };
}

/**
 * Applies the opinionated upload ceilings to the standard slots.
 *
 * Separate from `themePluginConfig` because it must also run for a consumer
 * that supplied its own `brandingSlots`: a ceiling is a deployment decision and
 * a registry is a shape decision, and combining them would make raising a limit
 * mean re-declaring four slots.
 */
function applySlotCeilings(
  slots: readonly BrandingSlotDefinition[],
  limits: NajmThemeOptions["limits"],
): readonly BrandingSlotDefinition[] {
  const logoBytes = limits?.logoBytes;
  const heroBytes = limits?.heroBytes;
  if (logoBytes === undefined && heroBytes === undefined) return slots;

  return slots.map((slot) => {
    const maxBytes = slot.kind === "hero" ? heroBytes : logoBytes;
    return maxBytes === undefined ? slot : Object.freeze({ ...slot, maxBytes });
  });
}

/**
 * Resolves and validates the whole configuration.
 *
 * Exported separately from the plugin so it can be tested, and so a consumer
 * that wants to validate its configuration in a startup check can call it
 * without building a server.
 */
export function resolveThemeConfig(config: NajmThemePluginConfig): ResolvedThemeConfig {
  if (!config || typeof config !== "object") {
    throw new TypeError("theme() requires a configuration object");
  }

  const { features } = config;
  if (!features || typeof features !== "object") {
    throw new TypeError("theme.features is required and must be explicit");
  }
  for (const key of ["appearance", "branding", "presets", "assetUploads", "mcp"] as const) {
    if (typeof features[key] !== "boolean") {
      throw new TypeError(`theme.features.${key} must be an explicit boolean`);
    }
  }
  assertFeatureDependencies(features);

  if (!features.appearance && !features.branding) {
    throw new TypeError(
      "theme() needs at least one of features.appearance or features.branding",
    );
  }

  const dialect = config.dialect ?? "pg";
  if (dialect !== "pg" && dialect !== "sqlite") {
    throw new TypeError('theme.dialect must be "pg" or "sqlite"');
  }

  const schema = config.schema;
  if (!schema || typeof schema !== "object") {
    throw new TypeError(
      "theme.schema is required — spread themeSchema (or the feature schema) from najm-theme/pg or najm-theme/sqlite into your app schema and pass the same tables here",
    );
  }
  if (features.appearance && !schema.najmThemeAppearance) {
    throw new TypeError("theme.schema.najmThemeAppearance is required when features.appearance is on");
  }
  if (features.branding && !schema.najmThemeBranding) {
    throw new TypeError("theme.schema.najmThemeBranding is required when features.branding is on");
  }
  if (features.presets && !schema.najmThemePresets) {
    throw new TypeError("theme.schema.najmThemePresets is required when features.presets is on");
  }

  // A definition covers both resources at once, which is the point of it. The
  // callbacks below remain only for the pre-0.2.0 contract.
  const definition = config.definition;
  if (definition !== undefined && !isNajmThemeDefinition(definition)) {
    throw new TypeError(
      "theme.definition must come from defineTheme(import.meta.url) in najm-theme/theme",
    );
  }

  // Factory values, for enabled resources only. A branding-only installation
  // must not be made to invent a design it never serves.
  const factoryAppearance = definition ? () => definition.appearance() : config.factory?.appearance;
  if (features.appearance && typeof factoryAppearance !== "function") {
    throw new TypeError(
      "theme.definition is required when features.appearance is on — pass defineTheme(import.meta.url)",
    );
  }
  const factoryBranding = config.factory?.branding;
  if (features.branding && !definition && typeof factoryBranding !== "function") {
    throw new TypeError(
      "theme.definition is required when features.branding is on — pass defineTheme(import.meta.url)",
    );
  }

  const standardSlots = definition
    ? withoutSlotInheritance(STANDARD_BRANDING_SLOTS)
    : STANDARD_BRANDING_SLOTS;
  const brandingSlots = features.branding
    ? assertBrandingSlotDefinitions([...(config.brandingSlots ?? standardSlots)])
    : [];

  if (typeof config.publicRead !== "boolean") {
    throw new TypeError(
      "theme.publicRead must be explicit — pass true to serve appearance and branding to anonymous visitors, or false and supply guards.readAppearance / guards.readBranding",
    );
  }

  const guards: ResolvedThemeConfig["guards"] = {
    readAppearance: [],
    manageAppearance: [],
    readBranding: [],
    manageBranding: [],
    readPresets: [],
    managePresets: [],
  };

  if (features.appearance) {
    guards.manageAppearance = requireGuards(config.guards?.manageAppearance, "manageAppearance");
    if (!config.publicRead) {
      guards.readAppearance = requireGuards(config.guards?.readAppearance, "readAppearance");
    }
  }
  if (features.branding) {
    guards.manageBranding = requireGuards(config.guards?.manageBranding, "manageBranding");
    if (!config.publicRead) {
      guards.readBranding = requireGuards(config.guards?.readBranding, "readBranding");
    }
  }
  if (features.presets) {
    guards.managePresets = requireGuards(config.guards?.managePresets, "managePresets");
    // Presets are a settings feature, never part of the public bootstrap, so
    // `publicRead` does not reach them. Listing them falls back to the same
    // guards that manage them unless the application separates the two.
    guards.readPresets = config.guards?.readPresets?.length
      ? config.guards.readPresets
      : guards.managePresets;
  }

  const scope = config.scope ?? platformScope;
  if (typeof scope !== "function") {
    throw new TypeError("theme.scope must be a function");
  }

  const namespace = config.storage?.namespace ?? "theme-branding";
  assertThemeScopeId(namespace, "theme.storage.namespace");

  const cacheMaxAge = config.storage?.cacheMaxAge ?? 31_536_000;
  if (!Number.isSafeInteger(cacheMaxAge) || cacheMaxAge < 0) {
    throw new TypeError("theme.storage.cacheMaxAge must be a non-negative integer");
  }

  const orphanGraceMs = config.storage?.orphanGraceMs ?? DEFAULT_ORPHAN_GRACE_MS;
  if (!Number.isSafeInteger(orphanGraceMs) || orphanGraceMs < MIN_ORPHAN_GRACE_MS) {
    throw new TypeError(
      `theme.storage.orphanGraceMs must be at least ${MIN_ORPHAN_GRACE_MS} — a shorter window deletes uploads that a draft is still holding`,
    );
  }

  const maxPresets = config.limits?.maxPresets ?? DEFAULT_MAX_THEME_PRESETS;
  if (!Number.isSafeInteger(maxPresets) || maxPresets < 1 || maxPresets > MAX_THEME_PRESETS_CEILING) {
    throw new TypeError(
      `theme.limits.maxPresets must be an integer between 1 and ${MAX_THEME_PRESETS_CEILING}`,
    );
  }

  if (config.audit !== undefined && typeof config.audit?.record !== "function") {
    throw new TypeError("theme.audit must expose a record() function");
  }

  return {
    features,
    database: config.database ?? "default",
    dialect,
    schema,
    basePath: normalizeBasePath(config.basePath ?? "/theme"),
    scope,
    definition,
    factoryAppearance:
      factoryAppearance
      ?? (() => {
        throw new TypeError("theme.definition was not configured");
      }),
    factoryBranding: definition
      ? (mountPrefix: string) => definition.branding(mountPrefix)
      : (factoryBranding ?? (() => ({}))),
    brandingSlots,
    publicRead: config.publicRead,
    guards,
    storage: {
      namespace,
      normalize: config.storage?.normalize ?? true,
      cacheMaxAge,
      orphanGraceMs,
    },
    audit: config.audit,
    diagnostics: config.diagnostics,
    limits: {
      appearance: config.limits?.appearance
        ? resolveAppearanceLimits(config.limits.appearance)
        : DEFAULT_APPEARANCE_LIMITS,
      maxPresets,
      allowBuiltInPresetDeletion: config.limits?.allowBuiltInPresetDeletion ?? false,
    },
    resolveActorId: config.resolveActorId ?? defaultActorId,
  };
}

export { DEFAULT_THEME_SCOPE_ID };
