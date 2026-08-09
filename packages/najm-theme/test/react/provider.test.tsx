import { describe, expect, it } from "bun:test";
import * as React from "react";
import { act, screen, waitFor } from "@testing-library/react";

import { NThemeSettingsActions } from "../../src/react/components/NThemeSettingsActions";
import { NThemeSettingsStatus } from "../../src/react/components/NThemeSettingsStatus";
import {
  useNThemeSettings,
  type NThemeSettingsValue,
} from "../../src/react/providers/NThemeSettingsProvider";
import {
  CONFLICT,
  appearanceResponse,
  brandingResponse,
  makeFakeClient,
  presetsResponse,
  renderWithProvider,
} from "./fixtures";

/** Publishes the context so a test can drive commands directly. */
function Probe({ onValue }: { onValue: (value: NThemeSettingsValue) => void }) {
  const value = useNThemeSettings();
  onValue(value);
  return (
    <div data-testid="probe" data-dirty={value.dirty.any ? "yes" : "no"}>
      {value.loading ? "loading" : "ready"}
    </div>
  );
}

async function mount(props: Parameters<typeof renderWithProvider>[1] = {}) {
  let latest: NThemeSettingsValue | undefined;
  const view = renderWithProvider(
    <>
      <Probe onValue={(value) => void (latest = value)} />
      <NThemeSettingsActions />
    </>,
    props,
  );

  await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready"));
  return { ...view, get value() {
    return latest!;
  } };
}

describe("loading and features", () => {
  it("reports the server's features and capabilities", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client });

    expect(view.value.features.appearance).toBe(true);
    expect(view.value.capabilities.manageBranding).toBe(true);
  });

  it("lets a page narrow the sections but never widen them", async () => {
    const { client } = makeFakeClient({
      appearance: appearanceResponse({
        features: { appearance: true, branding: false, presets: false, assetUploads: false, mcp: false },
      }),
    });

    const view = await mount({ client, features: { appearance: true, presets: true } });

    // Narrowed by the page.
    expect(view.value.features.branding).toBe(false);
    // Requested by the page, refused by the server: the routes do not exist.
    expect(view.value.features.presets).toBe(false);
  });

  it("paints from a server snapshot instead of a spinner", () => {
    const { client } = makeFakeClient();
    renderWithProvider(<Probe onValue={() => {}} />, {
      client,
      initialData: {
        appearance: appearanceResponse(),
        branding: brandingResponse(),
        presets: presetsResponse(),
      },
    });

    expect(screen.getByTestId("probe").textContent).toBe("ready");
  });
});

describe("appearance drafts", () => {
  it("is clean until an edit differs from what is committed", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client });

    expect(view.value.dirty.appearance).toBe(false);

    await act(async () => {
      view.value.setDesignDraft(structuredClone(view.value.appearance!.designConfig));
    });
    // Same design, so not dirty — re-serializing a value is not an edit.
    expect(view.value.dirty.appearance).toBe(false);

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    expect(view.value.dirty.appearance).toBe(true);
  });

  it("sends the revision it read and clears the draft on success", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance();
    });

    expect(fake.calls.saveAppearance).toHaveLength(1);
    expect((fake.calls.saveAppearance[0] as { expectedRevision: number }).expectedRevision).toBe(3);
    expect(view.value.dirty.appearance).toBe(false);
  });

  it("does not send anything when there is no draft", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      await view.value.saveAppearance();
    });
    expect(fake.calls.saveAppearance).toHaveLength(0);
  });

  it("keeps the draft after a failed save, so the work is not lost", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    fake.failNext("saveAppearance", Object.assign(new Error("boom"), { status: 500, conflict: false }));

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance().catch(() => undefined);
    });

    expect(view.value.dirty.appearance).toBe(true);
    expect(view.value.status.phase).toBe("error");
  });
});

describe("conflicts", () => {
  it("surfaces a conflict as its own state, not as a generic failure", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    fake.failNext("saveAppearance", CONFLICT());

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance().catch(() => undefined);
    });

    expect(view.value.status.conflict).toBe("appearance");
    expect(view.value.status.error?.conflict).toBe(true);
  });

  it("renders it as an alert offering a reload, not a retry", async () => {
    const fake = makeFakeClient();
    let latest: NThemeSettingsValue | undefined;

    const view = renderWithProvider(
      <>
        <Probe onValue={(value) => void (latest = value)} />
        <NThemeSettingsStatus />
      </>,
      { client: fake.client },
    );
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("ready"));

    fake.failNext("saveAppearance", CONFLICT());
    await act(async () => {
      latest!.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await latest!.saveAppearance().catch(() => undefined);
    });

    // `role="alert"` rather than the polite status region: a conflict
    // interrupts, because continuing to edit is now pointless.
    const alert = view.container.querySelector("[role='alert']");
    expect(alert).toBeTruthy();
    expect(alert!.textContent).toContain("Reload");
    expect(alert!.textContent).not.toContain("Try again");
  });

  it("clears the conflict on reload", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    fake.failNext("saveAppearance", CONFLICT());

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance().catch(() => undefined);
    });
    expect(view.value.status.conflict).toBe("appearance");

    await act(async () => {
      await view.value.reload();
    });
    expect(view.value.status.conflict).toBeNull();
  });
});

describe("reset", () => {
  it("sends the current revision and clears the draft", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.resetAppearance();
    });

    expect((fake.calls.resetAppearance[0] as { expectedRevision: number }).expectedRevision).toBe(3);
    expect(view.value.dirty.appearance).toBe(false);
    expect(view.value.status.lastAction).toBe("reset");
  });
});

describe("presets", () => {
  it("previews in memory and persists nothing", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.previewPreset(view.value.presets[0]);
    });

    expect(view.value.selectedPresetId).toBe(view.value.presets[0].id);
    expect(view.value.design?.theme.tokens?.primary).toBe("#111111");
    expect(fake.calls.applyPreset).toHaveLength(0);
    expect(fake.calls.saveAppearance).toHaveLength(0);
  });

  it("persists only through the explicit apply, carrying the revision", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.previewPreset(view.value.presets[0]);
    });
    await act(async () => {
      await view.value.applySelectedPreset();
    });

    expect(fake.calls.applyPreset).toHaveLength(1);
    expect(fake.calls.applyPreset[0]).toEqual({
      id: view.value.presets[0].id,
      expectedRevision: 3,
    });
    expect(view.value.selectedPresetId).toBeNull();
  });

  it("drops the preset selection once the design is edited by hand", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.previewPreset(view.value.presets[0]);
    });
    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#00ff00" } } });
    });

    expect(view.value.selectedPresetId).toBeNull();
  });

  it("returns to the stored design when the preview is dropped", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.previewPreset(view.value.presets[0]);
    });
    await act(async () => {
      view.value.previewPreset(null);
    });

    expect(view.value.design?.theme.tokens?.primary).toBe("#0ea5e9");
    expect(view.value.dirty.appearance).toBe(false);
  });
});

describe("discard", () => {
  it("drops every draft and deletes the candidates it uploaded", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
      await view.value.uploadBrandingAsset(
        "sidebarLogoExpanded",
        new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" }),
      );
    });

    expect(view.value.dirty.any).toBe(true);

    await act(async () => {
      await view.value.discardDrafts();
    });

    expect(view.value.dirty.any).toBe(false);
    expect(fake.calls.deleteBrandingAsset).toEqual([
      "22222222-2222-4222-8222-222222222222.png",
    ]);
  });

  it("survives a cleanup that fails — the draft is still gone", async () => {
    const fake = makeFakeClient();
    const view = await mount({ client: fake.client });
    fake.failNext("deleteBrandingAsset", new Error("storage unavailable"));

    await act(async () => {
      await view.value.uploadBrandingAsset(
        "sidebarLogoExpanded",
        new File([new Uint8Array([1])], "logo.png", { type: "image/png" }),
      );
    });
    await act(async () => {
      await view.value.discardDrafts();
    });

    expect(view.value.dirty.any).toBe(false);
    expect(view.value.status.phase).toBe("idle");
  });
});

describe("router refresh", () => {
  it("runs onPersisted after a commit, never before", async () => {
    const fake = makeFakeClient();
    const order: string[] = [];

    const view = await mount({
      client: fake.client,
      onPersisted: () => order.push("refresh"),
    });

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance();
      order.push("save-returned");
    });

    expect(order).toEqual(["refresh", "save-returned"]);
  });

  it("does not fire it for a failed mutation", async () => {
    const fake = makeFakeClient();
    let refreshes = 0;
    const view = await mount({ client: fake.client, onPersisted: () => (refreshes += 1) });
    fake.failNext("saveAppearance", CONFLICT());

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    await act(async () => {
      await view.value.saveAppearance().catch(() => undefined);
    });

    expect(refreshes).toBe(0);
  });
});
