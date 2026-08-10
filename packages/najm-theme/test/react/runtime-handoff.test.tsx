// ============================================================================
// The hand-off to Najm Kit's runtime providers
// ============================================================================
//
// Every other React test in this package mounts the provider *without* the
// kit's design editor above it, so `useNajmDesignEditor()` answers `null` and
// the runtime-preview effect returns immediately. That is why the whole suite
// passed while the effect looped in every real application: the code path
// under test here is the one no other test reaches.
//
// The mount below is what a consumer actually has — `NajmDesignEditorProvider`
// (uncontrolled, seeded from the server render) with the settings provider
// nested inside it, exactly as `NajmAppProvider` arranges them.
// ============================================================================

import * as React from "react";
import { describe, expect, it } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { NajmDesignEditorProvider, useNajmDesignEditor } from "najm-kit";
import type { NajmDesignEditorValue } from "najm-kit";

import {
  NThemeSettingsProvider,
  useNThemeSettings,
} from "../../src/react/providers/NThemeSettingsProvider";
import type { NThemeSettingsValue } from "../../src/react/providers/NThemeSettingsProvider";
import { DESIGN, appearanceResponse, makeFakeClient, presetsResponse } from "./fixtures";

/** Counts renders of a child of the design editor, which is where a loop shows. */
function RenderCounter({ counter }: { counter: { count: number } }) {
  const editor = useNajmDesignEditor();
  counter.count += 1;
  return <span data-testid="design">{JSON.stringify(editor?.design ?? null)}</span>;
}

/** Hands both sides of the hand-off to the test: what drives it, and what it drives. */
function Probe({ seen }: { seen: { settings?: NThemeSettingsValue; editor?: NajmDesignEditorValue } }) {
  seen.settings = useNThemeSettings();
  seen.editor = useNajmDesignEditor() ?? undefined;
  return null;
}

function mount(counter: { count: number }, seen: Parameters<typeof Probe>[0]["seen"] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { client } = makeFakeClient({
    appearance: appearanceResponse(),
    presets: presetsResponse(),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <NajmDesignEditorProvider initialDesign={{ version: 1, theme: {} }}>
        <NThemeSettingsProvider client={client}>
          <RenderCounter counter={counter} />
          <Probe seen={seen} />
        </NThemeSettingsProvider>
      </NajmDesignEditorProvider>
    </QueryClientProvider>,
  );

  return { ...result, seen };
}

describe("runtime design hand-off", () => {
  it("publishes the committed design to the kit's editor", async () => {
    const counter = { count: 0 };
    const { getByTestId } = mount(counter);

    await waitFor(() => {
      expect(JSON.parse(getByTestId("design").textContent ?? "null")).toEqual(DESIGN);
    });
  });

  /**
   * The regression. `setCommitted` replaces the editor's state object, which
   * gives `useNajmDesignEditor()` a new identity — so an effect that depends on
   * that identity re-runs, calls `setCommitted` again, and never settles.
   *
   * A render budget rather than an exact count: the number of legitimate
   * renders depends on React's batching and on how many queries resolve. What
   * cannot happen is unbounded growth.
   */
  it("settles instead of re-committing the same design forever", async () => {
    const counter = { count: 0 };
    mount(counter);

    await waitFor(() => expect(counter.count).toBeGreaterThan(1));
    await new Promise((resolve) => setTimeout(resolve, 60));

    const settled = counter.count;
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(counter.count).toBe(settled);
    expect(settled).toBeLessThan(20);
  });

  /**
   * The other half of the same effect, and the defect the first fix introduced.
   *
   * A preview writes the preset into the editor's *draft*; `committed` is never
   * touched. So on cancel the stored design is byte-for-byte and
   * identity-for-identity what the editor already holds, and a guard that only
   * asks "has committed changed?" answers no and does nothing — leaving the
   * preview rendered by an editor whose `design` is `draft ?? committed`.
   *
   * Reached from the preset picker's "none", and from deleting the preset
   * currently being previewed.
   */
  it("restores the stored design when a preset preview is cancelled", async () => {
    const counter = { count: 0 };
    const { seen } = mount(counter);

    await waitFor(() => expect(seen.settings?.presets.length).toBeGreaterThan(0));
    const preset = seen.settings!.presets[0];

    act(() => seen.settings!.previewPreset(preset));
    await waitFor(() => expect(seen.editor?.design).toEqual(preset.designConfig));
    expect(seen.editor?.draft).toEqual(preset.designConfig);

    act(() => seen.settings!.previewPreset(null));

    await waitFor(() => expect(seen.editor?.draft).toBeNull());
    expect(seen.editor?.design).toEqual(DESIGN);
    expect(seen.settings?.dirty.appearance).toBe(false);
  });
});
