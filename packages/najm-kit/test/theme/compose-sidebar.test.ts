import { describe, test, expect } from "bun:test";
import { composePreset } from "../../src/theme/presets/compose";
import { accents } from "../../src/theme/presets/accents";
import { lightMode, darkMode } from "../../src/theme/presets/modes";

const SIDEBAR_BASE_KEYS = [
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
] as const;

const SIDEBAR_ACCENT_KEYS = ["sidebar-primary", "sidebar-ring"] as const;

const ALL_SIDEBAR_KEYS = [
  ...SIDEBAR_BASE_KEYS,
  ...SIDEBAR_ACCENT_KEYS,
] as const;

describe("composePreset — sidebar tokens", () => {
  test("light mode emits every sidebar-* key", () => {
    const tokens = composePreset("light", "neutral");
    for (const key of ALL_SIDEBAR_KEYS) {
      expect(tokens[key]).toBeTruthy();
    }
    for (const key of SIDEBAR_BASE_KEYS) {
      expect(tokens[key]).toBe(lightMode[key]);
    }
  });

  test("dark mode emits every sidebar-* key", () => {
    const tokens = composePreset("dark", "neutral");
    for (const key of ALL_SIDEBAR_KEYS) {
      expect(tokens[key]).toBeTruthy();
    }
    for (const key of SIDEBAR_BASE_KEYS) {
      expect(tokens[key]).toBe(darkMode[key]);
    }
  });

  test("sidebar-primary tracks the accent in dark mode", () => {
    const violet = composePreset("dark", "violet");
    expect(violet["sidebar-primary"]).toBe(accents.violet["sidebar-primary"]);
    expect(violet["sidebar-ring"]).toBe(accents.violet["sidebar-ring"]);

    const blue = composePreset("dark", "blue");
    expect(blue["sidebar-primary"]).toBe(accents.blue["sidebar-primary"]);
    expect(blue["sidebar-ring"]).toBe(accents.blue["sidebar-ring"]);
  });

  test("sidebar-primary tracks the accent in light mode", () => {
    const blue = composePreset("light", "blue");
    expect(blue["sidebar-primary"]).toBe(accents.blue["sidebar-primary"]);
    expect(blue["sidebar-ring"]).toBe(accents.blue["sidebar-ring"]);

    const emerald = composePreset("light", "emerald");
    expect(emerald["sidebar-primary"]).toBe(accents.emerald["sidebar-primary"]);
  });

  test("non-accent sidebar tokens come from the mode base in light + dark", () => {
    const tokens = composePreset("dark", "violet");
    expect(tokens.sidebar).toBe(darkMode.sidebar);
    expect(tokens["sidebar-foreground"]).toBe(darkMode["sidebar-foreground"]);
    expect(tokens["sidebar-primary-foreground"]).toBe(darkMode["sidebar-primary-foreground"]);
    expect(tokens["sidebar-accent"]).toBe(darkMode["sidebar-accent"]);
    expect(tokens["sidebar-accent-foreground"]).toBe(darkMode["sidebar-accent-foreground"]);
    expect(tokens["sidebar-border"]).toBe(darkMode["sidebar-border"]);
  });

  test("every accent defines a sidebar-primary and sidebar-ring override", () => {
    for (const name of Object.keys(accents)) {
      const override = accents[name];
      expect(override["sidebar-primary"]).toBeTruthy();
      expect(override["sidebar-ring"]).toBeTruthy();
    }
  });
});