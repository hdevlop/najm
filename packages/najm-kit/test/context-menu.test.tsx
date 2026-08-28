import { describe, expect, test, mock } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NContextMenu } from "../src/components/data-display/NContextMenu";

const items = [
  { id: "open", label: "Open" },
  { id: "rename", label: "Rename" },
];

describe("NContextMenu", () => {
  test("does not render a fullscreen backdrop that intercepts the next right-click", () => {
    const { container } = render(
      <NContextMenu x={100} y={100} items={items} onAction={mock()} onClose={mock()} />,
    );

    expect(container.querySelector(".fixed.inset-0")).toBeNull();
    expect(container.querySelector('[role="menu"]')).toBeDefined();
  });

  test("closes when clicking outside the menu", () => {
    const onClose = mock();
    render(<NContextMenu x={100} y={100} items={items} onAction={mock()} onClose={onClose} />);

    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("focuses the first enabled item and supports menu keyboard navigation", () => {
    const keyboardItems = [
      { id: "disabled", label: "Disabled", disabled: true },
      ...items,
    ];
    const onClose = mock();
    const { getByRole } = render(
      <NContextMenu
        x={100}
        y={100}
        items={keyboardItems}
        onAction={mock()}
        onClose={onClose}
      />,
    );

    const menu = getByRole("menu");
    const open = getByRole("menuitem", { name: "Open" });
    const rename = getByRole("menuitem", { name: "Rename" });

    expect(document.activeElement).toBe(open);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rename);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(open);

    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(rename);

    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(open);

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rename);

    fireEvent.keyDown(menu, { key: "Tab" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("restores focus to the opener when Escape closes the menu", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = mock();

    const { getByRole } = render(
      <NContextMenu x={100} y={100} items={items} onAction={mock()} onClose={onClose} />,
    );

    expect(document.activeElement).toBe(getByRole("menuitem", { name: "Open" }));

    fireEvent.keyDown(window, { key: "Escape" });
    await Promise.resolve();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
