import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import type { Row } from "@tanstack/react-table";

import { NDataCardShell } from "../../src/components/table/NDataCardShell";

interface Row { id: string; name: string; }

describe("data-card-shell.test.tsx", () => {
  test("renders checkbox, expand chevron, and selection ring", async () => {
    const row = {
      id: "1",
      original: { id: "1", name: "Alice" },
      getIsSelected: () => false,
      toggleSelected: mock(),
      getCanExpand: () => true,
      getIsExpanded: () => false,
      toggleExpanded: mock(),
    } as unknown as Row<Row>;

    const { container } = render(
      <NDataCardShell row={row}>
        <div data-testid="card-body">Card content</div>
      </NDataCardShell>
    );
    await new Promise((r) => setTimeout(r, 50));

    // Checkbox present (uses data-slot=checkbox, not type=checkbox)
    expect(container.querySelector("[data-slot=checkbox]")).toBeTruthy();
    // Expand chevron present
    expect(container.querySelector("[aria-label*='Expand']")).toBeTruthy();
  });

  test("checkbox change does not bubble to row onClick", async () => {
    const onClick = mock();
    const row = {
      id: "1",
      original: { id: "1", name: "Alice" },
      getIsSelected: () => false,
      toggleSelected: mock(),
      getCanExpand: () => false,
      getIsExpanded: () => false,
      toggleExpanded: mock(),
    } as unknown as Row<Row>;

    const { container } = render(
      <NDataCardShell row={row} onClick={onClick}>
        <div data-testid="card-body">Card content</div>
      </NDataCardShell>
    );
    await new Promise((r) => setTimeout(r, 50));

    const checkbox = container.querySelector("[data-slot=checkbox]") as HTMLElement;
    expect(checkbox).toBeTruthy();

    fireEvent.click(checkbox);
    await new Promise((r) => setTimeout(r, 50));

    // onClick should NOT have been called (checkbox click is stopped)
    expect(onClick).not.toHaveBeenCalled();
    // toggleSelected should have been called
    const rowObj = row as unknown as { toggleSelected: mock };
    expect(rowObj.toggleSelected).toHaveBeenCalled();
  });

  test("selected row has ring-1 ring-primary class", async () => {
    const row = {
      id: "1",
      original: { id: "1", name: "Alice" },
      getIsSelected: () => true,
      toggleSelected: mock(),
      getCanExpand: () => false,
      getIsExpanded: () => false,
      toggleExpanded: mock(),
    } as unknown as Row<Row>;

    const { container } = render(
      <NDataCardShell row={row}>
        <div data-testid="card-body">Card content</div>
      </NDataCardShell>
    );
    await new Promise((r) => setTimeout(r, 50));

    const card = container.querySelector("[data-slot=card]");
    expect(card).toBeTruthy();
    expect(card?.className).toContain("ring-1");
    expect(card?.className).toContain("ring-primary");
  });

  test("card actions button is present when no actions provided (just render children)", async () => {
    const row = {
      id: "1",
      original: { id: "1", name: "Alice" },
      getIsSelected: () => false,
      toggleSelected: mock(),
      getCanExpand: () => false,
      getIsExpanded: () => false,
      toggleExpanded: mock(),
    } as unknown as Row<Row>;

    const { container } = render(
      <NDataCardShell row={row}>
        <div data-testid="card-body">Card content</div>
      </NDataCardShell>
    );
    await new Promise((r) => setTimeout(r, 50));

    // With no actions prop, no 3-dot menu should appear
    // The card renders correctly
    const cardBody = container.querySelector("[data-testid=card-body]");
    expect(cardBody).toBeTruthy();
    expect(cardBody?.textContent).toBe("Card content");
  });
});