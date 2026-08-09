// ============================================================================
// najm-theme/pg — PostgreSQL schema
// ============================================================================
//
// Three independent feature schemas plus a convenience composition. A consumer
// that enabled Appearance alone spreads `appearanceSchema` and gets one table;
// spreading `themeSchema` there would create a branding table nothing writes to
// and a presets table nothing reads.
//
// There is no runtime `CREATE TABLE` anywhere in this package. These are
// Drizzle table objects a consumer composes into its own schema and migrates
// with its own workflow — the same contract `najm-auth/pg` and
// `najm-storage/pg` already hold to.
// ============================================================================

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { NajmDesignConfig } from "najm-kit/server";

import type { BrandingSlotConfig } from "../contracts/branding";
import {
  APPEARANCE_TABLE,
  BRANDING_TABLE,
  PRESETS_TABLE,
  nowIso,
} from "./shared";

/**
 * One row per scope.
 *
 * `design_config` is nullable and that is a meaningful state, not a missing
 * one: `null` says "this scope is on the factory design", which is different
 * from an empty object (a design with no tokens) and different from the row not
 * existing (nothing has ever been saved). Reset writes `null` deliberately and
 * still increments the revision, so a client editing the previous design gets a
 * conflict rather than silently re-saving over the reset.
 */
export const najmThemeAppearance = pgTable(
  APPEARANCE_TABLE,
  {
    scopeId: text("scope_id").primaryKey(),
    designConfig: jsonb("design_config").$type<NajmDesignConfig | null>(),
    revision: integer("revision").notNull().default(1),
    // Text, with no foreign key to an auth table on purpose. Attribution stays
    // available when `najm-auth` is installed without making it a dependency —
    // and a deleted user must not cascade a scope's whole theme away.
    updatedByActorId: text("updated_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    check("najm_theme_appearance_revision_positive", sql`${table.revision} > 0`),
  ],
);

/**
 * One row per scope, holding only the *custom* slot map.
 *
 * Inherited and factory values are resolved at read time rather than
 * materialized here. Storing them would freeze a factory path into the database
 * on first save, so the next deployment that ships a new default logo would
 * change nothing for any scope that had ever touched branding.
 */
export const najmThemeBranding = pgTable(
  BRANDING_TABLE,
  {
    scopeId: text("scope_id").primaryKey(),
    slotConfig: jsonb("slot_config")
      .$type<BrandingSlotConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    revision: integer("revision").notNull().default(1),
    updatedByActorId: text("updated_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    check("najm_theme_branding_revision_positive", sql`${table.revision} > 0`),
  ],
);

export const najmThemePresets = pgTable(
  PRESETS_TABLE,
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeId: text("scope_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    designConfig: jsonb("design_config").$type<NajmDesignConfig>().notNull(),
    isBuiltIn: boolean("is_built_in").notNull().default(false),
    createdByActorId: text("created_by_actor_id"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    // The uniqueness guarantee. The service's pre-check is advisory — two
    // concurrent creates can both pass it, and this is what decides.
    uniqueIndex("najm_theme_presets_scope_slug_idx").on(table.scopeId, table.slug),
    // Every list is scoped and ordered by creation; one index serves both.
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
