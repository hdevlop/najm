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
  DEFAULT_MAX_THEME_PRESETS,
  MAX_THEME_PRESETS_CEILING,
} from "../contracts/presets";
import {
  DEFAULT_THEME_SCOPE_ID,
  assertThemeScopeId,
  platformScope,
  type ThemeScopeResolver,
} from "../contracts/scope";
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
  factoryAppearance: () => NajmDesignConfig;
  factoryBranding: () => FactoryBranding;
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

  // Factory values, for enabled resources only. A branding-only installation
  // must not be made to invent a design it never serves.
  const factoryAppearance = config.factory?.appearance;
  if (features.appearance && typeof factoryAppearance !== "function") {
    throw new TypeError("theme.factory.appearance is required when features.appearance is on");
  }
  const factoryBranding = config.factory?.branding;
  if (features.branding && typeof factoryBranding !== "function") {
    throw new TypeError("theme.factory.branding is required when features.branding is on");
  }

  const brandingSlots = features.branding
    ? assertBrandingSlotDefinitions([...(config.brandingSlots ?? STANDARD_BRANDING_SLOTS)])
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
    factoryAppearance:
      factoryAppearance
      ?? (() => {
        throw new TypeError("theme.factory.appearance was not configured");
      }),
    factoryBranding: factoryBranding ?? (() => ({})),
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
