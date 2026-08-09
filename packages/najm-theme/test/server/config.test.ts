import { describe, expect, it } from "bun:test";

import { STANDARD_BRANDING_SLOTS } from "../../src/contracts/branding";
import { resolveThemeConfig } from "../../src/server/config";
import { themeSchema } from "../../src/schema/sqlite";
import { themeSchema as pgThemeSchema } from "../../src/schema/pg";

const guard = () => {};

function config(overrides: Record<string, unknown> = {}) {
  return {
    features: { appearance: true, branding: true, presets: true, assetUploads: true, mcp: false },
    dialect: "sqlite" as const,
    schema: themeSchema,
    publicRead: true,
    factory: { appearance: () => ({ version: 1, theme: {} }), branding: () => ({}) },
    guards: {
      manageAppearance: [guard],
      manageBranding: [guard],
      managePresets: [guard],
    },
    ...overrides,
  } as never;
}

describe("features", () => {
  it("requires every flag to be explicit", () => {
    expect(() => resolveThemeConfig(config({ features: undefined }))).toThrow(
      /features is required/,
    );
    expect(() =>
      resolveThemeConfig(
        config({ features: { appearance: true, branding: true, presets: true, assetUploads: true } }),
      ),
    ).toThrow(/features.mcp must be an explicit boolean/);
  });

  it("enforces the dependency rules", () => {
    expect(() =>
      resolveThemeConfig(
        config({
          features: { appearance: false, branding: true, presets: true, assetUploads: false, mcp: false },
        }),
      ),
    ).toThrow(/presets requires features.appearance/);

    expect(() =>
      resolveThemeConfig(
        config({
          features: { appearance: true, branding: false, presets: false, assetUploads: true, mcp: false },
        }),
      ),
    ).toThrow(/assetUploads requires features.branding/);
  });

  it("refuses a registration that would expose nothing", () => {
    expect(() =>
      resolveThemeConfig(
        config({
          features: { appearance: false, branding: false, presets: false, assetUploads: false, mcp: false },
        }),
      ),
    ).toThrow(/at least one of features.appearance or features.branding/);
  });
});

describe("guards", () => {
  it("fails registration when a mutation guard is missing", () => {
    expect(() =>
      resolveThemeConfig(config({ guards: { manageBranding: [guard], managePresets: [guard] } })),
    ).toThrow(/guards.manageAppearance must be a non-empty array/);

    expect(() =>
      resolveThemeConfig(
        config({
          guards: { manageAppearance: [guard], manageBranding: [], managePresets: [guard] },
        }),
      ),
    ).toThrow(/guards.manageBranding must be a non-empty array/);
  });

  it("only requires guards for features that are on", () => {
    const resolved = resolveThemeConfig(
      config({
        features: { appearance: true, branding: false, presets: false, assetUploads: false, mcp: false },
        factory: { appearance: () => ({ version: 1, theme: {} }) },
        guards: { manageAppearance: [guard] },
      }),
    );
    expect(resolved.guards.manageBranding).toEqual([]);
  });

  it("requires read guards when publicRead is false", () => {
    expect(() => resolveThemeConfig(config({ publicRead: false }))).toThrow(
      /guards.readAppearance must be a non-empty array/,
    );

    const resolved = resolveThemeConfig(
      config({
        publicRead: false,
        guards: {
          readAppearance: [guard],
          manageAppearance: [guard],
          readBranding: [guard],
          manageBranding: [guard],
          managePresets: [guard],
        },
      }),
    );
    expect(resolved.guards.readAppearance).toHaveLength(1);
  });

  it("refuses to guess publicRead", () => {
    expect(() => resolveThemeConfig(config({ publicRead: undefined }))).toThrow(
      /publicRead must be explicit/,
    );
  });

  it("falls preset reads back to the preset management guards", () => {
    const resolved = resolveThemeConfig(config());
    expect(resolved.guards.readPresets).toEqual(resolved.guards.managePresets);
  });
});

describe("schema", () => {
  it("requires the tables for every enabled feature", () => {
    expect(() => resolveThemeConfig(config({ schema: undefined }))).toThrow(/theme.schema is required/);
    expect(() =>
      resolveThemeConfig(config({ schema: { najmThemeAppearance: themeSchema.najmThemeAppearance } })),
    ).toThrow(/najmThemeBranding is required/);
  });

  it("accepts either dialect's tables", () => {
    expect(() => resolveThemeConfig(config({ dialect: "pg", schema: pgThemeSchema }))).not.toThrow();
  });

  it("rejects an unknown dialect", () => {
    expect(() => resolveThemeConfig(config({ dialect: "mysql" }))).toThrow(/dialect must be/);
  });
});

describe("factory values", () => {
  it("requires them only for enabled resources", () => {
    expect(() => resolveThemeConfig(config({ factory: { branding: () => ({}) } }))).toThrow(
      /factory.appearance is required/,
    );
    expect(() =>
      resolveThemeConfig(config({ factory: { appearance: () => ({ version: 1, theme: {} }) } })),
    ).toThrow(/factory.branding is required/);
  });

  it("does not call them at registration — a broken build should fail at use, with a path", () => {
    let calls = 0;
    const resolved = resolveThemeConfig(
      config({
        factory: {
          appearance: () => {
            calls += 1;
            return { version: 1, theme: {} };
          },
          branding: () => ({}),
        },
      }),
    );
    expect(calls).toBe(0);
    resolved.factoryAppearance();
    expect(calls).toBe(1);
  });
});

describe("branding slots", () => {
  it("defaults to the four standard slots", () => {
    expect(resolveThemeConfig(config()).brandingSlots.map((slot) => slot.key)).toEqual(
      STANDARD_BRANDING_SLOTS.map((slot) => slot.key),
    );
  });

  it("validates a consumer registry at registration, not at first upload", () => {
    expect(() =>
      resolveThemeConfig(
        config({
          brandingSlots: [
            { key: "bad key", kind: "logo", labelKey: "x", maxBytes: 1, acceptedMimeTypes: ["image/png"] },
          ],
        }),
      ),
    ).toThrow(/key must be/);
  });

  it("is empty when branding is off, so an appearance-only app registers nothing", () => {
    const resolved = resolveThemeConfig(
      config({
        features: { appearance: true, branding: false, presets: true, assetUploads: false, mcp: false },
        factory: { appearance: () => ({ version: 1, theme: {} }) },
        guards: { manageAppearance: [guard], managePresets: [guard] },
      }),
    );
    expect(resolved.brandingSlots).toEqual([]);
  });
});

describe("paths, limits, and storage", () => {
  it("defaults basePath to /theme and normalizes a trailing slash", () => {
    expect(resolveThemeConfig(config()).basePath).toBe("/theme");
    expect(resolveThemeConfig(config({ basePath: "/settings/theme/" })).basePath).toBe(
      "/settings/theme",
    );
    expect(resolveThemeConfig(config({ basePath: "/" })).basePath).toBe("");
  });

  it("rejects a base path that is not a same-origin path segment", () => {
    for (const basePath of ["theme", "//evil.test", "/a\\b", "https://evil.test"]) {
      expect(() => resolveThemeConfig(config({ basePath }))).toThrow();
    }
  });

  it("refuses a preset limit outside the package bounds", () => {
    expect(() => resolveThemeConfig(config({ limits: { maxPresets: 0 } }))).toThrow(/maxPresets/);
    expect(() => resolveThemeConfig(config({ limits: { maxPresets: 10_000 } }))).toThrow(/maxPresets/);
    expect(resolveThemeConfig(config({ limits: { maxPresets: 12 } })).limits.maxPresets).toBe(12);
  });

  it("refuses an orphan grace period short enough to delete a live draft", () => {
    expect(() => resolveThemeConfig(config({ storage: { orphanGraceMs: 1_000 } }))).toThrow(
      /orphanGraceMs must be at least/,
    );
  });

  it("defaults built-in preset deletion to off", () => {
    expect(resolveThemeConfig(config()).limits.allowBuiltInPresetDeletion).toBe(false);
  });

  it("scopes the storage namespace and rejects one that could escape it", () => {
    expect(resolveThemeConfig(config()).storage.namespace).toBe("theme-branding");
    expect(() => resolveThemeConfig(config({ storage: { namespace: "../evil" } }))).toThrow();
  });
});

describe("actor attribution", () => {
  it("reads id, sub, or userId by default and gives up quietly otherwise", () => {
    const resolved = resolveThemeConfig(config());
    expect(resolved.resolveActorId({ id: "u_1" })).toBe("u_1");
    expect(resolved.resolveActorId({ sub: "u_2" })).toBe("u_2");
    expect(resolved.resolveActorId({ userId: "u_3" })).toBe("u_3");
    expect(resolved.resolveActorId({ name: "nobody" })).toBeNull();
    expect(resolved.resolveActorId(null)).toBeNull();
  });
});
