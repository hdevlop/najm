import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";

import { defineTheme } from "../../src/theme";
import { makeHarness, onePixelPng, type Harness } from "./harness";

// ============================================================================
// The plugin, driven by a real factory theme directory.
//
// The unit tests for `defineTheme` prove the directory loads. These prove the
// three things only the backend can: that a slot with no upload resolves to the
// package's own factory route, that an upload wins over it and a reset gives it
// back, and that the URLs carry the server base the browser will actually ask
// for.
// ============================================================================

const MIXED_DIR = join(import.meta.dir, "../fixtures/theme-mixed");
const definition = defineTheme(MIXED_DIR);

const SCOPE = "platform";

let harness: Harness;

beforeEach(() => {
  harness = makeHarness({
    definition,
    storage: { normalize: false, orphanGraceMs: 60 * 60 * 1000 },
  });
});

afterEach(() => {
  harness.close();
});

async function upload(slot: string) {
  const bytes = onePixelPng();
  return harness.assets.uploadCandidate({
    scopeId: SCOPE,
    slot: harness.config.brandingSlots.find((definition) => definition.key === slot)!,
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    declaredMimeType: "image/png",
  });
}

describe("factory resolution", () => {
  it("fills all four slots from the definition, with no upload and no consumer paths", async () => {
    const branding = await harness.branding.getPublic(SCOPE);

    expect(Object.keys(branding.slots).sort()).toEqual([
      "authHeroImage",
      "authLogo",
      "sidebarLogoCollapsed",
      "sidebarLogoExpanded",
    ]);
    for (const [slot, path] of Object.entries(branding.slots)) {
      expect(path).toBe(definition.branding("/theme")[slot]);
    }
  });

  it("reports every slot as factory-provided to an administrator", async () => {
    const admin = await harness.branding.getAdmin(SCOPE);

    expect(admin.slots).toHaveLength(4);
    expect(admin.slots.every((slot) => slot.isCustom === false)).toBe(true);
    expect(admin.slots.every((slot) => slot.inheritedFrom === "factory")).toBe(true);
    expect(admin.slots.every((slot) => slot.resolvedPath !== null)).toBe(true);
  });

  it("builds the path a browser asks for, server base included", () => {
    // `.base("/api")` puts every controller behind `/api`; a branding URL built
    // from the plugin path alone is a 404 the response body cannot show.
    Object.assign(harness.assets, { serverBase: "/api" });

    expect(harness.assets.mountPrefix()).toBe("/api/theme");
    expect(harness.assets.publicPathFor("x.png")).toBe("/api/theme/branding/assets/x.png");
  });
});

describe("managed override", () => {
  it("replaces one slot and leaves the other three on their factory files", async () => {
    const asset = await upload("sidebarLogoExpanded");

    const saved = await harness.branding.save({
      scopeId: SCOPE,
      actorId: "u_1",
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    expect(saved.slots.sidebarLogoExpanded).toBe(`/theme/branding/assets/${asset.fileName}`);
    const factory = definition.branding("/theme");
    expect(saved.slots.sidebarLogoCollapsed).toBe(factory.sidebarLogoCollapsed);
    expect(saved.slots.authLogo).toBe(factory.authLogo);
    expect(saved.slots.authHeroImage).toBe(factory.authHeroImage);
  });

  it("does not let one upload silently replace three marks", async () => {
    // The standard slots let a collapsed mark inherit the expanded one, which
    // was right when a consumer supplied whichever factory paths it had. Under
    // the convention all four exist, so inheritance would only ever fire for an
    // upload — changing the sign-in logo because somebody changed the sidebar.
    const asset = await upload("sidebarLogoExpanded");
    const saved = await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    expect(saved.slots.authLogo).not.toContain(asset.fileName);
  });

  it("restores every factory file on reset", async () => {
    const asset = await upload("authLogo");
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { authLogo: { fileName: asset.fileName } },
    });

    const reset = await harness.branding.reset({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
    });

    expect(reset.slots).toEqual(definition.branding("/theme") as Record<string, string>);
    expect(reset.revision).toBe(3);
  });
});

describe("factory serving through the plugin", () => {
  it("serves the definition's bytes with the configured cache lifetime", async () => {
    const asset = definition.asset("sidebarLogoCollapsed")!;
    const response = harness.assets.serveFactoryAsset(asset.fileName)!;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe(
      `public, max-age=${harness.config.storage.cacheMaxAge}, immutable`,
    );
    expect((await response.arrayBuffer()).byteLength).toBe(asset.bytes);
  });

  it("answers nothing for an unknown name, including a managed one", async () => {
    const managed = await upload("authLogo");

    expect(harness.assets.serveFactoryAsset(managed.fileName)).toBeNull();
    expect(harness.assets.serveFactoryAsset("../theme.json")).toBeNull();
  });

  it("is inert for a consumer still on the deprecated factory callbacks", () => {
    const legacy = makeHarness();
    try {
      expect(legacy.config.definition).toBeUndefined();
      expect(legacy.assets.serveFactoryAsset("authLogo.0000000000000000.png")).toBeNull();
    } finally {
      legacy.close();
    }
  });
});

describe("appearance", () => {
  it("serves the directory's theme.json and resets to it", async () => {
    const before = await harness.appearance.getPublic(SCOPE);
    expect(before.designConfig).toEqual(definition.appearance());

    const saved = await harness.appearance.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      patch: { theme: { tokens: { primary: "#ef4444" } } },
    });
    expect(saved.designConfig.theme?.tokens?.primary).toBe("#ef4444");

    const reset = await harness.appearance.reset({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
    });
    expect(reset.designConfig).toEqual(definition.appearance());
  });
});
