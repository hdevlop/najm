import { describe, expect, it } from "bun:test";
import * as React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { Palette } from "lucide-react";
import { NDialog, NSheet, NTabs } from "najm-kit";

import { NThemeBrandingSettings } from "../../src/react/components/NThemeBrandingSettings";
import { NThemePresetSettings } from "../../src/react/components/NThemePresetSettings";
import { NThemeSettings } from "../../src/react/components/NThemeSettings";
import { NThemeSettingsActions } from "../../src/react/components/NThemeSettingsActions";
import { NThemeSettingsStatus } from "../../src/react/components/NThemeSettingsStatus";
import {
  useNThemeSettings,
  type NThemeSettingsValue,
} from "../../src/react/providers/NThemeSettingsProvider";
import { appearanceResponse, brandingResponse, makeFakeClient, renderWithProvider } from "./fixtures";

// ============================================================================
// The gate for Move 5: the same sections, in different containers, behave
// identically and share one provider's state. No local hooks, no per-container
// feature logic.
// ============================================================================

function Ready({ onValue }: { onValue?: (value: NThemeSettingsValue) => void }) {
  const value = useNThemeSettings();
  onValue?.(value);
  return <span data-testid="ready">{value.loading ? "loading" : "ready"}</span>;
}

async function waitReady() {
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));
}

describe("containers", () => {
  it("composes standalone", async () => {
    const { client } = makeFakeClient();
    const view = renderWithProvider(
      <>
        <Ready />
        <NThemeBrandingSettings />
        <NThemeSettingsActions />
      </>,
      { client },
    );
    await waitReady();

    expect(view.container.querySelector("[data-najm-theme-section='branding']")).toBeTruthy();
    expect(view.container.querySelector("[data-najm-theme-actions]")).toBeTruthy();
  });

  it("composes inside tabs", async () => {
    const { client } = makeFakeClient();
    const view = renderWithProvider(
      <>
        <Ready />
        <NTabs
          items={[
            { value: "branding", label: "Branding", content: <NThemeBrandingSettings /> },
            { value: "presets", label: "Presets", content: <NThemePresetSettings /> },
          ]}
          defaultValue="branding"
        />
        <NThemeSettingsActions />
      </>,
      { client },
    );
    await waitReady();

    expect(view.container.querySelector("[data-najm-theme-section='branding']")).toBeTruthy();
    expect(view.container.querySelector("[data-najm-theme-actions]")).toBeTruthy();
  });

  it("composes inside a sheet", async () => {
    const { client } = makeFakeClient();
    renderWithProvider(
      <>
        <Ready />
        <NSheet open onOpenChange={() => {}} icon={Palette} title="Theme">
          <NThemeBrandingSettings />
          <NThemeSettingsActions />
        </NSheet>
      </>,
      { client },
    );
    await waitReady();

    // Rendered into a portal, so the assertion looks at the document rather
    // than the render container — which is exactly the point of the test.
    await waitFor(() =>
      expect(document.querySelector("[data-najm-theme-section='branding']")).toBeTruthy(),
    );
  });

  it("composes inside a dialog", async () => {
    const { client } = makeFakeClient();
    renderWithProvider(
      <>
        <Ready />
        <NDialog open onOpenChange={() => {}} title="Branding">
          <NThemeBrandingSettings />
          <NThemeSettingsActions />
        </NDialog>
      </>,
      { client },
    );
    await waitReady();

    await waitFor(() =>
      expect(document.querySelector("[data-najm-theme-section='branding']")).toBeTruthy(),
    );
  });

  it("gives two mountings of one section the same provider state", async () => {
    const { client } = makeFakeClient();
    let settings: NThemeSettingsValue | undefined;

    const view = renderWithProvider(
      <>
        <Ready onValue={(value) => void (settings = value)} />
        <NThemeSettingsStatus className="first" />
        <NThemeSettingsStatus className="second" />
      </>,
      { client },
    );
    await waitReady();

    await act(async () => {
      settings!.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });

    const statuses = view.container.querySelectorAll("[data-dirty]");
    expect(statuses).toHaveLength(2);
    for (const status of statuses) {
      expect(status.getAttribute("data-dirty")).toBe("true");
    }
  });
});

describe("partial features", () => {
  it("renders nothing for a section the backend did not enable", async () => {
    const { client } = makeFakeClient({
      appearance: appearanceResponse({
        features: { appearance: true, branding: false, presets: false, assetUploads: false, mcp: false },
      }),
      branding: brandingResponse({
        features: { appearance: true, branding: false, presets: false, assetUploads: false, mcp: false },
      }),
    });

    const view = renderWithProvider(
      <>
        <Ready />
        <NThemeBrandingSettings />
        <NThemePresetSettings />
      </>,
      { client },
    );
    await waitReady();

    expect(view.container.querySelector("[data-najm-theme-section='branding']")).toBeNull();
    expect(view.container.querySelector("[data-najm-theme-section='presets']")).toBeNull();
  });

  it("drops the tab strip when the composite has one section", async () => {
    const { client } = makeFakeClient({
      appearance: appearanceResponse({
        features: { appearance: false, branding: true, presets: false, assetUploads: true, mcp: false },
      }),
      branding: brandingResponse({
        features: { appearance: false, branding: true, presets: false, assetUploads: true, mcp: false },
      }),
    });

    const view = renderWithProvider(
      <>
        <Ready />
        <NThemeSettings />
      </>,
      { client },
    );
    await waitReady();

    expect(view.container.querySelector("[role='tablist']")).toBeNull();
    expect(view.container.querySelector("[data-najm-theme-section='branding']")).toBeTruthy();
  });

  it("renders every enabled section in the composite", async () => {
    const { client } = makeFakeClient();
    const view = renderWithProvider(
      <>
        <Ready />
        <NThemeSettings />
      </>,
      { client },
    );
    await waitReady();

    // The outer strip only. The Appearance section mounts the kit's customizer,
    // which has tabs of its own — counting every `role="tab"` in the subtree
    // would make this assertion about the kit rather than about this package.
    const tablist = view.container.querySelector("[role='tablist']")!;
    expect(tablist).toBeTruthy();
    expect(tablist.querySelectorAll(":scope > [role='tab']")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Reset section" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reset to factory" })).toBeTruthy();
  });
});

describe("outside a provider", () => {
  it("renders nothing rather than throwing", () => {
    // A component that merely offers theme editing stays mountable in an
    // application that has none.
    const { render } = require("@testing-library/react") as typeof import("@testing-library/react");
    const view = render(
      <>
        <NThemeBrandingSettings />
        <NThemeSettingsActions />
        <NThemeSettingsStatus />
        <NThemeSettings />
      </>,
    );
    expect(view.container.textContent).toBe("");
  });
});

describe("authorization presentation", () => {
  it("disables the controls a capability withholds without hiding the section", async () => {
    const readOnly = {
      readAppearance: true,
      manageAppearance: false,
      readBranding: true,
      manageBranding: false,
      uploadBrandingAssets: false,
      readPresets: true,
      managePresets: false,
    };
    const { client } = makeFakeClient({
      appearance: appearanceResponse({ capabilities: readOnly }),
      branding: brandingResponse({ capabilities: readOnly }),
    });

    const view = renderWithProvider(
      <>
        <Ready />
        <NThemeBrandingSettings />
        <NThemeSettingsActions />
      </>,
      { client },
    );
    await waitReady();

    // The section is still there — a viewer can see the current branding.
    expect(view.container.querySelector("[data-najm-theme-section='branding']")).toBeTruthy();
    // Save is unavailable, and the reset buttons are gone entirely.
    const save = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Save changes"),
    );
    expect(save?.hasAttribute("disabled")).toBe(true);
    expect(
      [...view.container.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("Reset"),
      ),
    ).toBe(false);
  });
});
