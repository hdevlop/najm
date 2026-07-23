import type { NajmThemeTokens } from "najm-kit";

export type TokenKey = keyof NajmThemeTokens;

export type TokenCategoryId =
  | "foundation"
  | "sidebar"
  | "table"
  | "charts";

export interface TokenCategory {
  id: TokenCategoryId;
  label: string;
  tokens: TokenKey[];
  advancedTokens?: TokenKey[];
}

export const TOKEN_CATEGORIES: TokenCategory[] = [
  {
    id: "foundation",
    label: "Foundation",
    tokens: [
      "background",
      "foreground",
      "card",
      "primary",
      "secondary",
      "accent",
      "destructive",
      "muted",
      "border",
    ],
    advancedTokens: [
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary-foreground",
      "secondary-foreground",
      "tertiary",
      "tertiary-foreground",
      "accent-foreground",
      "destructive-foreground",
      "muted-foreground",
      "input",
      "ring",
    ],
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
    id: "table",
    label: "Table",
    tokens: [],
  },
  {
    id: "charts",
    label: "Charts",
    tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
];

const TOKEN_LABELS: Partial<Record<TokenKey, string>> = {
  foreground: "Text",
  sidebar: "Background",
  "sidebar-foreground": "Text",
  "sidebar-primary": "Active Item",
  "sidebar-primary-foreground": "Active Text",
  "sidebar-accent": "Hover Item",
  "sidebar-accent-foreground": "Hover Text",
  "sidebar-border": "Border",
  "sidebar-ring": "Focus Ring",
  "chart-1": "Primary series",
  "chart-2": "Secondary series",
  "chart-3": "Tertiary series",
  "chart-4": "Fourth series",
  "chart-5": "Fifth series",
};

export const CHART_TOKENS: TokenKey[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

export const CHART_TOKEN_DEFAULTS: Partial<Record<TokenKey, TokenKey>> = {
  "chart-1": "primary",
  "chart-2": "secondary",
  "chart-3": "tertiary",
  "chart-4": "accent",
  "chart-5": "destructive",
};

export function tokenLabel(key: TokenKey): string {
  const alias = TOKEN_LABELS[key];
  if (alias) return alias;

  return String(key)
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
