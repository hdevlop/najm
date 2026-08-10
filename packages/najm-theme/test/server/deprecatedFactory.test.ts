import { describe, expect, it } from "bun:test";

import { createFactoryDesignGetter } from "../../src/server/deprecated";

// ============================================================================
// The 0.1.x factory surface
//
// `defineTheme` replaced this, but 0.1.1 exported it and 0.2.0 is a minor
// release. Dropping it was an accident that broke the only consumer there is;
// these tests exist so the next person to tidy up removes it on purpose, in
// 0.3.0, rather than by not noticing it.
//
// Everything asserted here is 0.1.1 behaviour, not new behaviour.
// ============================================================================

const THEME_JSON = {
  version: 1,
  theme: {
    mode: "light",
    accent: "emerald",
    radius: "0.5rem",
    tokens: { primary: "oklch(0.52 0.135 144)" },
  },
} as const;

describe("createFactoryDesignGetter", () => {
  it("returns the design its theme.json describes", () => {
    const getDesign = createFactoryDesignGetter(THEME_JSON);
    const design = getDesign();

    expect(design.version).toBe(1);
    expect(design.theme.accent).toBe("emerald");
    expect(design.theme.tokens?.primary).toBe("oklch(0.52 0.135 144)");
  });

  it("hands out a fresh clone per call, so a caller cannot poison later reads", () => {
    // The whole reason it returns a getter rather than the object. The plugin
    // calls this per read; one consumer mutating what it got would change the
    // factory design for every request after it.
    const getDesign = createFactoryDesignGetter(THEME_JSON);
    const first = getDesign();
    const second = getDesign();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);

    // A token rather than `accent`, because `accent` is a closed union and this
    // test is about object identity, not about smuggling an invalid value in.
    first.theme.tokens!.primary = "oklch(0 0 0)";
    expect(getDesign().theme.tokens?.primary).toBe("oklch(0.52 0.135 144)");
  });

  it("parses once, at construction, not per call", () => {
    // Invalid input has to fail when the getter is *built* — that is what makes
    // a broken `theme.json` a broken build rather than a runtime surprise on
    // whichever request happens to read the theme first.
    expect(() => createFactoryDesignGetter({ version: 1, theme: { radius: 42 } })).toThrow();
  });

  it("does not swallow an unparseable theme.json", () => {
    expect(() => createFactoryDesignGetter("not a design")).toThrow();
    expect(() => createFactoryDesignGetter(null)).toThrow();
  });

  it("is reachable from the public server entry, where 0.1.1 exported it", async () => {
    // The import path is the compatibility promise. A consumer upgrading from
    // 0.1.1 changes a version number and nothing else.
    const entry = await import("../../src/server/index");
    expect(typeof entry.createFactoryDesignGetter).toBe("function");
  });
});
