// ============================================================================
// najm-theme — dialect-independent schema facts
// ============================================================================
//
// Table names, column defaults, and the row shapes services read. Both dialect
// modules import this, which is what keeps "the SQLite schema drifted from the
// PostgreSQL one" from being a thing that can happen quietly: a rename here is
// a rename in both, and the parity test compares the two exported schemas
// column by column.
// ============================================================================

import type { NajmDesignConfig } from "najm-kit/server";

import type { BrandingSlotConfig } from "../contracts/branding";

/**
 * Prefixed, and not `theme_appearance`.
 *
 * These tables get spread into a consumer's own schema object beside its
 * product tables. `najm_theme_` is long enough that a collision with an
 * application's own naming is not something anybody has to think about.
 */
export const APPEARANCE_TABLE = "najm_theme_appearance";
export const BRANDING_TABLE = "najm_theme_branding";
export const PRESETS_TABLE = "najm_theme_presets";

/** Timestamps are ISO 8601 strings in both dialects. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Row shapes as the services see them.
 *
 * Declared here rather than inferred from one dialect's table, so a repository
 * written against these compiles for both — and so a column that exists in only
 * one dialect fails to type-check instead of failing at runtime on the other.
 */
export interface AppearanceRow {
  scopeId: string;
  /** `null` means "no stored design"; the factory design is served. */
  designConfig: NajmDesignConfig | null;
  revision: number;
  updatedByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandingRow {
  scopeId: string;
  slotConfig: BrandingSlotConfig;
  revision: number;
  updatedByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThemePresetRow {
  id: string;
  scopeId: string;
  slug: string;
  name: string;
  designConfig: NajmDesignConfig;
  isBuiltIn: boolean;
  createdByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}
