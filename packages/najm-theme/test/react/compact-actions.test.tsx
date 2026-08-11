import { describe, expect, it, jest } from "bun:test";
import * as React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NThemeSettingsActions } from "../../src/react/components/NThemeSettingsActions";
import {
  useNThemeSettings,
  type NThemeSettingsValue,
} from "../../src/react/providers/NThemeSettingsProvider";
import { makeFakeClient, renderWithProvider } from "./fixtures";

function Ready({ onValue }: { onValue?: (value: NThemeSettingsValue) => void }) {
  const value = useNThemeSettings();
  onValue?.(value);
  return <span data-testid="ready">{value.loading ? "loading" : "ready"}</span>;
}

async function mount(onImportError?: (error: Error) => void) {
  let latest: NThemeSettingsValue | undefined;
  const { client } = makeFakeClient();
  const view = renderWithProvider(
    <>
      <Ready onValue={(value) => void (latest = value)} />
      <NThemeSettingsActions
        display="compact"
        showFileActions
        showDiscard={false}
        onImportError={onImportError}
      />
    </>,
    { client },
  );
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));
  return {
    ...view,
    get value() {
      return latest!;
    },
  };
}

describe("compact settings actions", () => {
  it("renders the four named icon controls without duplicate visible labels", async () => {
    const view = await mount();

    expect(screen.getByRole("button", { name: "Import theme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export theme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset to factory" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(view.container.querySelectorAll(".najm-theme-actions-buttons button")).toHaveLength(4);
    expect(view.container.querySelector(".najm-theme-actions-buttons")?.textContent).toBe("");
  });

  it("imports into the appearance draft and leaves persistence to Save", async () => {
    const view = await mount();
    const input = view.container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ version: 1, theme: { tokens: { primary: "#ff0000" } } })],
      "theme.json",
      { type: "application/json" },
    );

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(view.value.dirty.appearance).toBe(true));

    expect(view.value.design?.theme.tokens?.primary).toBe("#ff0000");
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("reports an invalid import without replacing the current design", async () => {
    const onImportError = jest.fn();
    const view = await mount(onImportError);
    const before = view.value.design?.theme.tokens?.primary;
    const input = view.container.querySelector("input[type='file']") as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [new File(["not json"], "bad.json", { type: "application/json" })],
        },
      });
    });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("invalid"));
    expect(onImportError).toHaveBeenCalledTimes(1);
    expect(view.value.design?.theme.tokens?.primary).toBe(before);
    expect(view.value.dirty.appearance).toBe(false);
  });

  it("keeps appearance and branding as distinct choices behind the one reset icon", async () => {
    await mount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Reset to factory" }));
    expect(await screen.findByRole("menuitem", { name: "Reset appearance to factory" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Reset branding to factory" })).toBeTruthy();

  });
});
