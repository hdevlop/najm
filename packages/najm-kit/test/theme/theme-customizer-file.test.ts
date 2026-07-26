import { describe, expect, test } from "bun:test";

import {
  normalizeThemeFileName,
  parseThemeFile,
  stringifyThemeFile,
} from "../../src/components/ThemeCustomizer/theme-customizer-file";

describe("theme customizer JSON files", () => {
  test("round-trips a complete validated design config", () => {
    const source = {
      version: 1 as const,
      theme: {
        mode: "dark" as const,
        tokens: { primary: "#123456" },
      },
      typography: { baseSize: "16px" },
      components: { table: { headerColor: "var(--primary)" } },
      layout: { pageGutter: "16px" },
    };

    const serialized = stringifyThemeFile(source);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(parseThemeFile(serialized)).toEqual(source);
  });

  test("rejects malformed JSON and unknown design properties", () => {
    expect(() => parseThemeFile("{")).toThrow();
    expect(() =>
      parseThemeFile(JSON.stringify({ version: 1, theme: {}, unknown: true })),
    ).toThrow("Unknown design property");
  });

  test("normalizes JSON download filenames", () => {
    expect(normalizeThemeFileName(undefined)).toBe("najm-theme.json");
    expect(normalizeThemeFileName("kafil-theme")).toBe("kafil-theme.json");
    expect(normalizeThemeFileName("custom.JSON")).toBe("custom.JSON");
  });
});
