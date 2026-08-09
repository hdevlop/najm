import { describe, expect, it } from "bun:test";

import {
  APPEARANCE_EDITABLE_GROUPS,
  DEFAULT_APPEARANCE_LIMITS,
  MAX_APPEARANCE_LIMITS,
  changedAppearanceGroups,
  mergeAppearance,
  parsePublicAppearance,
  parseSafeDesignConfig,
  resolveAppearanceLimits,
} from "../../src/contracts/appearance";
import type { NajmDesignConfig } from "../../src/contracts";

const base: NajmDesignConfig = {
  version: 1,
  theme: { tokens: { primary: "#0ea5e9", background: "oklch(1 0 0)" } },
  typography: { fontSans: "Inter, sans-serif" },
};

describe("parseSafeDesignConfig — shape", () => {
  it("accepts a complete design and returns the parsed value", () => {
    const parsed = parseSafeDesignConfig(base);
    expect(parsed.version).toBe(1);
    expect(parsed.theme.tokens?.primary).toBe("#0ea5e9");
  });

  it("accepts a JSON string, as the kit's parser does", () => {
    expect(parseSafeDesignConfig(JSON.stringify(base)).theme.tokens?.primary).toBe("#0ea5e9");
  });

  it("rejects an unknown root key", () => {
    expect(() => parseSafeDesignConfig({ ...base, sneaky: 1 })).toThrow(/Unknown design property/);
  });

  it("rejects an unknown component name", () => {
    expect(() =>
      parseSafeDesignConfig({ ...base, components: { notAComponent: {} } }),
    ).toThrow(/Unknown component name/);
  });

  it("rejects a version other than 1", () => {
    expect(() => parseSafeDesignConfig({ ...base, version: 2 })).toThrow(/version must be 1/);
  });
});

describe("parseSafeDesignConfig — CSS safety", () => {
  const token = (value: string) => ({ version: 1, theme: { tokens: { primary: value } } });

  it("rejects a token that closes the style element", () => {
    expect(() => parseSafeDesignConfig(token("red</style><script>alert(1)</script>"))).toThrow(
      /must not contain/,
    );
  });

  it("rejects a token that ends the declaration and authors a rule", () => {
    expect(() => parseSafeDesignConfig(token("red; } body { display: none"))).toThrow(
      /must not contain/,
    );
  });

  it("rejects url(), the exfiltration channel that needs no script", () => {
    expect(() => parseSafeDesignConfig(token("url(https://evil.test/beacon)"))).toThrow(/url\(\)/);
    expect(() => parseSafeDesignConfig(token("URL ( https://evil.test )"))).toThrow(/url\(\)/);
  });

  it("rejects image-set(), which fetches just as url() does", () => {
    expect(() => parseSafeDesignConfig(token("image-set('https://evil.test/x.png' 1x)"))).toThrow(
      /image-set\(\)/,
    );
  });

  it("rejects expression() and -moz-binding", () => {
    expect(() => parseSafeDesignConfig(token("expression(alert(1))"))).toThrow(/expression\(\)/);
    expect(() => parseSafeDesignConfig(token("-moz-binding: x"))).toThrow(/must not contain/);
  });

  it("rejects @import", () => {
    expect(() => parseSafeDesignConfig(token("@import 'https://evil.test/x.css'"))).toThrow(
      /@import/,
    );
  });

  it("rejects a backslash, which is how every pattern above gets written twice", () => {
    // `\75 rl(...)` is `url(...)` to a CSS parser.
    expect(() => parseSafeDesignConfig(token("\\75 rl(https://evil.test)"))).toThrow(
      /must not contain/,
    );
  });

  it("rejects CSS comments", () => {
    expect(() => parseSafeDesignConfig(token("red /* x */"))).toThrow(/CSS comments/);
  });

  it("keeps legitimate values working", () => {
    for (const value of [
      "#0ea5e9",
      "oklch(0.7 0.15 250)",
      "rgb(14 165 233 / 40%)",
      "var(--brand)",
      "calc(1rem + 2px)",
    ]) {
      expect(() => parseSafeDesignConfig(token(value))).not.toThrow();
    }
  });

  it("checks per-mode overrides, not only the base tokens", () => {
    expect(() =>
      parseSafeDesignConfig({
        version: 1,
        theme: { tokens: {}, overrides: { dark: { primary: "url(https://evil.test)" } } },
      }),
    ).toThrow(/design\.theme\.overrides\.dark\.primary/);
  });

  it("checks component slot and variant values", () => {
    expect(() =>
      parseSafeDesignConfig({
        ...base,
        components: { button: { slots: { root: { padding: "1rem; color: red" } } } },
      }),
    ).toThrow(/design\.components\.button\.slots\.root\.padding/);

    expect(() =>
      parseSafeDesignConfig({
        ...base,
        components: { badge: { variants: { primary: { tokens: { bg: "url(x)" } } } } },
      }),
    ).toThrow(/design\.components\.badge\.variants\.primary\.tokens\.bg/);
  });

  it("rejects a class name carrying a quote or an angle bracket", () => {
    expect(() =>
      parseSafeDesignConfig({
        ...base,
        components: { button: { slots: { root: { className: 'p-2" onload="x' } } } },
      }),
    ).toThrow(/not valid in a class name/);
  });

  it("keeps Tailwind arbitrary-value class names working", () => {
    expect(() =>
      parseSafeDesignConfig({
        ...base,
        components: {
          button: {
            slots: {
              root: { className: "md:w-[calc(100%-1rem)] bg-primary/50 data-[state=open]:flex" },
            },
          },
        },
      }),
    ).not.toThrow();
  });

  it("checks typography, layout, and the theme's own CSS fields", () => {
    expect(() => parseSafeDesignConfig({ ...base, typography: { fontSans: "url(evil)" } })).toThrow(
      /typography\.fontSans/,
    );
    expect(() => parseSafeDesignConfig({ ...base, layout: { pageGutter: "1rem; x" } })).toThrow(
      /layout\.pageGutter/,
    );
    expect(() =>
      parseSafeDesignConfig({ version: 1, theme: { radius: "0.5rem}" } }),
    ).toThrow(/theme\.radius/);
    expect(() =>
      parseSafeDesignConfig({ version: 1, theme: { appearance: { borderWidth: "1px;}" } } }),
    ).toThrow(/theme\.appearance\.borderWidth/);
  });
});

describe("parseSafeDesignConfig — payload limits", () => {
  it("rejects a design over the byte ceiling", () => {
    const big = {
      version: 1,
      theme: { tokens: { primary: "#fff" } },
      components: {
        button: {
          variants: Object.fromEntries(
            Array.from({ length: 400 }, (_, index) => [`v${index}`, { className: "p-2 ".repeat(60) }]),
          ),
        },
      },
    };
    expect(() => parseSafeDesignConfig(big, { maxDesignBytes: 4_096, maxStringLength: 4_096 })).toThrow(
      /must serialize to at most 4096 bytes/,
    );
  });

  it("rejects a single string over the length ceiling", () => {
    expect(() =>
      parseSafeDesignConfig(
        { version: 1, theme: { tokens: { primary: "#".repeat(40) } } },
        { maxDesignBytes: 100_000, maxStringLength: 8 },
      ),
    ).toThrow(/at most 8 characters/);
  });

  it("counts UTF-8 bytes, not code units", () => {
    // Four-byte emoji: 12 characters of JSON but 24 bytes of payload.
    const design = { version: 1, theme: { tokens: { primary: "🎨🎨🎨🎨🎨🎨" } } };
    expect(() => parseSafeDesignConfig(design, { maxDesignBytes: 40, maxStringLength: 100 })).toThrow(
      /must serialize to at most 40 bytes/,
    );
  });
});

describe("resolveAppearanceLimits", () => {
  it("defaults when nothing is supplied", () => {
    expect(resolveAppearanceLimits()).toEqual(DEFAULT_APPEARANCE_LIMITS);
  });

  it("accepts an override inside the package ceiling", () => {
    expect(resolveAppearanceLimits({ maxDesignBytes: 1_000_000 }).maxDesignBytes).toBe(1_000_000);
  });

  it("refuses to widen past the package ceiling", () => {
    expect(() =>
      resolveAppearanceLimits({ maxDesignBytes: MAX_APPEARANCE_LIMITS.maxDesignBytes + 1 }),
    ).toThrow(/package maximum/);
  });

  it("refuses a nonsense limit", () => {
    expect(() => resolveAppearanceLimits({ maxStringLength: 0 })).toThrow(/positive integer/);
    expect(() => resolveAppearanceLimits({ maxStringLength: 1.5 })).toThrow(/positive integer/);
  });
});

describe("mergeAppearance", () => {
  it("replaces a whole group rather than deep-merging it", () => {
    const merged = mergeAppearance(base, { theme: { tokens: { primary: "#f00" } } });
    // The background token is gone: whole-group replacement is what lets an
    // editor remove a token at all.
    expect(merged.theme.tokens).toEqual({ primary: "#f00" });
  });

  it("keeps groups the patch does not mention", () => {
    const merged = mergeAppearance(base, { layout: { pageGutter: "2rem" } });
    expect(merged.typography).toEqual({ fontSans: "Inter, sans-serif" });
    expect(merged.layout).toEqual({ pageGutter: "2rem" });
  });

  it("removes an optional group set explicitly to undefined", () => {
    const merged = mergeAppearance(base, { typography: undefined });
    expect("typography" in merged).toBe(false);
  });

  it("refuses to remove the theme group", () => {
    expect(() => mergeAppearance(base, { theme: undefined })).toThrow(/cannot be removed/);
  });

  it("never lets a patch introduce a key outside the editable surface", () => {
    const merged = mergeAppearance(base, { version: 9, nope: true } as never);
    expect(merged.version).toBe(1);
    expect("nope" in merged).toBe(false);
    expect(APPEARANCE_EDITABLE_GROUPS).not.toContain("version" as never);
  });
});

describe("changedAppearanceGroups", () => {
  it("reports only the groups that differ", () => {
    const after = mergeAppearance(base, { typography: { fontSans: "Roboto" } });
    expect(changedAppearanceGroups(base, after)).toEqual(["typography"]);
  });

  it("reports nothing for an identical design", () => {
    expect(changedAppearanceGroups(base, structuredClone(base))).toEqual([]);
  });
});

describe("parsePublicAppearance", () => {
  it("narrows a well-formed payload", () => {
    const parsed = parsePublicAppearance({ designConfig: base, revision: 3 });
    expect(parsed?.revision).toBe(3);
    expect(parsed?.designConfig.theme.tokens?.primary).toBe("#0ea5e9");
  });

  it("rejects a non-positive or non-integer revision", () => {
    expect(parsePublicAppearance({ designConfig: base, revision: 0 })).toBeUndefined();
    expect(parsePublicAppearance({ designConfig: base, revision: 1.5 })).toBeUndefined();
    expect(parsePublicAppearance({ designConfig: base })).toBeUndefined();
  });

  it("rejects rather than throws on an unsafe design", () => {
    expect(
      parsePublicAppearance({
        designConfig: { version: 1, theme: { tokens: { primary: "url(evil)" } } },
        revision: 1,
      }),
    ).toBeUndefined();
  });
});
