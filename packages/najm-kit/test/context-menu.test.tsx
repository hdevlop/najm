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
});
