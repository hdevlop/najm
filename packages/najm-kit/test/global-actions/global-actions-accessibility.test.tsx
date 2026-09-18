import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import React from "react";
import * as najmKit from "../../src/index";
import {
  NFullscreenToggle,
  NGlobalActions,
  NLanguageMenu,
  NThemeToggle,
} from "../../src/components/GlobalActions";
import {
  NNotifyContent,
  NNotifyFooter,
  NNotifyHeader,
  NNotifyItem,
  NNotifyList,
  NNotifyRoot,
  NNotifyTrigger,
} from "../../src/components/Notify";
import type { NNotifyItemData, NNotifyLabels } from "../../src/components/Notify";
import { NajmPreferencesProvider } from "../../src/providers/preferences";

const ui = () => within(document.body);

const labels: NNotifyLabels = {
  open: "Open notifications",
  unread: (count) => `${count} unread`,
  title: "Notifications",
  loading: "Loading",
  emptyTitle: "All clear",
  errorTitle: "Could not load",
  retry: "Retry",
  markRead: "Mark read",
  markAllRead: "Mark all read",
  view: "View",
  viewAll: "View all",
  unreadState: "Unread",
  justNow: "Just now",
};

const item: NNotifyItemData = {
  id: "n1",
  title: "Contribution validated",
  body: "Credited to the budget.",
  read: false,
};

describe("flat public surface", () => {
  test.each([
    "NNotifyRoot",
    "NNotifyTrigger",
    "NNotifyContent",
    "NNotifyHeader",
    "NNotifyList",
    "NNotifyItem",
    "NNotifyFooter",
    "NNotifyMenu",
    "NGlobalActions",
    "NLanguageMenu",
    "NThemeToggle",
    "NFullscreenToggle",
    "formatNotifyCount",
    "formatNotifyTime",
  ])("exports %s from the root barrel", (name) => {
    expect((najmKit as Record<string, unknown>)[name]).toBeDefined();
  });

  test("publishes no notification namespace object", () => {
    const surface = najmKit as Record<string, unknown>;
    expect(surface.NNotifications).toBeUndefined();
    expect(surface.NNotify).toBeUndefined();
    expect(surface.NotifyMenu).toBeUndefined();
  });

  test("every notification export is a PascalCase component or a helper function", () => {
    const names = Object.keys(najmKit).filter((key) => key.startsWith("NNotify"));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name[0]).toBe("N");
      const value = (najmKit as Record<string, unknown>)[name];
      // Plain components are functions; the ref-forwarding ones are React
      // element types, which are objects. Neither is a namespace bag.
      expect(["function", "object"]).toContain(typeof value);
      expect(value).not.toBeNull();
    }
  });
});

describe("notification accessibility", () => {
  test("the trigger keeps one accessible name and a polite live region", () => {
    const { container } = render(
      <NNotifyRoot>
        <NNotifyTrigger label={labels.open} unreadCount={4} unreadLabel={labels.unread} />
      </NNotifyRoot>,
    );

    const buttons = ui().getAllByRole("button", { name: labels.open });
    expect(buttons).toHaveLength(1);
    const live = container.querySelector("[aria-live=\"polite\"]") as HTMLElement;
    expect(live.className).toContain("sr-only");
    expect(live.textContent).toBe("4 unread");
  });

  test("opens from a focused trigger, closes on an outside click, and returns focus on Escape", async () => {
    render(
      <NNotifyRoot>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyHeader title={labels.title} />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    const trigger = ui().getByRole("button", { name: labels.open });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyUp(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    await waitFor(() => expect(ui().getByText(labels.title)).toBeTruthy());

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    fireEvent.pointerDown(outside, { button: 0, pointerType: "mouse" });
    fireEvent.click(outside);
    await waitFor(() => expect(ui().queryByText(labels.title)).toBeNull());
    outside.remove();

    // Escape is the dismissal that owes the user their place back.
    fireEvent.click(trigger);
    await waitFor(() => expect(ui().getByText(labels.title)).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(ui().queryByText(labels.title)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test("a row nests no interactive element inside another", () => {
    const { container } = render(
      <NNotifyItem
        item={item}
        labels={labels}
        onMarkRead={() => {}}
        onOpenItem={() => {}}
      />,
    );

    const interactive = Array.from(
      container.querySelectorAll("button, a, [role=\"button\"]"),
    );
    expect(interactive.length).toBeGreaterThan(0);
    for (const node of interactive) {
      expect(node.querySelector("button, a, [role=\"button\"]")).toBeNull();
    }
  });

  test("row actions are reachable in order and operable with the keyboard", async () => {
    const onMarkRead = mock(async () => {});
    render(<NNotifyItem item={item} labels={labels} onMarkRead={onMarkRead} onOpenItem={() => {}} />);

    const buttons = ui().getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      labels.view,
      labels.markRead,
    ]);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).tabIndex).toBe(0);
    }

    const markRead = ui().getByRole("button", { name: labels.markRead });
    markRead.focus();
    expect(document.activeElement).toBe(markRead);
    fireEvent.keyDown(markRead, { key: " " });
    fireEvent.keyUp(markRead, { key: " " });
    fireEvent.click(markRead);
    await waitFor(() => expect(onMarkRead).toHaveBeenCalledTimes(1));
  });

  test("the list keeps stable keys across a reorder", () => {
    const rows: NNotifyItemData[] = [
      { id: "a", title: "First", read: false },
      { id: "b", title: "Second", read: true },
    ];
    const { rerender, container } = render(<NNotifyList items={rows} labels={labels} />);
    const first = container.querySelector("[data-notify-item-id=\"a\"]") as HTMLElement;
    rerender(<NNotifyList items={[...rows].reverse()} labels={labels} />);
    expect(container.querySelector("[data-notify-item-id=\"a\"]") as HTMLElement).toBe(first);
  });

  test("renders inside an RTL container without reversing the action order", () => {
    const { container } = render(
      <div dir="rtl">
        <NNotifyItem item={item} labels={labels} onMarkRead={() => {}} onOpenItem={() => {}} />
      </div>,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent)).toEqual([
      labels.view,
      labels.markRead,
    ]);
    // Logical spacing only: no physical left/right margins to flip.
    const footer = render(
      <div dir="rtl">
        <NNotifyFooter label={labels.viewAll} />
      </div>,
    ).container.querySelector("[data-slot=\"notify-footer\"]") as HTMLElement;
    expect(footer.className).not.toContain("ml-");
    expect(footer.className).not.toContain("mr-");
  });
});

describe("global action accessibility", () => {
  test("each control carries exactly one accessible name", async () => {
    render(
      <NajmPreferencesProvider initialTheme="light">
        <NGlobalActions>
          <NLanguageMenu
            label="Language"
            onChange={() => {}}
            options={[{ value: "en", label: "English" }]}
            value="en"
          />
          <NThemeToggle label="Toggle color theme" />
          <NFullscreenToggle label="Toggle fullscreen" />
        </NGlobalActions>
      </NajmPreferencesProvider>,
    );

    for (const name of ["Language", "Toggle color theme", "Toggle fullscreen"]) {
      expect(ui().getAllByRole("button", { name })).toHaveLength(1);
    }
    document.documentElement.classList.remove("dark");
  });

  test("the language menu uses logical icon spacing for RTL", () => {
    const { container } = render(
      <NLanguageMenu
        label="Language"
        onChange={() => {}}
        options={[{ value: "en", label: "English" }]}
        value="en"
      />,
    );
    const trigger = container.querySelector(
      "[data-slot=\"language-menu-trigger\"]",
    ) as HTMLElement;
    expect(trigger).toBeTruthy();

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    const source = String(NLanguageMenu);
    expect(source).not.toContain("mr-2");
  });
});
