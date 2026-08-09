// ============================================================================
// najm-theme/sqlite — SQLite schema
// ============================================================================
//
// Column-for-column equivalent to `najm-theme/pg`: same table names, same
// column names, same nullability, same constraints, same public behaviour. The
// dialect parity test in `test/database` compares the two exported schemas
// rather than trusting this comment.
//
// Three differences are dialect facts, not behaviour changes:
//
// - JSON is `text(..., { mode: "json" })` instead of `jsonb`. Drizzle
//   serializes on write and parses on read, so a repository sees an object
//   either way.
// - Booleans are `integer(..., { mode: "boolean" })`, which SQLite has no
//   native type for.
// - `id` defaults through `crypto.randomUUID()` in the driver rather than
//   PostgreSQL's `gen_random_uuid()`. Both produce a v4 UUID string.
// ============================================================================

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { NajmDesignConfig } from "najm-kit/server";

import type { BrandingSlotConfig } from "../contracts/branding";
import {
  APPEARANCE_TABLE,
  BRANDING_TABLE,
  PRESETS_TABLE,
  nowIso,
} from "./shared";

/** See `najm-theme/pg` for why `design_config` is nullable and what it means. */
export const najmThemeAppearance = sqliteTable(
  APPEARANCE_TABLE,
  {
    scopeId: text("scope_id").primaryKey(),
    designConfig: text("design_config", { mode: "json" }).$type<NajmDesignConfig | null>(),
    revision: integer("revision").notNull().default(1),
    updatedByActorId: text("updated_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    check("najm_theme_appearance_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const najmThemeBranding = sqliteTable(
  BRANDING_TABLE,
  {
    scopeId: text("scope_id").primaryKey(),
    slotConfig: text("slot_config", { mode: "json" })
      .$type<BrandingSlotConfig>()
      .notNull()
      .default(sql`'{}'`),
    revision: integer("revision").notNull().default(1),
    updatedByActorId: text("updated_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    check("najm_theme_branding_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const najmThemePresets = sqliteTable(
  PRESETS_TABLE,
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    scopeId: text("scope_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    designConfig: text("design_config", { mode: "json" }).$type<NajmDesignConfig>().notNull(),
    isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
    createdByActorId: text("created_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex("najm_theme_presets_scope_slug_idx").on(table.scopeId, table.slug),
    index("najm_theme_presets_scope_created_idx").on(table.scopeId, table.createdAt),
  ],
);

/** Enable Appearance alone. */
export const appearanceSchema = { najmThemeAppearance } as const;
/** Enable Branding alone. */
export const brandingSchema = { najmThemeBranding } as const;
/** Enable Presets alone — note that the feature also requires Appearance. */
export const themePresetSchema = { najmThemePresets } as const;

/** Every table, for the common case of enabling the whole package. */
export const themeSchema = {
  ...appearanceSchema,
  ...brandingSchema,
  ...themePresetSchema,
} as const;

export type ThemeSchema = typeof themeSchema;

export type AppearanceEntity = typeof najmThemeAppearance.$inferSelect;
export type NewAppearanceEntity = typeof najmThemeAppearance.$inferInsert;
export type BrandingEntity = typeof najmThemeBranding.$inferSelect;
export type NewBrandingEntity = typeof najmThemeBranding.$inferInsert;
export type ThemePresetEntity = typeof najmThemePresets.$inferSelect;
export type NewThemePresetEntity = typeof najmThemePresets.$inferInsert;
