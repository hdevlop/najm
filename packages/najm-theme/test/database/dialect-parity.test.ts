import { describe, expect, it } from "bun:test";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

import * as pg from "../../src/schema/pg";
import * as sqlite from "../../src/schema/sqlite";
import {
  APPEARANCE_TABLE,
  BRANDING_TABLE,
  PRESETS_TABLE,
} from "../../src/schema/shared";

// ============================================================================
// The one test that keeps two dialects from drifting.
//
// "Equivalent schemas" is easy to write in a plan and easy to lose in a
// follow-up commit that adds a column to whichever dialect the author happened
// to be running. Comparing the two definitions structurally means the drift
// fails here rather than in the consumer that picked the other database.
// ============================================================================

interface ColumnShape {
  name: string;
  notNull: boolean;
  primary: boolean;
  hasDefault: boolean;
}

function pgShape(table: Parameters<typeof getPgTableConfig>[0]) {
  const config = getPgTableConfig(table);
  return {
    name: config.name,
    columns: config.columns
      .map<ColumnShape>((column) => ({
        name: column.name,
        notNull: column.notNull,
        primary: column.primary,
        hasDefault: column.hasDefault,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    indexes: config.indexes
      .map((index) => {
        const built = index.config;
        return {
          name: built.name,
          unique: built.unique,
          columns: (built.columns ?? [])
            .map((column) => (column as { name?: string }).name ?? "")
            .join(","),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
    checks: config.checks.map((check) => check.name).sort(),
  };
}

function sqliteShape(table: Parameters<typeof getSqliteTableConfig>[0]) {
  const config = getSqliteTableConfig(table);
  return {
    name: config.name,
    columns: config.columns
      .map<ColumnShape>((column) => ({
        name: column.name,
        notNull: column.notNull,
        primary: column.primary,
        hasDefault: column.hasDefault,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    indexes: config.indexes
      .map((index) => {
        const built = index.config;
        return {
          name: built.name,
          unique: built.unique,
          columns: (built.columns ?? [])
            .map((column) => (column as { name?: string }).name ?? "")
            .join(","),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
    checks: config.checks.map((check) => check.name).sort(),
  };
}

const PAIRS = [
  ["appearance", pg.najmThemeAppearance, sqlite.najmThemeAppearance],
  ["branding", pg.najmThemeBranding, sqlite.najmThemeBranding],
  ["presets", pg.najmThemePresets, sqlite.najmThemePresets],
] as const;

describe("dialect parity", () => {
  for (const [label, pgTable, sqliteTable] of PAIRS) {
    it(`${label}: same table name, columns, nullability, defaults, indexes, and checks`, () => {
      expect(sqliteShape(sqliteTable)).toEqual(pgShape(pgTable));
    });
  }

  it("exports the same feature-schema keys from both dialects", () => {
    expect(Object.keys(sqlite.themeSchema).sort()).toEqual(Object.keys(pg.themeSchema).sort());
    expect(Object.keys(sqlite.appearanceSchema)).toEqual(Object.keys(pg.appearanceSchema));
    expect(Object.keys(sqlite.brandingSchema)).toEqual(Object.keys(pg.brandingSchema));
    expect(Object.keys(sqlite.themePresetSchema)).toEqual(Object.keys(pg.themePresetSchema));
  });
});

describe("feature schema composition", () => {
  it("lets a consumer enable Appearance without creating Branding or Presets tables", () => {
    expect(Object.keys(pg.appearanceSchema)).toEqual(["najmThemeAppearance"]);
    expect(Object.keys(sqlite.appearanceSchema)).toEqual(["najmThemeAppearance"]);
  });

  it("composes into the combined schema without overlap", () => {
    const combined = [
      ...Object.keys(pg.appearanceSchema),
      ...Object.keys(pg.brandingSchema),
      ...Object.keys(pg.themePresetSchema),
    ];
    expect(new Set(combined).size).toBe(combined.length);
    expect(Object.keys(pg.themeSchema).sort()).toEqual(combined.sort());
  });
});

describe("table naming", () => {
  it("uses the package prefix so the tables can be spread into any app schema", () => {
    expect(getPgTableConfig(pg.najmThemeAppearance).name).toBe(APPEARANCE_TABLE);
    expect(getPgTableConfig(pg.najmThemeBranding).name).toBe(BRANDING_TABLE);
    expect(getPgTableConfig(pg.najmThemePresets).name).toBe(PRESETS_TABLE);
    for (const name of [APPEARANCE_TABLE, BRANDING_TABLE, PRESETS_TABLE]) {
      expect(name.startsWith("najm_theme_")).toBe(true);
    }
  });
});

describe("constraints", () => {
  it("keeps the revision column positive in both dialects", () => {
    expect(getPgTableConfig(pg.najmThemeAppearance).checks.map((check) => check.name)).toContain(
      "najm_theme_appearance_revision_positive",
    );
    expect(
      getSqliteTableConfig(sqlite.najmThemeAppearance).checks.map((check) => check.name),
    ).toContain("najm_theme_appearance_revision_positive");
  });

  it("makes (scope_id, slug) unique so two concurrent creates cannot both land", () => {
    const pgIndex = getPgTableConfig(pg.najmThemePresets).indexes.find(
      (index) => index.config.name === "najm_theme_presets_scope_slug_idx",
    );
    expect(pgIndex?.config.unique).toBe(true);
    expect(pgIndex?.config.columns?.map((column) => (column as { name: string }).name)).toEqual([
      "scope_id",
      "slug",
    ]);
  });

  it("does not reference an auth table, so auth stays optional", () => {
    for (const table of [pg.najmThemeAppearance, pg.najmThemeBranding, pg.najmThemePresets]) {
      expect(getPgTableConfig(table).foreignKeys).toHaveLength(0);
    }
  });
});
