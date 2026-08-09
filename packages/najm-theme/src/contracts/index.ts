// ============================================================================
// najm-theme/contracts — universal entry
// ============================================================================
//
// Types and pure functions only. No React, no Node built-in, no filesystem, no
// Drizzle runtime, no decorator. This entry is imported by the server plugin,
// by the React package, and by consumer code on both sides of the boundary, so
// anything that cannot run in all three does not belong here.
// ============================================================================

export {
  APPEARANCE_EDITABLE_GROUPS,
  DEFAULT_APPEARANCE_LIMITS,
  MAX_APPEARANCE_LIMITS,
  changedAppearanceGroups,
  mergeAppearance,
  parsePublicAppearance,
  parseSafeDesignConfig,
  pickAppearancePatch,
  resolveAppearanceLimits,
} from "./appearance";
export type {
  AdminAppearance,
  AppearanceGroup,
  PublicAppearance,
  ThemeAppearanceLimits,
} from "./appearance";

export {
  BRANDING_RASTER_MIME_TYPES,
  MAX_BRANDING_SLOT_BYTES,
  STANDARD_BRANDING_SLOTS,
  assertBrandingSlotDefinitions,
  isBrandingAssetFileName,
  isBrandingSlotKey,
  parsePublicBranding,
  readBrandingSlotConfig,
  resolveBrandingSlots,
} from "./branding";
export type {
  AdminBranding,
  AdminBrandingSlot,
  BrandingPreviewAspect,
  BrandingSlotAsset,
  BrandingSlotConfig,
  BrandingSlotDefinition,
  BrandingSlotFallback,
  BrandingSlotKind,
  FactoryBranding,
  FactoryPath,
  PublicBranding,
  ResolveBrandingOptions,
  ResolvedBrandingSlot,
} from "./branding";

export {
  NO_THEME_CAPABILITIES,
  assertFeatureDependencies,
  capabilitiesFor,
} from "./capabilities";
export type { NajmThemeFeatures, ThemeCapabilities } from "./capabilities";

export { describeThrown, reportDiagnostic } from "./diagnostics";
export type {
  ThemeDiagnostic,
  ThemeDiagnosticCode,
  ThemeDiagnosticSink,
} from "./diagnostics";

export {
  DEFAULT_MAX_THEME_PRESETS,
  MAX_THEME_PRESETS_CEILING,
  THEME_PRESET_NAME_MAX_LENGTH,
  THEME_PRESET_SLUG_MAX_LENGTH,
  assertThemePresetName,
  isPublicThemePreset,
  isThemePresetSlug,
  themePresetSlug,
  uniqueThemePresetSlug,
} from "./presets";
export type { CreateThemePresetInput, PublicThemePreset } from "./presets";

export {
  INITIAL_THEME_REVISION,
  ThemeRevisionConflictError,
  assertThemeRevision,
  isThemeRevision,
  isThemeRevisionConflict,
  nextThemeRevision,
} from "./revisions";
export type { ThemeRevisionResource } from "./revisions";

export {
  DEFAULT_THEME_SCOPE_ID,
  THEME_SCOPE_ID_MAX_LENGTH,
  assertThemeScopeId,
  isThemeScopeId,
  platformScope,
} from "./scope";
export type { ThemeScopeContext, ThemeScopeResolver } from "./scope";

// Re-exported so a consumer types a factory design without importing the kit's
// server entry alongside this one. Same type, one import.
export type { NajmDesignConfig } from "najm-kit/server";
