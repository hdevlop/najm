import { describe, expect, it } from "bun:test";

import {
  THEME_PRESET_NAME_MAX_LENGTH,
  THEME_PRESET_SLUG_MAX_LENGTH,
  assertThemePresetName,
  isPublicThemePreset,
  themePresetSlug,
  uniqueThemePresetSlug,
} from "../../src/contracts/presets";

describe("assertThemePresetName", () => {
  it("trims and returns", () => {
    expect(assertThemePresetName("  Winter  ")).toBe("Winter");
  });

  it("rejects blank, whitespace-only, and non-string names", () => {
    expect(() => assertThemePresetName("")).toThrow(/must not be blank/);
    expect(() => assertThemePresetName("   ")).toThrow(/must not be blank/);
    expect(() => assertThemePresetName(42)).toThrow(/must be a string/);
  });

  it("rejects a name past the ceiling, measured after trimming", () => {
    const name = "x".repeat(THEME_PRESET_NAME_MAX_LENGTH + 1);
    expect(() => assertThemePresetName(name)).toThrow(/at most/);
    expect(assertThemePresetName(`  ${"x".repeat(THEME_PRESET_NAME_MAX_LENGTH)}  `)).toHaveLength(
      THEME_PRESET_NAME_MAX_LENGTH,
    );
  });
});

describe("themePresetSlug", () => {
  it("slugs a Latin name the obvious way", () => {
    expect(themePresetSlug("Winter Theme 2026")).toBe("winter-theme-2026");
  });

  it("collapses runs of punctuation into one separator", () => {
    expect(themePresetSlug("Dark  ---  Blue!!!")).toBe("dark-blue");
  });

  it("keeps Arabic, Cyrillic, and CJK names instead of erasing them", () => {
    expect(themePresetSlug("مظهر الشتاء")).toBe("مظهر-الشتاء");
    expect(themePresetSlug("Тёмная тема")).toBe("тёмная-тема");
    expect(themePresetSlug("冬のテーマ")).toBe("冬のテーマ");
  });

  it("is deterministic", () => {
    expect(themePresetSlug("Winter Theme")).toBe(themePresetSlug("Winter Theme"));
  });

  it("normalizes so two visually identical names cannot both be stored", () => {
    const composed = "Café";
    const decomposed = "Café";
    expect(composed).not.toBe(decomposed);
    expect(themePresetSlug(composed)).toBe(themePresetSlug(decomposed));
  });

  it("folds compatibility forms that would otherwise look like new slugs", () => {
    // Fullwidth Latin — a copy/paste hazard from CJK input methods.
    expect(themePresetSlug("Ｗｉｎｔｅｒ")).toBe("winter");
  });

  it("emits nothing for a name that is only punctuation", () => {
    expect(themePresetSlug("!!!")).toBe("");
    expect(themePresetSlug("---")).toBe("");
  });

  it("never emits a leading or trailing separator, even after truncation", () => {
    const long = `${"a".repeat(THEME_PRESET_SLUG_MAX_LENGTH - 1)} tail`;
    const slug = themePresetSlug(long);
    expect(slug.length).toBeLessThanOrEqual(THEME_PRESET_SLUG_MAX_LENGTH);
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueThemePresetSlug", () => {
  it("returns the base when it is free", () => {
    expect(uniqueThemePresetSlug("winter", new Set())).toBe("winter");
  });

  it("suffixes past collisions", () => {
    expect(uniqueThemePresetSlug("winter", new Set(["winter"]))).toBe("winter-2");
    expect(uniqueThemePresetSlug("winter", new Set(["winter", "winter-2"]))).toBe("winter-3");
  });

  it("substitutes a usable root when the name slugged to nothing", () => {
    expect(uniqueThemePresetSlug("", new Set())).toBe("preset");
    expect(uniqueThemePresetSlug("", new Set(["preset"]))).toBe("preset-2");
  });

  it("keeps the suffixed slug inside the length ceiling", () => {
    const base = "a".repeat(THEME_PRESET_SLUG_MAX_LENGTH);
    const slug = uniqueThemePresetSlug(base, new Set([base]));
    expect(slug.length).toBeLessThanOrEqual(THEME_PRESET_SLUG_MAX_LENGTH);
  });
});

describe("isPublicThemePreset", () => {
  const preset = {
    id: "1f0f9f34-6c2e-4f36-9a3d-9c0f5c4b1e2a",
    scopeId: "platform",
    slug: "winter",
    name: "Winter",
    designConfig: { version: 1, theme: {} },
    isBuiltIn: false,
    createdAt: "2026-08-09T00:00:00.000Z",
  };

  it("accepts a complete row", () => {
    expect(isPublicThemePreset(preset)).toBe(true);
  });

  it("rejects a row with a bad scope, slug, or missing field", () => {
    expect(isPublicThemePreset({ ...preset, scopeId: "../other" })).toBe(false);
    expect(isPublicThemePreset({ ...preset, slug: "" })).toBe(false);
    expect(isPublicThemePreset({ ...preset, isBuiltIn: "yes" })).toBe(false);
    expect(isPublicThemePreset(null)).toBe(false);
  });
});
