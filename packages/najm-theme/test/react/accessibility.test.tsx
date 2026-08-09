import { describe, expect, it } from "bun:test";
import * as React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NThemeSettingsActions } from "../../src/react/components/NThemeSettingsActions";
import { NThemeSettingsStatus } from "../../src/react/components/NThemeSettingsStatus";
import {
  useNThemeSettings,
  type NThemeSettingsValue,
} from "../../src/react/providers/NThemeSettingsProvider";
import { makeFakeClient, renderWithProvider } from "./fixtures";

function Ready({ onValue }: { onValue: (value: NThemeSettingsValue) => void }) {
  const value = useNThemeSettings();
  onValue(value);
  return <span data-testid="ready">{value.loading ? "loading" : "ready"}</span>;
}

async function mount() {
  const fake = makeFakeClient();
  let latest: NThemeSettingsValue | undefined;

  const view = renderWithProvider(
    <>
      <Ready onValue={(value) => void (latest = value)} />
      <NThemeSettingsActions />
    </>,
    { client: fake.client },
  );
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));

  return {
    ...view,
    fake,
    get value() {
      return latest!;
    },
    button: (label: string) =>
      [...view.container.querySelectorAll("button")].find((element) =>
        element.textContent?.includes(label),
      )!,
  };
}

describe("keyboard", () => {
  it("reaches and activates Save with the keyboard alone", async () => {
    const user = userEvent.setup();
    const view = await mount();

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });

    const save = view.button("Save changes");
    save.focus();
    expect(document.activeElement).toBe(save);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(view.fake.calls.saveAppearance).toHaveLength(1));
  });

  it("keeps a disabled Save out of the tab order's reach as an action", async () => {
    const view = await mount();
    const save = view.button("Save changes");

    // Nothing is dirty, so the control is disabled rather than absent — the
    // action bar must not reflow as an administrator edits and saves.
    expect(save.hasAttribute("disabled")).toBe(true);
  });
});

describe("destructive actions", () => {
  it("confirms a reset before it runs", async () => {
    const user = userEvent.setup();
    const view = await mount();

    await user.click(view.button("Reset to factory"));

    const dialog = await waitFor(() => {
      const found = document.querySelector("[role='alertdialog'], [role='dialog']");
      expect(found).toBeTruthy();
      return found!;
    });

    // Still nothing sent: the dialog is the gate, not a notification.
    expect(view.fake.calls.resetAppearance).toHaveLength(0);
    expect(dialog.textContent).toContain("Reset appearance?");
  });

  it("runs the reset only after the confirmation is accepted", async () => {
    const user = userEvent.setup();
    const view = await mount();

    await user.click(view.button("Reset to factory"));
    const confirm = await waitFor(() => {
      const found = [...document.querySelectorAll("button")].find(
        (element) =>
          element.textContent?.trim() === "Reset to factory"
          && element.closest("[role='alertdialog'], [role='dialog']") !== null,
      );
      expect(found).toBeTruthy();
      return found!;
    });

    await user.click(confirm);
    await waitFor(() => expect(view.fake.calls.resetAppearance).toHaveLength(1));
  });
});

describe("announcements", () => {
  it("puts routine state in a polite live region", async () => {
    const view = await mount();
    const status = view.container.querySelector(".najm-theme-status")!;

    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("No unsaved changes");

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });
    expect(status.textContent).toBe("You have unsaved changes");
  });

  it("does not use colour alone — the text itself changes", async () => {
    const view = await mount();
    const status = view.container.querySelector(".najm-theme-status")!;
    const before = status.textContent;

    await act(async () => {
      view.value.setDesignDraft({ version: 1, theme: { tokens: { primary: "#ff0000" } } });
    });

    expect(status.textContent).not.toBe(before);
    expect(status.getAttribute("data-dirty")).toBe("true");
  });

  it("can be reduced to failures only, for a surface with its own status line", async () => {
    const { client } = makeFakeClient();
    const view = renderWithProvider(
      <>
        <Ready onValue={() => {}} />
        <NThemeSettingsStatus errorsOnly />
      </>,
      { client },
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));

    expect(view.container.querySelector(".najm-theme-status")).toBeNull();
  });
});
