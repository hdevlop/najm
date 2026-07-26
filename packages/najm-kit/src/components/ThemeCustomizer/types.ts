import type * as React from "react";
import type { ThemeCustomizerTokenKey } from "./theme-customizer-config";

export type NThemeCustomizerTab = "theme" | "typography";

export interface NThemeCustomizerFontOption {
  value: string;
  label: React.ReactNode;
}

export type NThemeCustomizerTokenLabels = {
  [K in ThemeCustomizerTokenKey]: React.ReactNode;
};

export interface NThemeCustomizerOptionLabels {
  scale: Partial<
    Record<"compact" | "default" | "comfortable", React.ReactNode>
  >;
}

export interface NThemeCustomizerLabels {
  themeTab: React.ReactNode;
  typographyTab: React.ReactNode;
  lightMode: React.ReactNode;
  darkMode: React.ReactNode;
  resetField: React.ReactNode;
  resetSection: React.ReactNode;
  /** Override the swatch button's accessible name when no token label is provided. */
  colorSwatchFallback: React.ReactNode;
  defaultOption: React.ReactNode;
  themeSection: React.ReactNode;
  typographySection: React.ReactNode;
  layoutSubsection: React.ReactNode;
  pageHeaderSubsection: React.ReactNode;
  sidebarSubsection: React.ReactNode;
  tableSubsection: React.ReactNode;
  inputSubsection: React.ReactNode;
  previewMode: React.ReactNode;
  surfaceGroup: React.ReactNode;
  brandGroup: React.ReactNode;
  feedbackGroup: React.ReactNode;
  borderFocusGroup: React.ReactNode;
  sidebarGroup: React.ReactNode;
  chartsGroup: React.ReactNode;
  globalRadius: React.ReactNode;
  globalBorderWidth: React.ReactNode;
  fontSans: React.ReactNode;
  fontHeading: React.ReactNode;
  fontMono: React.ReactNode;
  advancedTypography: React.ReactNode;
  baseSize: React.ReactNode;
  scale: React.ReactNode;
  lineHeight: React.ReactNode;
  letterSpacing: React.ReactNode;
  pageGutter: React.ReactNode;
  sectionGap: React.ReactNode;
  pageHeaderCard: React.ReactNode;
  sidebarSectionLabels: React.ReactNode;
  sidebarSectionSeparators: React.ReactNode;
  tableHeaderColor: React.ReactNode;
  tableHeaderTextColor: React.ReactNode;
  tableBorderColor: React.ReactNode;
  inputBorderWidth: React.ReactNode;
  /** Per-token display labels keyed by `ThemeCustomizerTokenKey`. */
  tokens: Partial<NThemeCustomizerTokenLabels>;
  /** Localized labels for the enum-style options. */
  options: Partial<NThemeCustomizerOptionLabels>;
}

export interface NThemeCustomizerProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  previewMode: NajmMode;
  onPreviewModeChange: (mode: NajmMode) => void;
  /** Whether to show the light/dark preview-mode control in the theme tab. */
  showPreviewMode?: boolean;
  /**
   * Whether to render the internal Theme/Typography tab bar. Defaults to `true`.
   * When `false`, the first resolved entry from `tabs` is rendered directly so
   * a host application can present a single section inside its own tabs.
   */
  showTabs?: boolean;
  tabs?: readonly NThemeCustomizerTab[];
  fontOptions?: readonly NThemeCustomizerFontOption[];
  labels?: Partial<NThemeCustomizerLabels>;
  disabled?: boolean;
  className?: string;
}

// Re-exported here so consumers can import the public type without
// reaching into the design-types path.
import type { NajmDesignConfig } from "../../theme/design-types";
import type { NajmMode } from "../../theme/types";
