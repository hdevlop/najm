import type { NajmThemeTokens } from "najm-kit";

export type TokenKey = keyof NajmThemeTokens;

export type TokenCategoryId =
  | "foundation"
  | "sidebar"
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
    id: "charts",
    label: "Charts",
    tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
];

const TOKEN_LABELS: Partial<Record<TokenKey, string>> = {
  foreground: "Text",
};

export const CHART_TOKENS: TokenKey[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

export function tokenLabel(key: TokenKey): string {
  const alias = TOKEN_LABELS[key];
  if (alias) return alias;

  return String(key)
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
