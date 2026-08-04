import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { render, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";

interface Item { id: string; name: string }
const data: Item[] = [{ id: "1", name: "Visible action" }];
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];
const originalMatchMedia = window.matchMedia;

function setMobileMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: mock(() => ({
      matches: true,
      media: "(max-width: 639px)",
      onchange: null,
      addEventListener: mock(),
      removeEventListener: mock(),
      addListener: mock(),
      removeListener: mock(),
      dispatchEvent: mock(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
});

describe("NTable responsive card actions", () => {
  test("standard-shell row actions use the touch-visible shared class", async () => {
    setMobileMatchMedia();
    const { container } = render(
      <NTable<Item>
        data={data}
        columns={columns}
        renderCard={({ data: item }) => <div>{item.name}</div>}
        menu={{ row: () => [{ label: "View", onSelect: () => {} }] }}
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
      />,
    );

    await waitFor(() => expect(container.querySelector("[data-ntable-card-action]")).toBeTruthy());
    const action = container.querySelector("[data-ntable-card-action]") as HTMLElement;
    expect(action.className).toContain("ntable-card-action");
    expect(action.className).not.toContain("opacity-0");
    expect(container.querySelector('button[aria-label="Row actions"]')?.className).toContain("focus-visible:ring-2");
  });

  test("no-shell row actions use the same touch-visible shared class", async () => {
    setMobileMatchMedia();
    const noShell = [{ ...data[0], __smsNoShell: true }];
    const { container } = render(
      <NTable
        data={noShell}
        columns={columns as any}
        renderCard={({ data: item }: any) => <div>{item.name}</div>}
        menu={{ row: () => [{ label: "View", onSelect: () => {} }] }}
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
      />,
    );

    await waitFor(() => expect(container.querySelector("[data-ntable-card-action]")).toBeTruthy());
    const action = container.querySelector("[data-ntable-card-action]") as HTMLElement;
    expect(action.tagName).toBe("BUTTON");
    expect(action.className).toContain("ntable-card-action");
    expect(action.className).not.toContain("opacity-0");
  });
});
