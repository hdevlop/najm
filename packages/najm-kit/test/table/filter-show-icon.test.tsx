import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  status: string;
}

const data: Row[] = [{ id: "1", name: "Alice", status: "active" }];
const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

function TableWrapper(props: Partial<React.ComponentProps<typeof NTable<Row>>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={data}
        columns={columns}
        dynamicHeight={false}
        showPagination={false}
        showViewToggle={false}
        showAddButton={false}
        showCheckbox={false}
        {...props}
      />
    </div>
  );
}

function findFilterWrapper(container: HTMLElement, placeholder: string): HTMLElement | null {
  const trigger = container.querySelector(
    `button[aria-label='${placeholder}'], [role='combobox']`,
  );
  if (!trigger) return null;
  const wrapper = trigger.closest("div[class*='relative']");
  return wrapper as HTMLElement | null;
}

describe("NTable filter showIcon opt-out", () => {
  test("select filter shows the filter icon by default", () => {
    const { container } = render(
      <TableWrapper
        filters={[
          {
            type: "select",
            name: "status",
            placeholder: "Filter by status",
            onChange: mock(),
            options: [{ value: "active", label: "Active" }],
          },
        ]}
      />
    );

    const wrapper = findFilterWrapper(container, "Filter by status");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector("svg.lucide-filter")).toBeTruthy();
  });

  test("select filter hides the filter icon when showIcon is false", () => {
    const { container } = render(
      <TableWrapper
        filters={[
          {
            type: "select",
            name: "status",
            placeholder: "Filter by status",
            showIcon: false,
            onChange: mock(),
            options: [{ value: "active", label: "Active" }],
          },
        ]}
      />
    );

    const wrapper = findFilterWrapper(container, "Filter by status");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector("svg.lucide-filter")).toBeNull();
  });

  test("combobox filter hides the filter icon when showIcon is false", () => {
    const { container } = render(
      <TableWrapper
        filters={[
          {
            type: "combobox",
            name: "status",
            placeholder: "Filter by role",
            showIcon: false,
            onChange: mock(),
            options: [{ value: "admin", label: "Admin" }],
          },
        ]}
      />
    );

    const wrapper = findFilterWrapper(container, "Filter by role");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector("svg.lucide-filter")).toBeNull();
  });
});