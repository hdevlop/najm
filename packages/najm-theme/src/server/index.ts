// ============================================================================
// najm-theme/server — backend entry
// ============================================================================
//
// The plugin, its configuration contract, and the pieces a consumer genuinely
// composes with: the audit sink shape, the diagnostic codes, the error types.
//
// Services, repositories, and controllers are exported as *types* only. They
// are registered by `theme()` and resolved through the container; exporting the
// classes would invite an application to instantiate a service with its own
// arguments and end up with a second one that shares no configuration.
//
// This entry never imports the `najm-kit` root barrel. That barrel reaches the
// whole component library, and importing it here would resolve React and
// react-hook-form inside a route handler.
// ============================================================================

export { theme } from "./module";
export { resolveThemeConfig, themePluginConfig } from "./config";
export type {
  NajmThemeOptions,
  NajmThemePluginConfig,
  ResolvedThemeConfig,
  ThemeFactoryValues,
  ThemeGuardDecorator,
  ThemeLimits,
  ThemeRouteGuards,
  ThemeSchema,
  ThemeStorageConfig,
} from "./config";

// Re-exported so backend-only code registers a plugin with one import. A
// consumer's own `theme/index.ts` should import it from `najm-theme/theme`
// instead: that entry carries no controller, no Drizzle, and no decorator, so
// the file stays safe to import from a React Server Component.
export { defineTheme } from "../theme";
export type { DefineThemeLimits, DefineThemeOptions } from "../theme";

export { THEME_CONFIG, THEME_SCHEMA } from "./tokens";

export { themeAuditEvent } from "./audit/ThemeAuditEvents";
export type {
  ThemeAuditAction,
  ThemeAuditEvent,
  ThemeAuditMetadata,
} from "./audit/ThemeAuditEvents";
export type { ThemeAuditSink } from "./audit/ThemeAuditSink";

export {
  THEME_CONFLICT_CODE,
  ThemeNotFoundError,
  ThemePolicyError,
} from "./shared/errors";

export {
  THEME_LOCALES,
  THEME_SUPPORTED_LANGUAGES,
  getThemeLocale,
} from "./locales";
export type { ThemeLocaleLanguage } from "./locales";

// Route prefixes, so a consumer building a reverse proxy rule or an RSC
// fetcher writes the same strings the router registered.
export { APPEARANCE_ROUTE_PREFIX } from "./appearance/AppearanceController";
export { BRANDING_ROUTE_PREFIX } from "./branding/BrandingController";
export { PRESETS_ROUTE_PREFIX } from "./presets/ThemePresetController";

export type { AppearanceService } from "./appearance/AppearanceService";
export type { BrandingService } from "./branding/BrandingService";
export type { BrandingAssetService } from "./branding/BrandingAssetService";
export type { ThemePresetService } from "./presets/ThemePresetService";

// Re-exported so backend code configuring the plugin needs one import, not two.
export * from "../contracts";

// Deprecated in 0.2.0, removed in 0.3.0. Exported from the entry 0.1.1 used, so
// a consumer upgrading a minor version does not have to change an import path
// to keep compiling.
export { createFactoryDesignGetter } from "./deprecated";
