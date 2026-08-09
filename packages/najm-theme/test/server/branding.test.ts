import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isThemeRevisionConflict } from "../../src/contracts/revisions";
import { FACTORY_BRANDING, makeHarness, notAnImage, onePixelPng, type Harness } from "./harness";

let harness: Harness;

beforeEach(() => {
  harness = makeHarness({ storage: { normalize: false, orphanGraceMs: 60 * 60 * 1000 } });
});

afterEach(() => {
  harness.close();
});

const SCOPE = "platform";
const NAMESPACE = "theme-branding-platform";

async function upload(slot = "sidebarLogoExpanded", bytes = onePixelPng()) {
  return harness.assets.uploadCandidate({
    scopeId: SCOPE,
    slot: harness.config.brandingSlots.find((definition) => definition.key === slot)!,
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    declaredMimeType: "image/png",
  });
}

describe("reads", () => {
  it("resolves the factory values before anything is uploaded", async () => {
    const branding = await harness.branding.getPublic(SCOPE);
    expect(branding.slots.sidebarLogoExpanded).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
    expect(branding.revision).toBe(1);
  });

  it("inherits the collapsed and auth marks from the expanded one", async () => {
    const branding = await harness.branding.getPublic(SCOPE);
    expect(branding.slots.sidebarLogoCollapsed).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
    expect(branding.slots.authLogo).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
  });

  it("keeps the public projection to paths and a revision", async () => {
    const branding = await harness.branding.getPublic(SCOPE);
    expect(Object.keys(branding).sort()).toEqual(["revision", "slots"]);
    expect(JSON.stringify(branding)).not.toContain("theme-branding");
  });

  it("exposes slot metadata and provenance to an administrator", async () => {
    const admin = await harness.branding.getAdmin(SCOPE);
    const expanded = admin.slots.find((slot) => slot.key === "sidebarLogoExpanded");

    expect(expanded?.isCustom).toBe(false);
    expect(expanded?.inheritedFrom).toBe("factory");
    expect(expanded?.acceptedMimeTypes).toEqual(["image/png", "image/jpeg", "image/webp"]);
    // No storage namespace, no on-disk path, no orphan list.
    expect(JSON.stringify(admin)).not.toContain("theme-branding-");
  });
});

describe("upload", () => {
  it("mints an immutable name and never reuses the client's", async () => {
    const asset = await upload();
    expect(asset.fileName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    expect(asset.mimeType).toBe("image/png");
  });

  it("rejects a file that is not an image, whatever it claims to be", async () => {
    const bytes = notAnImage();
    await expect(
      harness.assets.uploadCandidate({
        scopeId: SCOPE,
        slot: harness.config.brandingSlots[0],
        body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        declaredMimeType: "image/png",
      }),
    ).rejects.toThrow(/not a PNG, JPEG, or WebP image/);

    expect(harness.storage.count(NAMESPACE)).toBe(0);
  });

  it("rejects a declared type that disagrees with the bytes", async () => {
    const bytes = onePixelPng();
    await expect(
      harness.assets.uploadCandidate({
        scopeId: SCOPE,
        slot: harness.config.brandingSlots[0],
        body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        declaredMimeType: "image/webp",
      }),
    ).rejects.toThrow(/does not match the file's actual format/);
  });

  it("rejects an empty body and one past the slot ceiling", async () => {
    await expect(
      harness.assets.uploadCandidate({
        scopeId: SCOPE,
        slot: harness.config.brandingSlots[0],
        body: new ArrayBuffer(0),
        declaredMimeType: "image/png",
      }),
    ).rejects.toThrow(/empty/);

    await expect(
      harness.assets.uploadCandidate({
        scopeId: SCOPE,
        slot: { ...harness.config.brandingSlots[0], maxBytes: 4 },
        body: onePixelPng().buffer as ArrayBuffer,
        declaredMimeType: "image/png",
      }),
    ).rejects.toThrow(/accepts at most 4 bytes/);
  });

  it("rejects a format the slot does not accept", async () => {
    const bytes = onePixelPng();
    await expect(
      harness.assets.uploadCandidate({
        scopeId: SCOPE,
        slot: { ...harness.config.brandingSlots[0], acceptedMimeTypes: ["image/webp"] },
        body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        declaredMimeType: undefined,
      }),
    ).rejects.toThrow(/accepts image\/webp/);
  });

  it("writes into a namespace scoped to the tenant", async () => {
    await upload();
    expect(harness.storage.count(NAMESPACE)).toBe(1);
    expect(harness.storage.count("theme-branding-acme")).toBe(0);
  });
});

describe("save", () => {
  it("commits a slot and serves it from the managed path", async () => {
    const asset = await upload();

    const saved = await harness.branding.save({
      scopeId: SCOPE,
      actorId: "u_1",
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    expect(saved.revision).toBe(2);
    expect(saved.slots.sidebarLogoExpanded).toBe(`/theme/branding/assets/${asset.fileName}`);
  });

  it("makes an inheriting slot pick up the managed asset, not the factory file", async () => {
    const asset = await upload();
    const saved = await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    expect(saved.slots.sidebarLogoCollapsed).toBe(`/theme/branding/assets/${asset.fileName}`);
    expect(saved.slots.authLogo).toBe(`/theme/branding/assets/${asset.fileName}`);
  });

  it("clears a slot back to its fallback", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    const cleared = await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
      slots: { sidebarLogoExpanded: null },
    });

    expect(cleared.slots.sidebarLogoExpanded).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
    expect(harness.storage.count(NAMESPACE)).toBe(0);
  });

  it("refuses an unregistered slot", async () => {
    await expect(
      harness.branding.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        slots: { faviconEvil: null },
      }),
    ).rejects.toThrow(/not a registered branding slot/);
  });

  it("refuses a file name the package did not mint", async () => {
    for (const fileName of ["../../etc/passwd", "logo.png", "x".repeat(200)]) {
      await expect(
        harness.branding.save({
          scopeId: SCOPE,
          actorId: null,
          expectedRevision: 1,
          slots: { sidebarLogoExpanded: { fileName } },
        }),
      ).rejects.toThrow(/not a managed branding asset name/);
    }
  });

  it("refuses a candidate uploaded into another scope", async () => {
    const asset = await upload();

    await expect(
      harness.branding.save({
        scopeId: "acme",
        actorId: null,
        expectedRevision: 1,
        slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
      }),
    ).rejects.toThrow(/was not found/);
  });

  it("re-derives the MIME type from the stored bytes rather than trusting the client", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      // The client sends only a file name; there is nowhere to put a MIME type.
      slots: { sidebarLogoExpanded: { fileName: asset.fileName, mimeType: "text/html" } as never },
    });

    const { mimeTypes } = await harness.branding.referencedFileNames(SCOPE);
    expect(mimeTypes.get(asset.fileName)).toBe("image/png");
  });

  it("conflicts on a stale revision and leaves storage untouched", async () => {
    const first = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: first.fileName } },
    });

    const second = await upload();
    try {
      await harness.branding.save({
        scopeId: SCOPE,
        actorId: null,
        expectedRevision: 1,
        slots: { sidebarLogoExpanded: { fileName: second.fileName } },
      });
      throw new Error("expected a conflict");
    } catch (error) {
      expect(isThemeRevisionConflict(error)).toBe(true);
      expect((error as { resource: string }).resource).toBe("branding");
    }

    // The committed file survives a rejected save.
    expect(await harness.storage.get(NAMESPACE, first.fileName)).not.toBeNull();
  });

  it("deletes the replaced file only after the commit", async () => {
    const first = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: first.fileName } },
    });

    const second = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
      slots: { sidebarLogoExpanded: { fileName: second.fileName } },
    });

    expect(await harness.storage.get(NAMESPACE, first.fileName)).toBeNull();
    expect(await harness.storage.get(NAMESPACE, second.fileName)).not.toBeNull();
  });

  it("keeps a committed save durable when the post-commit cleanup fails", async () => {
    const first = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: first.fileName } },
    });

    const second = await upload();
    harness.storage.failDeletes = true;

    const saved = await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
      slots: { sidebarLogoExpanded: { fileName: second.fileName } },
    });

    expect(saved.revision).toBe(3);
    expect(harness.diagnostics.some((entry) => entry.code === "asset.cleanup-failed")).toBe(true);
  });

  it("discards abandoned candidates but never one that just committed", async () => {
    const kept = await upload();
    const abandoned = await upload();

    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: kept.fileName } },
      discardFileNames: [abandoned.fileName, kept.fileName],
    });

    expect(await harness.storage.get(NAMESPACE, abandoned.fileName)).toBeNull();
    expect(await harness.storage.get(NAMESPACE, kept.fileName)).not.toBeNull();
  });

  it("names changed and cleared slots in the audit event, never a file", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: "u_5",
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    const [event] = harness.audits;
    expect(event.action).toBe("theme.branding.saved");
    expect(event.metadata).toEqual({
      kind: "branding-save",
      changedSlots: ["sidebarLogoExpanded"],
      clearedSlots: [],
    });
    expect(JSON.stringify(event)).not.toContain(asset.fileName);
  });
});

describe("reset", () => {
  it("clears every slot and removes the files afterwards", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    const reset = await harness.branding.reset({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 2,
    });

    expect(reset.revision).toBe(3);
    expect(reset.slots.sidebarLogoExpanded).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
    expect(harness.storage.count(NAMESPACE)).toBe(0);
  });
});

describe("delivery", () => {
  it("serves a committed asset with its stored type and an immutable cache header", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    const { fileNames, mimeTypes } = await harness.branding.referencedFileNames(SCOPE);
    const response = await harness.assets.serve({
      scopeId: SCOPE,
      fileName: asset.fileName,
      referencedFileNames: fileNames,
      mimeTypeByFileName: mimeTypes,
    });

    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });

  it("refuses an uncommitted candidate, so uploads are not an open file host", async () => {
    const asset = await upload();
    const { fileNames, mimeTypes } = await harness.branding.referencedFileNames(SCOPE);

    await expect(
      harness.assets.serve({
        scopeId: SCOPE,
        fileName: asset.fileName,
        referencedFileNames: fileNames,
        mimeTypeByFileName: mimeTypes,
      }),
    ).rejects.toThrow(/not found/);
  });

  it("answers the same way for a traversal attempt as for an unknown name", async () => {
    const { fileNames, mimeTypes } = await harness.branding.referencedFileNames(SCOPE);

    for (const fileName of ["../../../etc/passwd", "%2e%2e%2fsecret", "logo.png"]) {
      await expect(
        harness.assets.serve({
          scopeId: SCOPE,
          fileName,
          referencedFileNames: fileNames,
          mimeTypeByFileName: mimeTypes,
        }),
      ).rejects.toThrow(/branding asset not found/);
    }
  });

  it("does not serve one scope's asset to another", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });

    const other = await harness.branding.referencedFileNames("acme");
    await expect(
      harness.assets.serve({
        scopeId: "acme",
        fileName: asset.fileName,
        referencedFileNames: other.fileNames,
        mimeTypeByFileName: other.mimeTypes,
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("candidate deletion", () => {
  it("removes an uncommitted candidate", async () => {
    const asset = await upload();
    const { fileNames } = await harness.branding.referencedFileNames(SCOPE);

    const result = await harness.assets.deleteCandidate({
      scopeId: SCOPE,
      fileName: asset.fileName,
      referencedFileNames: fileNames,
    });

    expect(result.deleted).toBe(true);
    expect(harness.storage.count(NAMESPACE)).toBe(0);
  });

  it("refuses to delete a committed file through the cancel path", async () => {
    const asset = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: asset.fileName } },
    });
    const { fileNames } = await harness.branding.referencedFileNames(SCOPE);

    await expect(
      harness.assets.deleteCandidate({
        scopeId: SCOPE,
        fileName: asset.fileName,
        referencedFileNames: fileNames,
      }),
    ).rejects.toThrow(/in use by a saved branding slot/);
    expect(await harness.storage.get(NAMESPACE, asset.fileName)).not.toBeNull();
  });
});

describe("reconciliation", () => {
  it("deletes only unreferenced files past the grace period", async () => {
    const committed = await upload();
    await harness.branding.save({
      scopeId: SCOPE,
      actorId: null,
      expectedRevision: 1,
      slots: { sidebarLogoExpanded: { fileName: committed.fileName } },
    });

    const oldOrphan = await upload();
    const freshOrphan = await upload();
    harness.storage.age(NAMESPACE, oldOrphan.fileName, 2 * 60 * 60 * 1000);
    // The committed file is also backdated, to prove age alone is not enough.
    harness.storage.age(NAMESPACE, committed.fileName, 2 * 60 * 60 * 1000);

    const result = await harness.branding.reconcileAssets({ scopeId: SCOPE, actorId: "u_1" });

    expect(result.deleted).toBe(1);
    expect(await harness.storage.get(NAMESPACE, oldOrphan.fileName)).toBeNull();
    expect(await harness.storage.get(NAMESPACE, freshOrphan.fileName)).not.toBeNull();
    expect(await harness.storage.get(NAMESPACE, committed.fileName)).not.toBeNull();
  });

  it("never deletes a draft's fresh upload", async () => {
    await upload();
    const result = await harness.branding.reconcileAssets({ scopeId: SCOPE, actorId: null });
    expect(result.deleted).toBe(0);
    expect(harness.storage.count(NAMESPACE)).toBe(1);
  });

  it("records the sweep", async () => {
    harness.audits.length = 0;
    await harness.branding.reconcileAssets({ scopeId: SCOPE, actorId: "u_7" });

    const [event] = harness.audits;
    expect(event.action).toBe("theme.branding.assets.reconciled");
    expect(event.metadata).toEqual({ kind: "branding-reconcile", deletedCount: 0 });
  });
});

describe("stored slot-config recovery", () => {
  it("drops an entry for a slot that is no longer registered and keeps the page up", async () => {
    harness.sqlite.exec(`
      INSERT INTO najm_theme_branding (scope_id, slot_config, revision, created_at, updated_at)
      VALUES ('platform', '{"retiredSlot":{"fileName":"11111111-1111-4111-8111-111111111111.png","mimeType":"image/png","bytes":10,"uploadedAt":"2026-01-01"}}', 3, '2026-01-01', '2026-01-01')
    `);

    const branding = await harness.branding.getPublic(SCOPE);
    expect(branding.revision).toBe(3);
    expect(branding.slots.sidebarLogoExpanded).toBe(FACTORY_BRANDING.sidebarLogoExpanded);
    expect(
      harness.diagnostics.some((entry) => entry.code === "branding.invalid-slot-config"),
    ).toBe(true);
  });
});
