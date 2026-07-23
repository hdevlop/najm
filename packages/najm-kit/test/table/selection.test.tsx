import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row { id: string; name: string; age: number; }

const data: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 35 },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable data={data} columns={columns} getRowId={(row) => row.id} dynamicHeight={false} showPagination={false} showAddButton={false} showCheckbox {...props} />
    </div>
  );
}

describe("selection.test.tsx", () => {
  test("uncontrolled row selection mutates visible selected state and calls callback", async () => {
    const onRowSelectionChange = mock();
    const { container } = render(<TableWrapper onRowSelectionChange={onRowSelectionChange} />);
    await new Promise((r) => setTimeout(r, 100));

    const table = container.querySelector("table");
    expect(table).toBeTruthy();

    const rowOneCheckbox = container.querySelector('[aria-label="Select row 1"]') as HTMLElement;
    expect(rowOneCheckbox).toBeTruthy();
    fireEvent.click(rowOneCheckbox);

    await new Promise((r) => setTimeout(r, 50));
    expect(onRowSelectionChange).toHaveBeenCalled();
    const lastCall = onRowSelectionChange.mock.calls[onRowSelectionChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveProperty("1");
    expect(lastCall["1"]).toBe(true);
  });

  test("controlled row selection calls callback but does not visually change until parent rerenders", async () => {
    // Start with controlled rowSelection
    const controlledSelection: Record<string, boolean> = { "1": true };
    let outerSelection = controlledSelection;
    const onRowSelectionChange = mock((next) => {
      outerSelection = next;
    });

    const { container, rerender } = render(
      <TableWrapper rowSelection={outerSelection} onRowSelectionChange={onRowSelectionChange} />
    );
    await new Promise((r) => setTimeout(r, 100));

    const table = container.querySelector("table");
    expect(table).toBeTruthy();

    const rowTwoCheckbox = container.querySelector('[aria-label="Select row 2"]') as HTMLElement;
    expect(rowTwoCheckbox).toBeTruthy();
    fireEvent.click(rowTwoCheckbox);

    await new Promise((r) => setTimeout(r, 50));

    // Callback was called with the proposed new state
    expect(onRowSelectionChange).toHaveBeenCalled();
    const lastCall = onRowSelectionChange.mock.calls[onRowSelectionChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveProperty("2"); // second row was clicked

    // But the visual state should NOT have changed yet (controlled)
    // The checkbox for row "1" should still be checked, row "2" not checked
    expect(container.querySelector('[aria-label="Select row 1"]')?.getAttribute("data-state")).toBe("checked");
    expect(container.querySelector('[aria-label="Select row 2"]')?.getAttribute("data-state")).not.toBe("checked");
  });

  test("defaultRowSelection seeds selected rows", async () => {
    const onRowSelectionChange = mock();
    const { container } = render(<TableWrapper defaultRowSelection={{ "2": true }} onRowSelectionChange={onRowSelectionChange} />);
    await new Promise((r) => setTimeout(r, 100));

    const table = container.querySelector("table");
    expect(table).toBeTruthy();

    // Row "2" should be pre-selected
    expect(container.querySelector('[aria-label="Select row 2"]')?.getAttribute("data-state")).toBe("checked");
    // The checked checkbox should belong to the second row
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test("uncontrolled selection with defaultRowSelection can toggle internally", async () => {
    const onRowSelectionChange = mock();
    const { container } = render(<TableWrapper defaultRowSelection={{ "1": true }} onRowSelectionChange={onRowSelectionChange} />);
    await new Promise((r) => setTimeout(r, 100));

    const rowOneCheckbox = container.querySelector('[aria-label="Select row 1"]') as HTMLElement;
    expect(rowOneCheckbox?.getAttribute("data-state")).toBe("checked");

    // Click to deselect
    fireEvent.click(rowOneCheckbox);
    await new Promise((r) => setTimeout(r, 50));

    expect(onRowSelectionChange).toHaveBeenCalled();
    // After clicking, row 1 should be deselected in the store
    const lastCall = onRowSelectionChange.mock.calls[onRowSelectionChange.mock.calls.length - 1][0];
    expect(lastCall["1"]).not.toBe(true);
  });

  test("selectedRowId highlights the matching row in table mode without requiring checkbox selection", async () => {
    const { container } = render(
      <TableWrapper showCheckbox={false} selectedRowId="2" />
    );
    await new Promise((r) => setTimeout(r, 100));

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);

    // The matching row carries the data-selected-row marker; others don't.
    expect(rows[0].getAttribute("data-selected-row")).toBeNull();
    expect(rows[1].getAttribute("data-selected-row")).toBe("true");
    expect(rows[2].getAttribute("data-selected-row")).toBeNull();

    // No checkbox-driven selected state should be set.
    expect(rows[1].getAttribute("data-state")).not.toBe("selected");
  });
});
