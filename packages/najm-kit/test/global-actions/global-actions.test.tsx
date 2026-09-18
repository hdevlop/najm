import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import React from "react";
import {
  NFullscreenToggle,
  NGlobalActions,
  NLanguageMenu,
  NThemeToggle,
} from "../../src/components/GlobalActions";
import { NajmPreferencesProvider } from "../../src/providers/preferences";
import { NPageHeader, NPageHeaderActions } from "../../src/components/layout/NPageHeader";

const ui = () => within(document.body);

function TestIcon({ className }: { className?: string }) {
  return <svg className={className} />;
}

/** Radix opens a dropdown on pointerdown, not on a synthetic click. */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const languages = [
  { value: "en", label: "English", icon: <span data-testid="flag-en" />, iconLabel: "United States" },
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
] as const;

describe("NGlobalActions", () => {
  test("groups its children with the page-header action spacing", () => {
    const { container } = render(
      <NGlobalActions>
        <button type="button">one</button>
        <button type="button">two</button>
      </NGlobalActions>,
    );
    const group = container.querySelector("[data-slot=\"global-actions\"]") as HTMLElement;
    expect(group.className).toContain("flex");
    expect(group.className).toContain("shrink-0");
    expect(group.className).toContain("items-center");
    expect(group.querySelectorAll("button")).toHaveLength(2);
  });

  test("renders inside a page header actions slot without losing its children", () => {
    const { container } = render(
      <NPageHeader icon={TestIcon} title="Families">
        <NPageHeaderActions>
          <NGlobalActions>
            <button type="button">bell</button>
          </NGlobalActions>
        </NPageHeaderActions>
      </NPageHeader>,
    );
    const group = container.querySelector("[data-slot=\"global-actions\"]") as HTMLElement;
    expect(group).toBeTruthy();
    expect(ui().getByRole("button", { name: "bell" })).toBeTruthy();
  });

  test("renders through the legacy actions prop too", () => {
    const { container } = render(
      <NPageHeader
        actions={
          <NGlobalActions>
            <button type="button">bell</button>
          </NGlobalActions>
        }
        icon={TestIcon}
        title="Families"
      />,
    );
    expect(container.querySelector("[data-slot=\"global-actions\"]")).toBeTruthy();
  });
});

describe("NLanguageMenu", () => {
  test("marks the active language and awaits the application command", async () => {
    const onChange = mock(async () => {});
    render(
      <NLanguageMenu
        label="Language"
        onChange={onChange}
        options={languages}
        value="fr"
      />,
    );

    openMenu(ui().getByRole("button", { name: "Language" }));
    const french = await ui().findByRole("menuitem", { name: "French" });
    expect(french.getAttribute("data-selected")).toBe("true");
    const english = ui().getByRole("menuitem", { name: /English/ });
    expect(english.getAttribute("data-selected")).toBeNull();

    fireEvent.click(english);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("en"));
  });

  test("renders an injected icon node and its screen-reader label", async () => {
    render(
      <NLanguageMenu label="Language" onChange={() => {}} options={languages} value="en" />,
    );
    openMenu(ui().getByRole("button", { name: "Language" }));
    await ui().findByRole("menuitem", { name: /English/ });
    expect(document.querySelector("[data-testid=\"flag-en\"]")).toBeTruthy();
    expect(ui().getByText("United States")).toBeTruthy();
  });

  test("disables the trigger while the change is pending and releases it", async () => {
    const gate = deferred();
    render(
      <NLanguageMenu
        label="Language"
        onChange={() => gate.promise}
        options={languages}
        pendingLabel="Changing language"
        value="en"
      />,
    );

    openMenu(ui().getByRole("button", { name: "Language" }));
    fireEvent.click(await ui().findByRole("menuitem", { name: "French" }));

    const pending = (await ui().findByRole("button", {
      name: "Changing language",
    })) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    await waitFor(() => {
      const trigger = ui().getByRole("button", { name: "Language" }) as HTMLButtonElement;
      expect(trigger.disabled).toBe(false);
    });
  });

  test("reports a rejected change and stays usable", async () => {
    const onError = mock(() => {});
    render(
      <NLanguageMenu
        label="Language"
        onChange={async () => {
          throw new Error("offline");
        }}
        onError={onError}
        options={languages}
        value="en"
      />,
    );

    openMenu(ui().getByRole("button", { name: "Language" }));
    fireEvent.click(await ui().findByRole("menuitem", { name: "French" }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const trigger = ui().getByRole("button", { name: "Language" }) as HTMLButtonElement;
      expect(trigger.disabled).toBe(false);
    });
  });

  test("an application-owned pending flag disables the trigger", () => {
    render(
      <NLanguageMenu
        label="Language"
        onChange={() => {}}
        options={languages}
        pending
        value="en"
      />,
    );
    const trigger = ui().getByRole("button", { name: "Language" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});

describe("NThemeToggle", () => {
  function renderToggle(
    initialTheme: "light" | "dark",
    onThemeChange?: (theme: string) => void | Promise<void>,
  ) {
    return render(
      <NajmPreferencesProvider initialTheme={initialTheme} onThemeChange={onThemeChange}>
        <NThemeToggle label="Toggle theme" />
      </NajmPreferencesProvider>,
    );
  }

  test("switches light to dark through the preferences contract", async () => {
    const onThemeChange = mock(async () => {});
    renderToggle("light", onThemeChange);

    fireEvent.click(ui().getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith("dark"));
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true),
    );
  });

  test("switches dark back to light", async () => {
    const onThemeChange = mock(async () => {});
    renderToggle("dark", onThemeChange);

    fireEvent.click(ui().getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith("light"));
    document.documentElement.classList.remove("dark");
  });

  test("disables while persistence is pending and releases on rejection", async () => {
    const gate = deferred();
    const onError = mock(() => {});
    render(
      <NajmPreferencesProvider initialTheme="light" onThemeChange={() => gate.promise}>
        <NThemeToggle label="Toggle theme" onError={onError} pendingLabel="Saving theme" />
      </NajmPreferencesProvider>,
    );

    fireEvent.click(ui().getByRole("button", { name: "Toggle theme" }));
    const pending = (await ui().findByRole("button", {
      name: "Saving theme",
    })) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);

    await act(async () => {
      gate.reject(new Error("no cookie"));
      await gate.promise.catch(() => {});
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const button = ui().getByRole("button", { name: "Toggle theme" }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
    document.documentElement.classList.remove("dark");
  });
});

describe("NFullscreenToggle", () => {
  test("hides below the sm breakpoint by default and accepts an override", () => {
    const { rerender } = render(<NFullscreenToggle label="Toggle fullscreen" />);
    let button = ui().getByRole("button", { name: "Toggle fullscreen" });
    expect(button.className).toContain("hidden");
    expect(button.className).toContain("sm:inline-flex");

    rerender(<NFullscreenToggle hiddenBelow={null} label="Toggle fullscreen" />);
    button = ui().getByRole("button", { name: "Toggle fullscreen" });
    expect(button.className).not.toContain("hidden");
  });

  test("renders a disabled control where the API is unavailable, without throwing", async () => {
    render(<NFullscreenToggle label="Toggle fullscreen" />);
    const button = ui().getByRole("button", {
      name: "Toggle fullscreen",
    }) as HTMLButtonElement;

    // happy-dom exposes no fullscreen API, so screenfull reports it disabled.
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(button.isConnected).toBe(true);
  });
});
