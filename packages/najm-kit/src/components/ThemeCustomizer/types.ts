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
  importTheme: React.ReactNode;
  exportTheme: React.ReactNode;
  invalidThemeFile: React.ReactNode;
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
  sidebarSections: React.ReactNode;
  sidebarNoSections: React.ReactNode;
  sidebarSectionLabels: React.ReactNode;
  sidebarSectionSeparators: React.ReactNode;
  sidebarExpandedWidth: React.ReactNode;
  sidebarCollapsedWidth: React.ReactNode;
  sidebarMobileWidth: React.ReactNode;
  tableHeaderColor: React.ReactNode;
  tableHeaderTextColor: React.ReactNode;
  tableBorderColor: React.ReactNode;
  inputBorderWidth: React.ReactNode;
  /** Per-token display labels keyed by `ThemeCustomizerTokenKey`. */
  tokens: Partial<NThemeCustomizerTokenLabels>;
  /** Localized labels for the enum-style options. */
  options: Partial<NThemeCustomizerOptionLabels>;
}

/** A named design the host has stored somewhere and can restore later. */
export interface NThemePreset {
  id: string;
  name: string;
  design: NajmDesignConfig;
  /** Marks a preset the host ships rather than one the user created. */
  isBuiltIn?: boolean;
}

export type NThemePresetsStatus = "idle" | "loading" | "error";

export interface NThemePresetsLabels {
  title: React.ReactNode;
  description: React.ReactNode;
  empty: React.ReactNode;
  loadError: React.ReactNode;
  select: React.ReactNode;
  selectPlaceholder: React.ReactNode;
  /** Row that restores the host's currently stored design. */
  savedOption: React.ReactNode;
  saveCurrent: React.ReactNode;
  saveTitle: React.ReactNode;
  saveDescription: React.ReactNode;
  saveAction: React.ReactNode;
  nameLabel: React.ReactNode;
  namePlaceholder: React.ReactNode;
  delete: React.ReactNode;
  deleteTitle: React.ReactNode;
  /** Supports a `{name}` placeholder. */
  deleteDescription: React.ReactNode;
  cancel: React.ReactNode;
}

export interface NThemePresetsProps {
  presets: readonly NThemePreset[];
  /** `null` means the host's stored design is showing, not a preset. */
  selectedPresetId?: string | null;
  /** Shown as the first row so the user can drop a preview. Omit to hide it. */
  savedDesign?: NajmDesignConfig;
  status?: NThemePresetsStatus;
  /** Receives `null` when the user picks the stored-design row. */
  onSelect: (preset: NThemePreset | null) => void;
  /** Omit to hide the save control. */
  onSave?: (name: string) => void | Promise<void>;
  /** Omit to hide every delete control. */
  onDelete?: (preset: NThemePreset) => void | Promise<void>;
  labels: NThemePresetsLabels;
  disabled?: boolean;
  className?: string;
}

export interface NThemeCustomizerProps {
  value: NajmDesignConfig;
  factoryValue: NajmDesignConfig;
  onChange: (value: NajmDesignConfig) => void;
  /** Overrides the active mode inherited from the nearest Najm theme provider. */
  previewMode?: NajmMode;
  /** Handles the opt-in internal light/dark control in standalone editors. */
  onPreviewModeChange?: (mode: NajmMode) => void;
  /** Whether to show the internal light/dark control. Defaults to `false`. */
  showPreviewMode?: boolean;
  /** Whether to show JSON import/export actions. Defaults to `true`. */
  showFileActions?: boolean;
  /** Whether to show the internal section reset action. Defaults to `true`. */
  showResetAction?: boolean;
  /** Download filename used by the Export action. Defaults to `najm-theme.json`. */
  exportFileName?: string;
  /** Receives strict JSON parsing or design-contract validation failures. */
  onImportError?: (error: Error) => void;
  /**
   * Whether to render the internal Theme/Typography tab bar. Defaults to `true`.
   * When `false`, the first resolved entry from `tabs` is rendered directly so
   * a host application can present a single section inside its own tabs.
   */
  showTabs?: boolean;
  tabs?: readonly NThemeCustomizerTab[];
  fontOptions?: readonly NThemeCustomizerFontOption[];
  labels?: Partial<NThemeCustomizerLabels>;
  /**
   * Saved designs offered above the editor. Provide this plus `onPresetSelect`
   * to render the picker; the customizer stays presentational and never stores
   * a preset itself.
   */
  presets?: readonly NThemePreset[];
  selectedPresetId?: string | null;
  presetsStatus?: NThemePresetsStatus;
  /**
   * The design the host currently has stored, offered as the "current saved
   * theme" row so a preview can be dropped. Defaults to `factoryValue`, which
   * is only correct when the host has not persisted anything of its own.
   */
  savedDesign?: NajmDesignConfig;
  onPresetSelect?: (preset: NThemePreset | null) => void;
  onPresetSave?: (name: string) => void | Promise<void>;
  onPresetDelete?: (preset: NThemePreset) => void | Promise<void>;
  presetLabels?: Partial<NThemePresetsLabels>;
  disabled?: boolean;
  className?: string;
}

// Re-exported here so consumers can import the public type without
// reaching into the design-types path.
import type { NajmDesignConfig } from "../../theme/design-types";
import type { NajmMode } from "../../theme/types";
