import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const rows: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

const originalWarn = console.warn;

afterEach(() => {
  console.warn = originalWarn;
});

function TableWrapper(props: Partial<NTableProps<Row, "table" | "json" | "files">>) {
  return (
    <div style={{ height: 600 }}>
      <NTable<Row, "table" | "json" | "files">
        data={rows}
        columns={columns}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        jsonValue={{ rows }}
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

describe("NTable custom modes", () => {
  test("availableModes={['table', 'json', 'files']} shows the Files switcher button", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle
        availableModes={["table", "json", "files"] as const}
        renderCustomMode={{
          files: () => <div data-testid="files-view">Files View</div>,
        }}
      />,
    );

    expect(getButtonByLabel(container, "table")).toBeTruthy();
    expect(getButtonByLabel(container, "json")).toBeTruthy();
    expect(getButtonByLabel(container, "files")).toBeTruthy();
  });

  test("renderCustomMode renders files content without built-in table content", () => {
    const { container } = render(
      <TableWrapper
        mode="files"
        showViewToggle
        availableModes={["table", "json", "files"] as const}
        renderCustomMode={{
          files: () => <div data-testid="files-view">Files View</div>,
        }}
      />,
    );

    expect(container.querySelector("[data-testid='files-view']")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector(".cm-editor")).toBeNull();
  });

  test("custom mode hides table filters and renderToolbar output", () => {
    const { container } = render(
      <TableWrapper
        mode="files"
        showViewToggle
        availableModes={["table", "json", "files"] as const}
        filters={[{ name: "name", type: "text", placeholder: "Filter name" }]}
        renderToolbar={() => <div data-testid="table-toolbar">Toolbar</div>}
        renderCustomMode={{
          files: () => <div data-testid="files-view">Files View</div>,
        }}
      />,
    );

    expect(container.querySelector("[data-testid='files-view']")).toBeTruthy();
    expect(container.querySelector("[data-testid='table-toolbar']")).toBeNull();
    expect(container.querySelector("input[placeholder='Filter name']")).toBeNull();
  });

  test("warns in development when custom render keys are not in availableModes", async () => {
    const warn = mock(() => {});
    console.warn = warn as unknown as typeof console.warn;

    render(
      <TableWrapper
        showViewToggle
        availableModes={["table", "json", "files"] as const}
        renderCustomMode={{
          files: () => <div data-testid="files-view">Files View</div>,
          timeline: () => <div>Timeline</div>,
        }}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("timeline");
  });
});
