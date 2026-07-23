import type { NajmThemeConfig } from "./types";

export type NajmDensity = "compact" | "default" | "comfortable";
/** Tailwind's mobile-first viewport breakpoints, plus the default value. */
export type NajmResponsiveBreakpoint = "base" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * A scalar value for every viewport, or mobile-first breakpoint overrides.
 * For example: `{ base: 164, lg: 200, xl: 240 }`.
 */
export type NajmResponsiveValue<T> =
  | T
  | Partial<Record<NajmResponsiveBreakpoint, T>>;

export type NajmComponentRadius =
  | "inherit"
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "full"
  | string;

export interface NajmSlotStyle {
  className?: string;
  radius?: NajmComponentRadius;
  borderWidth?: string;
  padding?: string;
  paddingTop?: string;
}

export interface NajmVariantStyle {
  /** Reuse another variant's recipe. Example: primary badge uses secondary. */
  use?: string;
  className?: string;
  tokens?: Record<string, string>;
}

export interface NajmComponentStyleConfig {
  /** Render components that support it as a card-like surface. */
  card?: boolean;
  /** Sidebar-only: render section titles above grouped nav items. */
  showSectionLabels?: boolean;
  /** Sidebar-only: render separator lines between nav item sections. */
  showSectionSeparators?: boolean;
  /** Sidebar-only: expanded width in px (default 240). Supports responsive overrides. */
  expandedWidth?: NajmResponsiveValue<number>;
  /** Sidebar-only: collapsed width in px (default 64). Supports responsive overrides. */
  collapsedWidth?: NajmResponsiveValue<number>;
  /** Sidebar-only: mobile drawer width in px. Defaults to the expanded width. */
  mobileWidth?: NajmResponsiveValue<number>;
  defaultVariant?: string;
  defaultSize?: string;
  density?: NajmDensity;
  /** NTable-only: CSS color used for the table header and add button. */
  headerColor?: string;
  /** NTable-only: CSS color used for table header text and add button text. */
  headerTextColor?: string;
  /** NTable-only: CSS color used for table container and row borders. */
  borderColor?: string;
  radius?: NajmComponentRadius;
  borderWidth?: string;
  slots?: Record<string, NajmSlotStyle>;
  variants?: Record<string, NajmVariantStyle>;
}

export type NajmComponentName =
  | "button"
  | "badge"
  | "card"
  | "table"
  | "tabs"
  | "dialog"
  | "alert"
  | "sidebar"
  | "pageHeader"
  | "input"
  | "select"
  | "dropdown"
  | "sheet"
  | "popover"
  | "tooltip"
  | "progress"
  | "avatar";

export type NajmComponentThemeConfig = Partial<
  Record<NajmComponentName, NajmComponentStyleConfig>
>;

export interface NajmTypographyConfig {
  fontSans?: string;
  fontHeading?: string;
  fontMono?: string;
  baseSize?: string;
  scale?: "compact" | "default" | "comfortable";
  lineHeight?: string;
  letterSpacing?: string;
}

export interface NajmLayoutConfig {
  /** Page inline padding, usually used by NPageLayout. */
  pageGutter?: string;
  /** Vertical page padding and stacked section gap, usually used by NPageLayout. */
  sectionGap?: string;
}

export interface NajmDesignConfig {
  version: 1;
  theme: NajmThemeConfig;
  typography?: NajmTypographyConfig;
  components?: NajmComponentThemeConfig;
  layout?: NajmLayoutConfig;
}

export const NAJM_COMPONENT_NAMES: readonly NajmComponentName[] = [
  "button",
  "badge",
  "card",
  "table",
  "tabs",
  "dialog",
  "alert",
  "sidebar",
  "pageHeader",
  "input",
  "select",
  "dropdown",
  "sheet",
  "popover",
  "tooltip",
  "progress",
  "avatar",
];

/** Maps a NajmComponentRadius keyword to a CSS value (or var). */
export const RADIUS_VALUE_MAP: Record<string, string> = {
  none: "0",
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  full: "9999px",
};

export function resolveRadiusValue(
  radius: NajmComponentRadius | undefined,
): string | undefined {
  if (!radius || radius === "inherit") return undefined;
  return RADIUS_VALUE_MAP[radius] ?? radius;
}
