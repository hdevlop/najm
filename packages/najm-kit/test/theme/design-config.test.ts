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

  test("accepts responsive sidebar widths", () => {
    const config = parseNajmDesignConfig({
      version: 1,
      theme: {},
      components: {
        sidebar: {
          expandedWidth: { base: 164, lg: 200, xl: 240 },
          collapsedWidth: { base: 64, xl: 72 },
          mobileWidth: { base: 288, sm: 320 },
        },
      },
    });

    expect(config.components?.sidebar).toEqual({
      expandedWidth: { base: 164, lg: 200, xl: 240 },
      collapsedWidth: { base: 64, xl: 72 },
      mobileWidth: { base: 288, sm: 320 },
    });
  });

  test("rejects invalid responsive sidebar-width breakpoints", () => {
    expect(() =>
      parseNajmDesignConfig({
        version: 1,
        theme: {},
        components: { sidebar: { expandedWidth: { desktop: 240 } } },
      }),
    ).toThrow("Unknown components.sidebar.expandedWidth breakpoint: desktop");
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
