import { describe, expect, it } from "bun:test";

import {
  MAX_BRANDING_SLOT_BYTES,
  STANDARD_BRANDING_SLOTS,
  assertBrandingSlotDefinitions,
  isBrandingAssetFileName,
  isBrandingSlotKey,
  parsePublicBranding,
  readBrandingSlotConfig,
  resolveBrandingSlots,
} from "../../src/contracts/branding";
import type { BrandingSlotDefinition } from "../../src/contracts/branding";

const FILE = "1f0f9f34-6c2e-4f36-9a3d-9c0f5c4b1e2a.png";
const OTHER_FILE = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.webp";

const assetPath = (fileName: string) => `/api/theme/branding/assets/${fileName}`;

function slot(overrides: Partial<BrandingSlotDefinition> = {}): BrandingSlotDefinition {
  return {
    key: "custom",
    kind: "image",
    labelKey: "x",
    maxBytes: 1024,
    acceptedMimeTypes: ["image/png"],
    ...overrides,
  };
}

describe("standard slots", () => {
  it("registers the four slots the chrome renders", () => {
    expect(STANDARD_BRANDING_SLOTS.map((definition) => definition.key)).toEqual([
      "sidebarLogoExpanded",
      "sidebarLogoCollapsed",
      "authLogo",
      "authHeroImage",
    ]);
  });

  it("validates as a registry", () => {
    expect(() => assertBrandingSlotDefinitions(STANDARD_BRANDING_SLOTS)).not.toThrow();
  });

  it("does not accept SVG anywhere by default", () => {
    for (const definition of STANDARD_BRANDING_SLOTS) {
      expect(definition.acceptedMimeTypes).not.toContain("image/svg+xml");
    }
  });
});

describe("assertBrandingSlotDefinitions", () => {
  it("rejects an empty registry", () => {
    expect(() => assertBrandingSlotDefinitions([])).toThrow(/non-empty array/);
  });

  it("rejects a key that could travel into a path", () => {
    expect(() => assertBrandingSlotDefinitions([slot({ key: "../evil" })])).toThrow(/key must be/);
    expect(() => assertBrandingSlotDefinitions([slot({ key: "with-dash" })])).toThrow(/key must be/);
    expect(isBrandingSlotKey("sidebarLogoExpanded")).toBe(true);
    expect(isBrandingSlotKey("a/b")).toBe(false);
  });

  it("rejects duplicate keys", () => {
    expect(() => assertBrandingSlotDefinitions([slot(), slot()])).toThrow(/duplicate key/);
  });

  it("rejects a byte ceiling above the package maximum", () => {
    expect(() =>
      assertBrandingSlotDefinitions([slot({ maxBytes: MAX_BRANDING_SLOT_BYTES + 1 })]),
    ).toThrow(/package maximum/);
    expect(() => assertBrandingSlotDefinitions([slot({ maxBytes: 0 })])).toThrow(/positive integer/);
  });

  it("rejects an empty or malformed MIME list", () => {
    expect(() => assertBrandingSlotDefinitions([slot({ acceptedMimeTypes: [] })])).toThrow(/MIME/);
    expect(() => assertBrandingSlotDefinitions([slot({ acceptedMimeTypes: ["png"] })])).toThrow(/MIME/);
  });

  it("rejects an inheritFrom that names nothing, resolving in either order", () => {
    expect(() =>
      assertBrandingSlotDefinitions([slot({ fallback: { inheritFrom: "ghost" } })]),
    ).toThrow(/unregistered slot/);

    // Forward reference: `a` inherits `b`, declared after it.
    expect(() =>
      assertBrandingSlotDefinitions([
        slot({ key: "a", fallback: { inheritFrom: "b" } }),
        slot({ key: "b" }),
      ]),
    ).not.toThrow();
  });

  it("rejects a slot inheriting from itself", () => {
    expect(() =>
      assertBrandingSlotDefinitions([slot({ key: "a", fallback: { inheritFrom: "a" } })]),
    ).toThrow(/must not be the slot itself/);
  });
});

describe("readBrandingSlotConfig", () => {
  const registered = new Set(["sidebarLogoExpanded", "authLogo"]);
  const entry = {
    fileName: FILE,
    mimeType: "image/png",
    bytes: 1234,
    uploadedAt: "2026-08-09T00:00:00.000Z",
  };

  it("reads a well-formed map", () => {
    const { config, droppedKeys } = readBrandingSlotConfig(
      { sidebarLogoExpanded: entry },
      registered,
    );
    expect(config.sidebarLogoExpanded).toEqual(entry);
    expect(droppedKeys).toEqual([]);
  });

  it("drops a slot that was deregistered rather than failing every page", () => {
    const { config, droppedKeys } = readBrandingSlotConfig({ retired: entry }, registered);
    expect(config).toEqual({});
    expect(droppedKeys).toEqual(["retired"]);
  });

  it("drops an entry whose file name is not one this package wrote", () => {
    const { config, droppedKeys } = readBrandingSlotConfig(
      { authLogo: { ...entry, fileName: "../../etc/passwd" } },
      registered,
    );
    expect(config).toEqual({});
    expect(droppedKeys).toEqual(["authLogo"]);
  });

  it("treats null and undefined as an empty map, not as corruption", () => {
    expect(readBrandingSlotConfig(null, registered)).toEqual({ config: {}, droppedKeys: [] });
    expect(readBrandingSlotConfig(undefined, registered)).toEqual({ config: {}, droppedKeys: [] });
  });

  it("reports a non-object column as corruption", () => {
    expect(readBrandingSlotConfig("nope", registered).droppedKeys).toEqual(["<root>"]);
  });
});

describe("isBrandingAssetFileName", () => {
  it("accepts a UUID name with a short extension", () => {
    expect(isBrandingAssetFileName(FILE)).toBe(true);
  });

  it("rejects anything the package did not mint", () => {
    for (const value of [
      "logo.png",
      "../1f0f9f34-6c2e-4f36-9a3d-9c0f5c4b1e2a.png",
      "1f0f9f34-6c2e-4f36-9a3d-9c0f5c4b1e2a",
      "1f0f9f34-6c2e-4f36-9a3d-9c0f5c4b1e2a.png/../x",
      "1F0F9F34-6C2E-4F36-9A3D-9C0F5C4B1E2A.png",
      42,
    ]) {
      expect(isBrandingAssetFileName(value)).toBe(false);
    }
  });
});

describe("resolveBrandingSlots", () => {
  const slots = STANDARD_BRANDING_SLOTS;
  const factory = {
    sidebarLogoExpanded: "/brand/logo.svg",
    authHeroImage: "/brand/hero.jpg",
  };

  it("prefers a managed asset over the factory value", () => {
    const resolved = resolveBrandingSlots({
      slots,
      config: {
        sidebarLogoExpanded: {
          fileName: FILE,
          mimeType: "image/png",
          bytes: 10,
          uploadedAt: "2026-08-09T00:00:00.000Z",
        },
      },
      factory,
      assetPath,
    });

    expect(resolved.sidebarLogoExpanded.path).toBe(assetPath(FILE));
    expect(resolved.sidebarLogoExpanded.isCustom).toBe(true);
    expect(resolved.sidebarLogoExpanded.uploadedAt).toBe("2026-08-09T00:00:00.000Z");
  });

  it("falls back to the factory value when nothing is managed", () => {
    const resolved = resolveBrandingSlots({ slots, config: {}, factory, assetPath });
    expect(resolved.sidebarLogoExpanded).toEqual({
      path: "/brand/logo.svg",
      isCustom: false,
      inheritedFrom: "factory",
      uploadedAt: null,
    });
  });

  it("inherits the managed value, not the factory file — one upload, both marks", () => {
    const resolved = resolveBrandingSlots({
      slots,
      config: {
        sidebarLogoExpanded: {
          fileName: FILE,
          mimeType: "image/png",
          bytes: 10,
          uploadedAt: "2026-08-09T00:00:00.000Z",
        },
      },
      factory,
      assetPath,
    });

    expect(resolved.sidebarLogoCollapsed.path).toBe(assetPath(FILE));
    expect(resolved.sidebarLogoCollapsed.isCustom).toBe(false);
    expect(resolved.sidebarLogoCollapsed.inheritedFrom).toBe("sidebarLogoExpanded");
  });

  it("stops inheriting once the slot has its own managed asset", () => {
    const resolved = resolveBrandingSlots({
      slots,
      config: {
        sidebarLogoExpanded: {
          fileName: FILE,
          mimeType: "image/png",
          bytes: 10,
          uploadedAt: "2026-08-09T00:00:00.000Z",
        },
        sidebarLogoCollapsed: {
          fileName: OTHER_FILE,
          mimeType: "image/webp",
          bytes: 10,
          uploadedAt: "2026-08-09T00:00:00.000Z",
        },
      },
      factory,
      assetPath,
    });

    expect(resolved.sidebarLogoCollapsed.path).toBe(assetPath(OTHER_FILE));
    expect(resolved.sidebarLogoCollapsed.isCustom).toBe(true);
  });

  it("resolves to null when there is nothing at all, rather than to a broken path", () => {
    const resolved = resolveBrandingSlots({ slots, config: {}, factory: {}, assetPath });
    expect(resolved.authHeroImage.path).toBeNull();
    expect(resolved.sidebarLogoCollapsed.inheritedFrom).toBeNull();
  });

  it("uses a literal fallback path when the factory map has no entry", () => {
    const resolved = resolveBrandingSlots({
      slots: [slot({ key: "favicon", fallback: "/favicon.ico" })],
      config: {},
      factory: {},
      assetPath,
    });
    expect(resolved.favicon.path).toBe("/favicon.ico");
  });

  it("survives an inheritance cycle a consumer registry could still express", () => {
    const cyclic = [
      slot({ key: "a", fallback: { inheritFrom: "b" } }),
      slot({ key: "b", fallback: { inheritFrom: "a" } }),
    ];
    const resolved = resolveBrandingSlots({ slots: cyclic, config: {}, factory: {}, assetPath });
    expect(resolved.a.path).toBeNull();
    expect(resolved.b.path).toBeNull();
  });
});

describe("parsePublicBranding", () => {
  it("narrows a well-formed payload", () => {
    expect(parsePublicBranding({ slots: { authLogo: "/a.png", authHeroImage: null }, revision: 2 })).toEqual({
      slots: { authLogo: "/a.png", authHeroImage: null },
      revision: 2,
    });
  });

  it("rejects a bad revision, missing slots, or a non-string entry", () => {
    expect(parsePublicBranding({ slots: {}, revision: 0 })).toBeUndefined();
    expect(parsePublicBranding({ revision: 1 })).toBeUndefined();
    expect(parsePublicBranding({ slots: { a: 5 }, revision: 1 })).toBeUndefined();
  });
});
