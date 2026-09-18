import { describe, expect, test } from "bun:test";

import { createEntityKeys, entityKeys } from "../src/query/keys";

describe("entity query keys", () => {
  test("creates the shared all, list, and detail shapes", () => {
    expect(entityKeys.all("families")).toEqual(["families"]);
    expect(entityKeys.list("families")).toEqual(["families", "list"]);
    expect(entityKeys.list("families", { status: "active" })).toEqual([
      "families",
      "list",
      { status: "active" },
    ]);
    expect(entityKeys.detail("families", 42)).toEqual([
      "families",
      "detail",
      42,
    ]);
  });

  test("binds and freezes an entity namespace", () => {
    const families = createEntityKeys("families");
    expect(families.all).toEqual(["families"]);
    expect(families.list({ offset: 25 })).toEqual([
      "families",
      "list",
      { offset: 25 },
    ]);
    expect(families.detail("family-1")).toEqual([
      "families",
      "detail",
      "family-1",
    ]);
    expect(Object.isFrozen(families)).toBe(true);
  });

  test("rejects an empty namespace", () => {
    expect(() => createEntityKeys("  ")).toThrow("entity must not be empty");
  });
});
