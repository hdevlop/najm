import { describe, expect, test } from "bun:test";
import {
  detectFormat,
  formatColor,
  parseColor,
  toPickerHex,
} from "../../src/components/inputs/color/convert";

describe("color/convert", () => {
  test("parseColor parses valid colors and rejects garbage", () => {
    expect(parseColor("#ff0000")).toBeDefined();
    expect(parseColor("not-a-color")).toBeUndefined();
  });

  test("formatColor converts between formats", () => {
    expect(formatColor("#ff0000", "hex")).toBe("#ff0000");
    expect(formatColor("#ff0000", "rgb")).toContain("rgb");
    expect(formatColor("#ff0000", "hsl")).toContain("hsl");
    expect(formatColor("#ff0000", "oklch")).toContain("oklch");
  });

  test("formatColor normalizes oklch into l c h triplet", () => {
    const out = formatColor("#3b82f6", "oklch");
    expect(out).toMatch(/^oklch\(\d/);
    expect(out.split(" ").length).toBe(3);
  });

  test("formatColor passes through invalid input", () => {
    expect(formatColor("garbage", "hex")).toBe("garbage");
  });

  test("detectFormat identifies the leading format", () => {
    expect(detectFormat("oklch(0.6 0.2 290)")).toBe("oklch");
    expect(detectFormat("hsl(0 100% 50%)")).toBe("hsl");
    expect(detectFormat("rgb(255 0 0)")).toBe("rgb");
    expect(detectFormat("#fff")).toBe("hex");
    expect(detectFormat("")).toBe("hex");
  });

  test("toPickerHex always yields a hex string", () => {
    expect(toPickerHex("oklch(0.6 0.2 290)")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(toPickerHex("garbage")).toBe("#000000");
  });
});
