import { parseNajmDesignConfig } from "../../theme/design-config";
import type { NajmDesignConfig } from "../../theme/design-types";

export const DEFAULT_THEME_FILE_NAME = "najm-theme.json";

export function parseThemeFile(content: string): NajmDesignConfig {
  return parseNajmDesignConfig(JSON.parse(content) as unknown);
}

export function stringifyThemeFile(config: NajmDesignConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function normalizeThemeFileName(fileName: string | undefined): string {
  const trimmed = fileName?.trim();
  if (!trimmed) return DEFAULT_THEME_FILE_NAME;
  return trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;
}
