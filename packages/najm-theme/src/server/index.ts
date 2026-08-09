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
export { resolveThemeConfig } from "./config";
export type {
  NajmThemePluginConfig,
  ResolvedThemeConfig,
  ThemeFactoryValues,
  ThemeGuardDecorator,
  ThemeLimits,
  ThemeRouteGuards,
  ThemeSchema,
  ThemeStorageConfig,
} from "./config";

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
