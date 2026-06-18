import { describe, expect, test } from "bun:test";

import { parseNajmDesignConfig } from "../../src/theme/design-config";

describe("parseNajmDesignConfig", () => {
  test("accepts page header card recipe", () => {
    const config = parseNajmDesignConfig({
      version: 1,
      theme: {},
      components: {
        pageHeader: { card: true },
      },
    });

    expect(config.components?.pageHeader?.card).toBe(true);
  });

  test("rejects non-boolean component card recipe", () => {
    expect(() =>
      parseNajmDesignConfig({
        version: 1,
        theme: {},
        components: {
          pageHeader: { card: "yes" },
        },
      }),
    ).toThrow("components.pageHeader.card must be a boolean");
  });

  test("accepts layout config", () => {
    const config = parseNajmDesignConfig({
      version: 1,
      theme: {},
      layout: {
        pageGutter: "24px",
        sectionGap: "20px",
      },
    });

    expect(config.layout).toEqual({
      pageGutter: "24px",
      sectionGap: "20px",
    });
  });

  test("rejects unknown layout keys", () => {
    expect(() =>
      parseNajmDesignConfig({
        version: 1,
        theme: {},
        layout: {
          gutter: "24px",
        },
      }),
    ).toThrow("Unknown layout property: gutter");
  });

  test("rejects non-string layout values", () => {
    expect(() =>
      parseNajmDesignConfig({
        version: 1,
        theme: {},
        layout: {
          pageGutter: 24,
        },
      }),
    ).toThrow("layout.pageGutter must be a string");
  });
});
