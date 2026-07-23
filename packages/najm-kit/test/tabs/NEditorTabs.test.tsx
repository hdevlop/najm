import { describe, expect, test } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { NEditorTabs, getNextEditorTabValue } from "../../src/components/tabs/NEditorTabs";
import type { NEditorTab } from "../../src/components/tabs/NEditorTabs";

const baseItems: NEditorTab[] = [
  { value: "home", name: "Home", closable: false },
  { value: "a.ase", name: "a.ase", dirty: true },
  { value: "b.ase", name: "b.ase" },
];

describe("NEditorTabs", () => {
  test("renders all tab names", () => {
    const { getByText } = render(<NEditorTabs items={baseItems} defaultValue="a.ase" />);
    expect(getByText("Home")).toBeTruthy();
    expect(getByText("a.ase")).toBeTruthy();
    expect(getByText("b.ase")).toBeTruthy();
  });

  test("uses the bordered variant", () => {
    const { container } = render(<NEditorTabs items={baseItems} defaultValue="a.ase" />);
    const root = container.querySelector("[data-slot='tabs']")!;
    expect(root.getAttribute("data-variant")).toBe("bordered");
  });

  test("closable tabs render a close button, non-closable ones do not", () => {
    const { queryByLabelText } = render(<NEditorTabs items={baseItems} defaultValue="a.ase" />);
    expect(queryByLabelText("Close Home")).toBeNull();
    expect(queryByLabelText("Close a.ase")).toBeTruthy();
    expect(queryByLabelText("Close b.ase")).toBeTruthy();
  });

  test("clicking close fires onClose with the tab value, not onValueChange", () => {
    let closed: string | null = null;
    let changed: string | null = null;
    const { getByLabelText } = render(
      <NEditorTabs
        items={baseItems}
        value="a.ase"
        onValueChange={(v) => (changed = v)}
        onClose={(v) => (closed = v)}
      />,
    );
    fireEvent.click(getByLabelText("Close b.ase"));
    expect(closed).toBe("b.ase");
    expect(changed).toBeNull();
  });

  test("dirty tab shows the dirty indicator dot", () => {
    const { getByLabelText } = render(<NEditorTabs items={baseItems} defaultValue="a.ase" />);
    const closeButton = getByLabelText("Close a.ase");
    expect(closeButton.querySelector("span.bg-amber-500")).toBeTruthy();
  });

  test("classNames.trigger extends the default trigger classes", () => {
    const { container } = render(
      <NEditorTabs items={baseItems} defaultValue="a.ase" classNames={{ trigger: "custom-trigger" }} />,
    );
    const triggers = container.querySelectorAll("[data-slot='tabs-trigger']");
    triggers.forEach((t) => {
      expect(t.className).toContain("custom-trigger");
      expect(t.className).toContain("group/tab");
    });
  });
});

describe("getNextEditorTabValue", () => {
  test("returns the previous tab when a middle tab closes", () => {
    expect(getNextEditorTabValue(baseItems, "a.ase")).toBe("home");
  });

  test("returns the first remaining tab when the first tab closes", () => {
    expect(getNextEditorTabValue(baseItems, "home")).toBe("a.ase");
  });

  test("returns undefined when the last remaining tab closes", () => {
    expect(getNextEditorTabValue([{ value: "solo", name: "solo" }], "solo")).toBeUndefined();
  });
});
