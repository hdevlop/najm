import { describe, expect, it } from "bun:test";
import * as React from "react";
import { act, screen, waitFor } from "@testing-library/react";

import { NThemeBrandingSettings } from "../../src/react/components/NThemeBrandingSettings";
import {
  useNThemeSettings,
  type NThemeSettingsValue,
} from "../../src/react/providers/NThemeSettingsProvider";
import { brandingResponse, makeFakeClient, renderWithProvider } from "./fixtures";

function liveObjectUrls(): number {
  return (globalThis as { __najmThemeLiveObjectUrls?: () => number }).__najmThemeLiveObjectUrls!();
}

function Ready({ onValue }: { onValue: (value: NThemeSettingsValue) => void }) {
  const value = useNThemeSettings();
  onValue(value);
  return <span data-testid="ready">{value.loading ? "loading" : "ready"}</span>;
}

async function mount(props: Parameters<typeof renderWithProvider>[1] = {}) {
  let latest: NThemeSettingsValue | undefined;
  const view = renderWithProvider(
    <>
      <Ready onValue={(value) => void (latest = value)} />
      <NThemeBrandingSettings />
    </>,
    props,
  );
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));
  return {
    ...view,
    get value() {
      return latest!;
    },
  };
}

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });

describe("slot rendering", () => {
  it("renders one group per registered slot, named by its label", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client });

    const groups = view.container.querySelectorAll("[data-slot]");
    expect(groups).toHaveLength(4);
    expect([...groups].map((group) => group.getAttribute("aria-label"))).toEqual([
      "Sidebar logo",
      "Sidebar icon",
      "Sign-in logo",
      "Sign-in image",
    ]);
  });

  it("renders a consumer's own slot from the server response, with its label key", async () => {
    const base = brandingResponse();
    const { client } = makeFakeClient({
      branding: {
        ...base,
        slots: [
          ...base.slots,
          {
            key: "emailHeader",
            kind: "image",
            labelKey: "app.branding.emailHeader",
            maxBytes: 262_144,
            acceptedMimeTypes: ["image/png"],
            previewAspect: "wide",
            resolvedPath: null,
            isCustom: false,
            inheritedFrom: null,
            uploadedAt: null,
          },
        ],
      },
    });

    const view = await mount({
      client,
      labels: { "app.branding.emailHeader": "Email header" },
    });

    const custom = view.container.querySelector("[data-slot='emailHeader']");
    expect(custom).toBeTruthy();
    expect(custom!.getAttribute("aria-label")).toBe("Email header");
  });

  it("says where a non-custom slot's image came from", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client });

    const expanded = view.container.querySelector("[data-slot='sidebarLogoExpanded']")!;
    expect(expanded.textContent).toContain("Using the built-in image");
  });

  it("names the slot an inherited one borrows from", async () => {
    const base = brandingResponse();
    const { client } = makeFakeClient({
      branding: {
        ...base,
        slots: base.slots.map((slot) =>
          slot.key === "sidebarLogoCollapsed"
            ? { ...slot, resolvedPath: "/brand/logo.png", inheritedFrom: "sidebarLogoExpanded" }
            : slot,
        ),
      },
    });

    const view = await mount({ client });
    const collapsed = view.container.querySelector("[data-slot='sidebarLogoCollapsed']")!;
    expect(collapsed.textContent).toContain("Inherited from Sidebar logo");
  });

  it("renders only the slots a consumer asked for", async () => {
    const { client } = makeFakeClient();
    const view = renderWithProvider(
      <>
        <Ready onValue={() => {}} />
        <NThemeBrandingSettings slotKeys={["authLogo"]} />
      </>,
      { client },
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));

    expect(view.container.querySelectorAll("[data-slot]")).toHaveLength(1);
    expect(view.container.querySelector("[data-slot='authLogo']")).toBeTruthy();
  });
});

describe("candidate uploads", () => {
  it("uploads on pick and marks the slot as ready to save", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });

    expect(fake.calls.uploadBrandingAsset).toHaveLength(1);
    expect(view.value.dirty.branding).toBe(true);
    // Nothing is committed yet.
    expect(fake.calls.saveBranding).toHaveLength(0);

    const slot = view.container.querySelector("[data-slot='sidebarLogoExpanded']")!;
    expect(slot.textContent).toContain("Image ready");
  });

  it("sends only the slot's file name, and the revision, on save", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });
    await act(async () => {
      await view.value.saveBranding();
    });

    expect(fake.calls.saveBranding[0]).toEqual({
      expectedRevision: 2,
      slots: { sidebarLogoExpanded: { fileName: "22222222-2222-4222-8222-222222222222.png" } },
      discardFileNames: [],
    });
  });

  it("clears a slot as an explicit null rather than an omission", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.clearBrandingSlot("authHeroImage");
    });
    await act(async () => {
      await view.value.saveBranding();
    });

    expect((fake.calls.saveBranding[0] as { slots: Record<string, unknown> }).slots).toEqual({
      authHeroImage: null,
    });
  });

  it("discards a candidate the save did not use", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });
    // Replacing the pick with a clear leaves the first upload unused.
    await act(async () => {
      view.value.clearBrandingSlot("sidebarLogoExpanded");
    });
    await act(async () => {
      await view.value.saveBranding();
    });

    expect(
      (fake.calls.saveBranding[0] as { discardFileNames: string[] }).discardFileNames,
    ).toEqual(["22222222-2222-4222-8222-222222222222.png"]);
  });

  it("drops a failed upload instead of leaving the slot half-edited", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    fake.failNext(
      "uploadBrandingAsset",
      Object.assign(new Error("that file is not a supported image"), {
        status: 400,
        conflict: false,
      }),
    );

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png()).catch(() => undefined);
    });

    expect(view.value.dirty.branding).toBe(false);
    expect(view.value.status.phase).toBe("error");
    expect(view.value.status.error?.message).toContain("not a supported image");
  });
});

describe("object URLs", () => {
  it("revokes every preview it created when the draft is discarded", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    const before = liveObjectUrls();

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
      await view.value.uploadBrandingAsset("authLogo", png());
    });
    expect(liveObjectUrls()).toBe(before + 2);

    await act(async () => {
      await view.value.discardDrafts();
    });
    expect(liveObjectUrls()).toBe(before);
  });

  it("revokes the previous preview when a slot is picked twice", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    const before = liveObjectUrls();

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });
    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });

    expect(liveObjectUrls()).toBe(before + 1);
  });

  it("revokes them after a successful save", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    const before = liveObjectUrls();

    await act(async () => {
      await view.value.uploadBrandingAsset("sidebarLogoExpanded", png());
    });
    await act(async () => {
      await view.value.saveBranding();
    });

    expect(liveObjectUrls()).toBe(before);
  });
});
