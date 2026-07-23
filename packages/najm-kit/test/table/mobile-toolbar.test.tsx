import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  guardian: string;
  status: string;
}

const data: Row[] = [
  { id: "1", name: "Family one", guardian: "Guardian one", status: "active" },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "guardian", header: "Guardian" },
  { accessorKey: "status", header: "Status" },
];

const filters = [
  { type: "text", name: "name", placeholder: "Search families" },
  { type: "text", name: "guardian", placeholder: "Search guardians" },
  {
    type: "select",
    name: "status",
    placeholder: "Filter by status",
    options: [{ value: "active", label: "Active" }],
  },
];

describe("NTable mobile toolbar", () => {
  test("keeps the first filter inline and moves remaining filters into a popover", async () => {
    const onCreate = mock();
    const { container } = render(
      <NTable
        data={data}
        columns={columns}
        filters={filters}
        onCreate={onCreate}
        addButtonText="Create family"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
        showViewToggle={false}
      />,
    );

    const mobileToolbar = container.querySelector("[data-ntable-mobile-toolbar]") as HTMLElement;
    const primaryFilter = mobileToolbar.querySelector("[data-ntable-mobile-primary-filter]") as HTMLElement;

    expect(primaryFilter.querySelector("input[placeholder='Search families']")).toBeTruthy();
    expect(primaryFilter.querySelector("svg")).toBeTruthy();
    expect(mobileToolbar.querySelector("input[placeholder='Search guardians']")).toBeNull();
    expect(mobileToolbar.querySelector("[aria-label='Filter by status']")).toBeNull();

    const filtersButton = mobileToolbar.querySelector("button[aria-label='Filters']") as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(filtersButton);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const filtersPopover = document.querySelector("[aria-label='Table filters']") as HTMLElement;
    expect(filtersPopover).toBeTruthy();
    expect(filtersPopover.querySelector("input[placeholder='Search guardians']")).toBeTruthy();
    expect(filtersPopover.textContent).toContain("Filter by status");

    const addButton = mobileToolbar.querySelector("button[aria-label='Create family']") as HTMLButtonElement;
    fireEvent.click(addButton);
    expect(onCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(filtersButton);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  });

  test("keeps every filter in the desktop filter row", () => {
    const { container } = render(
      <NTable
        data={data}
        columns={columns}
        filters={filters}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        showViewToggle={false}
      />,
    );

    const desktopFilters = container.querySelector("[data-ntable-desktop-filters]") as HTMLElement;
    expect(desktopFilters.querySelector("input[placeholder='Search families']")).toBeTruthy();
    expect(desktopFilters.querySelector("input[placeholder='Search guardians']")).toBeTruthy();
    expect(desktopFilters.textContent).toContain("Filter by status");
  });
});
