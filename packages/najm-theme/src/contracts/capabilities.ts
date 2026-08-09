// ============================================================================
// najm-theme/contracts — features and capabilities
// ============================================================================

/**
 * Which resources this installation exposes at all.
 *
 * Every field is required. A default of `true` would mean an application that
 * registered the plugin for appearance alone silently gained branding upload
 * routes; a default of `false` would mean a typo quietly removes a feature that
 * was working. Explicit is the only option that fails loudly in both
 * directions.
 */
export interface NajmThemeFeatures {
  appearance: boolean;
  branding: boolean;
  presets: boolean;
  assetUploads: boolean;
  mcp: boolean;
}

/**
 * What the caller may do, as projected onto an administrative read.
 *
 * Reaching an administrative endpoint already means its guard passed, so these
 * report the *feature* dimension: enabled here, disabled there. They exist so a
 * settings surface can render a read-only Branding section instead of a Save
 * button that will always 403.
 *
 * They are not the authorization boundary and are never consulted as one. Every
 * mutation re-checks its guard server-side; hiding a control is a courtesy to
 * the user, not a security property.
 */
export interface ThemeCapabilities {
  readAppearance: boolean;
  manageAppearance: boolean;
  readBranding: boolean;
  manageBranding: boolean;
  uploadBrandingAssets: boolean;
  readPresets: boolean;
  managePresets: boolean;
}

export const NO_THEME_CAPABILITIES: ThemeCapabilities = Object.freeze({
  readAppearance: false,
  manageAppearance: false,
  readBranding: false,
  manageBranding: false,
  uploadBrandingAssets: false,
  readPresets: false,
  managePresets: false,
});

/**
 * Feature dependencies, stated once so the plugin and the React provider cannot
 * disagree about what "presets enabled" implies.
 *
 * Presets store and apply a design, so they are meaningless without appearance.
 * Asset uploads write into branding's slot map, so they are meaningless without
 * branding.
 */
export function assertFeatureDependencies(features: NajmThemeFeatures): void {
  if (features.presets && !features.appearance) {
    throw new TypeError("theme.features.presets requires features.appearance");
  }
  if (features.assetUploads && !features.branding) {
    throw new TypeError("theme.features.assetUploads requires features.branding");
  }
}

export function capabilitiesFor(features: NajmThemeFeatures): ThemeCapabilities {
  return {
    readAppearance: features.appearance,
    manageAppearance: features.appearance,
    readBranding: features.branding,
    manageBranding: features.branding,
    uploadBrandingAssets: features.branding && features.assetUploads,
    readPresets: features.presets,
    managePresets: features.presets,
  };
}
