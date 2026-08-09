// ============================================================================
// najm-theme/react — Client Component entry
// ============================================================================
//
// The build prepends `"use client"` to this entry, so a Server Component can
// import from it and the boundary lands here rather than in the consumer's own
// file.
//
// Nothing in this graph reaches `najm-theme/server`. The export map points the
// `browser` condition of `najm-theme/server/react` at a module that throws, and
// the bundle-isolation test asserts the built output of this entry contains no
// controller, no Drizzle, and no `server-only`.
// ============================================================================

export {
  NThemeSettingsProvider,
  useNThemeSettings,
  useNThemeSettingsOptional,
} from "./providers/NThemeSettingsProvider";
export type {
  NThemeSettingsProviderProps,
  NThemeSettingsValue,
} from "./providers/NThemeSettingsProvider";

export { NThemeAppearanceSettings } from "./components/NThemeAppearanceSettings";
export type { NThemeAppearanceSettingsProps } from "./components/NThemeAppearanceSettings";
export { NThemeBrandingSettings } from "./components/NThemeBrandingSettings";
export type { NThemeBrandingSettingsProps } from "./components/NThemeBrandingSettings";
export { NThemePresetSettings } from "./components/NThemePresetSettings";
export type { NThemePresetSettingsProps } from "./components/NThemePresetSettings";
export { NThemeSettingsActions } from "./components/NThemeSettingsActions";
export type { NThemeSettingsActionsProps } from "./components/NThemeSettingsActions";
export { NThemeSettingsSaveButton } from "./components/NThemeSettingsSaveButton";
export type { NThemeSettingsSaveButtonProps } from "./components/NThemeSettingsSaveButton";
export { NThemeSettingsResetButton } from "./components/NThemeSettingsResetButton";
export type { NThemeSettingsResetButtonProps } from "./components/NThemeSettingsResetButton";
export { NThemeSettingsStatus } from "./components/NThemeSettingsStatus";
export type { NThemeSettingsStatusProps } from "./components/NThemeSettingsStatus";
export { NThemeSettings } from "./components/NThemeSettings";
export type { NThemeSettingsProps } from "./components/NThemeSettings";

export { createThemeClient, isThemeConflictError } from "./api/client";
export type { ThemeClient, ThemeClientOptions } from "./api/client";

export { themeQueryKeys } from "./queryKeys";
export type { ThemeQueryKey } from "./queryKeys";

export {
  THEME_LANGUAGES,
  THEME_UI_LOCALES,
  createThemeTranslator,
} from "./translations";
export type {
  ThemeLabelKey,
  ThemeLabelOverrides,
  ThemeLanguage,
  ThemeTranslator,
  ThemeTranslatorOptions,
} from "./translations";

export type {
  AdminAppearanceResponse,
  AdminBrandingResponse,
  BrandingSlotView,
  ThemeDirtyState,
  ThemePresetsResponse,
  ThemeRequestError,
  ThemeSettingsPhase,
  ThemeSettingsStatus,
  UploadedBrandingAsset,
} from "./types";

// The universal contracts, so a settings page types a design without a second
// import. Pure types and pure functions — nothing here reaches the server.
export * from "../contracts";
