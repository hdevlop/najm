export const DEFAULT_TABLE_HEADER_COLOR = "var(--primary)";
export const DEFAULT_TABLE_HEADER_TEXT_COLOR = "var(--primary-foreground)";
export const DEFAULT_TABLE_BORDER_COLOR = "var(--border)";

const THEME_COLOR_TOKENS = new Set([
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "tertiary",
  "tertiary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
]);

export const TABLE_HEADER_COLOR_PRESETS = {
  primary: DEFAULT_TABLE_HEADER_COLOR,
  violet: "#7c3aed",
  blue: "#2563eb",
  emerald: "#059669",
  amber: "#f59e0b",
  rose: "#e11d48",
  slate: "#475569",
} as const;

export type TableHeaderColor = keyof typeof TABLE_HEADER_COLOR_PRESETS;

export function resolveTableColor(value: string | undefined, fallback: string): string {
  const color = value?.trim();
  if (!color) return fallback;
  if (color in TABLE_HEADER_COLOR_PRESETS) {
    return TABLE_HEADER_COLOR_PRESETS[color as TableHeaderColor];
  }
  if (THEME_COLOR_TOKENS.has(color)) {
    return `var(--${color})`;
  }
  return color;
}
