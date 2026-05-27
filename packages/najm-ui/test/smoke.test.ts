import { describe, test, expect } from "bun:test";
import { cn } from "../src/lib/cn";

describe("cn utility", () => {
  test("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("deduplicates tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  test("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  test("handles empty input", () => {
    expect(cn()).toBe("");
  });
});
