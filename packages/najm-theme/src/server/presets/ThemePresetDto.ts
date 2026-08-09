// ============================================================================
// najm-theme/server — theme preset request schemas
// ============================================================================

import { z } from "zod";

import { THEME_PRESET_NAME_MAX_LENGTH } from "../../contracts/presets";
import { expectedRevisionSchema } from "../appearance/AppearanceDto";

/**
 * Bounded here as well as in `assertThemePresetName`.
 *
 * Not redundant: this rejects a megabyte of text before it reaches a trim and a
 * normalize, and the contract check is what any non-HTTP caller (an MCP tool, a
 * consumer's data migration) still goes through.
 */
export const createThemePresetDto = z.object({
  name: z.string().min(1).max(THEME_PRESET_NAME_MAX_LENGTH * 4),
  designConfig: z.unknown(),
});

export const applyThemePresetDto = z.object({
  expectedRevision: expectedRevisionSchema,
});

/**
 * A UUID, matching what both dialects generate. Checking the shape here means a
 * malformed id is a 400 rather than a database error on PostgreSQL and a silent
 * empty result on SQLite — two dialects answering differently is exactly what
 * this package exists to prevent.
 */
export const themePresetIdParam = z.object({
  id: z.string().uuid(),
});

export type CreateThemePresetDto = z.infer<typeof createThemePresetDto>;
export type ApplyThemePresetDto = z.infer<typeof applyThemePresetDto>;
export type ThemePresetIdParam = z.infer<typeof themePresetIdParam>;
