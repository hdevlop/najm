import { describe, test, expect } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const sampleData: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: `${i + 1}`,
  name: `User ${i + 1}`,
  age: 20 + (i % 50),
}));

const sampleColumns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={sampleData}
        columns={sampleColumns}
        dynamicHeight={false}
        showPagination={true}
        showAddButton={false}
        showCheckbox={false}
        showViewToggle={false}
        {...props}
      />
    </div>
  );
}

function getButtonByLabel(container: HTMLElement, label: string): HTMLElement | null {
  const all = container.querySelectorAll("[aria-label]");
  for (const el of all) {
    if (el.getAttribute("aria-label")?.toLowerCase().includes(label.toLowerCase())) {
      return el as HTMLElement;
    }
  }
  return null;
}

function clickButtonByAriaLabel(container: HTMLElement, label: string) {
  const btn = getButtonByLabel(container, label);
  if (btn) fireEvent.click(btn);
}

describe("NTable manual (server-side) pagination", () => {
  test("manualPagination calls onPaginationChange when next page is clicked", () => {
    let lastPagination: { pageIndex: number; pageSize: number } | null = null;
    const onPaginationChange = (pagination: { pageIndex: number; pageSize: number }) => {
      lastPagination = pagination;
    };

    const { container } = render(
      <TableWrapper
        manualPagination={true}
        pageCount={3}
        rowCount={30}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
      />
    );

    clickButtonByAriaLabel(container, "next");
    expect(lastPagination).toMatchObject({ pageIndex: 1, pageSize: 10 });
  });

  test("uncontrolled defaultPagination seeds initial page", () => {
    let lastPagination: { pageIndex: number; pageSize: number } | null = null;
    const onPaginationChange = (pagination: { pageIndex: number; pageSize: number }) => {
      lastPagination = pagination;
    };

    const { container } = render(
      <TableWrapper
        manualPagination={true}
        pageCount={5}
        rowCount={50}
        defaultPagination={{ pageIndex: 2, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
      />
    );

    // Navigate to next page
    clickButtonByAriaLabel(container, "next");
    // handlePaginationChange applies TanStack updater against storePagination ({pageIndex:2, pageSize:10})
    // Updater: old => ({ pageIndex: old.pageIndex + 1, pageSize: old.pageSize })
    // Result: { pageIndex: 3, pageSize: 10 }
    expect(lastPagination).toMatchObject({ pageIndex: 3, pageSize: 10 });
  });
});