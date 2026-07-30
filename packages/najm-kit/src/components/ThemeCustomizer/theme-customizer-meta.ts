import type { ThemeCustomizerTokenKey } from "./theme-customizer-config";

export interface ThemeTokenGroup {
  id: ThemeTokenGroupId;
  label: string;
  tokens: readonly ThemeCustomizerTokenKey[];
}

export type ThemeTokenGroupId =
  | "surface"
  | "brand"
  | "feedback"
  | "border-focus"
  | "sidebar"
  | "charts";

export const THEME_TOKEN_GROUPS: readonly ThemeTokenGroup[] = [
  {
    id: "surface",
    label: "Surface",
    tokens: [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "muted",
      "muted-foreground",
      "destructive",
      "destructive-foreground",
    ],
  },
  {
    id: "brand",
    label: "Brand",
    tokens: [
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "tertiary",
      "tertiary-foreground",
      "accent",
      "accent-foreground",
    ],
  },
  {
    id: "border-focus",
    label: "Border & Focus",
    tokens: ["border", "input", "ring"],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    tokens: [
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ],
  },
  {
    id: "charts",
    label: "Charts",
    tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
];

const TOKEN_LABEL_OVERRIDES: Partial<Record<ThemeCustomizerTokenKey, string>> = {
  foreground: "Text",
  "card-foreground": "Card text",
  "popover-foreground": "Popover text",
  "primary-foreground": "Primary text",
  "secondary-foreground": "Secondary text",
  "tertiary-foreground": "Tertiary text",
  "muted-foreground": "Muted text",
  "accent-foreground": "Accent text",
  "destructive-foreground": "Destructive text",
  sidebar: "Sidebar background",
  "sidebar-foreground": "Sidebar text",
  "sidebar-primary": "Active item",
  "sidebar-primary-foreground": "Active text",
  "sidebar-accent": "Hover item",
  "sidebar-accent-foreground": "Hover text",
  "sidebar-border": "Sidebar border",
  "sidebar-ring": "Sidebar focus",
  "chart-1": "Series 1",
  "chart-2": "Series 2",
  "chart-3": "Series 3",
  "chart-4": "Series 4",
  "chart-5": "Series 5",
};

export function humanizeTokenKey(key: ThemeCustomizerTokenKey): string {
  return (
    TOKEN_LABEL_OVERRIDES[key] ??
    String(key)
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export const DEFAULT_TOKEN_LABELS = Object.fromEntries(
  (Object.keys(TOKEN_LABEL_OVERRIDES) as ThemeCustomizerTokenKey[]).map((key) => [
    key,
    humanizeTokenKey(key),
  ]),
) as Record<ThemeCustomizerTokenKey, string>;

export const DEFAULT_LABELS: Record<string, string> = {
  themeTab: "Theme",
  typographyTab: "Typography",
  lightMode: "Light",
  darkMode: "Dark",
  resetField: "Reset",
  resetSection: "Reset section",
  importTheme: "Import",
  exportTheme: "Export",
  invalidThemeFile: "Invalid theme file",
  colorSwatchFallback: "Color",
  defaultOption: "Default",
  themeSection: "Theme",
  typographySection: "Typography",
  layoutSubsection: "Layout",
  pageHeaderSubsection: "Page Header",
  sidebarSubsection: "Sidebar",
  tableSubsection: "Table",
  inputSubsection: "Input",
  previewMode: "Preview mode",
  surfaceGroup: "Surface",
  brandGroup: "Brand",
  feedbackGroup: "Feedback",
  borderFocusGroup: "Border & Focus",
  sidebarGroup: "Sidebar",
  chartsGroup: "Charts",
  globalRadius: "Radius",
  globalBorderWidth: "Border width",
  fontSans: "Font",
  fontHeading: "Heading font",
  fontMono: "Mono font",
  advancedTypography: "Advanced typography",
  baseSize: "Base size",
  scale: "Scale",
  lineHeight: "Line height",
  letterSpacing: "Letter spacing",
  pageGutter: "Page gutter",
  sectionGap: "Section gap",
  pageHeaderCard: "Page header as card",
  sidebarSections: "Sidebar sections",
  sidebarNoSections: "None",
  sidebarSectionLabels: "Labels",
  sidebarSectionSeparators: "Separators",
  sidebarExpandedWidth: "Expanded width",
  sidebarCollapsedWidth: "Collapsed width",
  sidebarMobileWidth: "Mobile width",
  tableHeaderColor: "Table header color",
  tableHeaderTextColor: "Table header text",
  tableBorderColor: "Table border",
  inputBorderWidth: "Input border width",
};

export const DEFAULT_OPTION_LABELS = {
  scale: {
    compact: "Compact",
    default: "Standard",
    comfortable: "Comfortable",
  },
} as const;
