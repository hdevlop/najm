import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { Copy } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

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
    <div style={{ height: 600 }} data-testid="table-wrapper">
      <NTable
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox
        {...props}
      />
    </div>
  );
}

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector("[data-ntable-root]") as HTMLElement | null;
  if (!root) throw new Error("data-ntable-root not found");
  return root;
}

function getRowCheckbox(container: HTMLElement, rowId: string): HTMLElement {
  const cb = container.querySelector(`[aria-label="Select row ${rowId}"]`) as HTMLElement | null;
  if (!cb) throw new Error(`checkbox for row ${rowId} not found`);
  return cb;
}

function isRowSelected(container: HTMLElement, rowId: string): boolean {
  const cb = getRowCheckbox(container, rowId);
  // Radix checkbox exposes its state via the data-state attribute
  return cb.getAttribute("data-state") === "checked";
}

async function settle() {
  await new Promise((r) => setTimeout(r, 50));
}

describe("NTable keyboard shortcuts", () => {
  describe("Ctrl+A / Meta+A select all visible rows", () => {
    test("Ctrl+A on a focused row checkbox selects all visible rows", async () => {
      const { container } = render(<TableWrapper />);
      await settle();

      const root = getRoot(container);
      const target = getRowCheckbox(container, "1");
      fireEvent.keyDown(target, { key: "a", ctrlKey: true });
      await settle();

      // No event was prevented (or it was) — what matters is the selection
      expect(isRowSelected(container, "1")).toBe(true);
      expect(isRowSelected(container, "2")).toBe(true);
      expect(isRowSelected(container, "3")).toBe(true);
      // Sanity: the event was handled in the table root
      expect(root.contains(target)).toBe(true);
    });

    test("Meta+A on a focused row checkbox selects all visible rows", async () => {
      const { container } = render(<TableWrapper />);
      await settle();

      const target = getRowCheckbox(container, "2");
      fireEvent.keyDown(target, { key: "a", metaKey: true });
      await settle();

      expect(isRowSelected(container, "1")).toBe(true);
      expect(isRowSelected(container, "2")).toBe(true);
      expect(isRowSelected(container, "3")).toBe(true);
    });

    test("Ctrl+A on the header 'Select all' checkbox also selects all rows", async () => {
      const { container } = render(<TableWrapper />);
      await settle();

      const selectAll = container.querySelector('[aria-label="Select all rows"]') as HTMLElement;
      expect(selectAll).toBeTruthy();

      fireEvent.keyDown(selectAll, { key: "a", ctrlKey: true });
      await settle();

      expect(isRowSelected(container, "1")).toBe(true);
      expect(isRowSelected(container, "2")).toBe(true);
      expect(isRowSelected(container, "3")).toBe(true);
    });

    test("Ctrl+A is ignored when focus is inside the search filter input", async () => {
      const onRowSelectionChange = mock();
      const { container } = render(
        <TableWrapper
          filters={[{ type: "search", name: "global", placeholder: "Search users" }]}
          onRowSelectionChange={onRowSelectionChange}
        />
      );
      await settle();

      const searchInput = Array.from(container.querySelectorAll("input")).find(
        (i) => i.placeholder === "Search users"
      ) as HTMLInputElement;
      expect(searchInput).toBeTruthy();

      fireEvent.keyDown(searchInput, { key: "a", ctrlKey: true });
      await settle();

      // The selection callback was never fired — no row got selected
      expect(onRowSelectionChange).not.toHaveBeenCalled();
      expect(isRowSelected(container, "1")).toBe(false);
      expect(isRowSelected(container, "2")).toBe(false);
      expect(isRowSelected(container, "3")).toBe(false);
    });
  });

  describe("Escape clears selection and closes context menu", () => {
    test("Escape clears row selection when at least one row is selected", async () => {
      const onRowSelectionChange = mock();
      const { container } = render(<TableWrapper onRowSelectionChange={onRowSelectionChange} />);
      await settle();

      // Click checkbox to select row 1
      fireEvent.click(getRowCheckbox(container, "1"));
      await settle();
      expect(isRowSelected(container, "1")).toBe(true);
      onRowSelectionChange.mockClear();

      // Press Escape from inside the table
      fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Escape" });
      await settle();

      // Either controlled: callback fired with empty; or uncontrolled: rows deselected directly
      const lastCall = onRowSelectionChange.mock.calls.at(-1)?.[0] as Record<string, boolean> | undefined;
      const clearedViaCallback = lastCall !== undefined && Object.keys(lastCall).length === 0;
      const clearedViaDom = !isRowSelected(container, "1") && !isRowSelected(container, "2") && !isRowSelected(container, "3");
      expect(clearedViaCallback || clearedViaDom).toBe(true);
    });

    test("Escape is a no-op when no rows are selected and no context menu is open", async () => {
      const onRowSelectionChange = mock();
      const { container } = render(<TableWrapper onRowSelectionChange={onRowSelectionChange} />);
      await settle();

      fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Escape" });
      await settle();

      expect(onRowSelectionChange).not.toHaveBeenCalled();
    });

    test("Escape closes the open NTable context menu", async () => {
      const onCopy = mock();
      const { container } = render(
        <TableWrapper
          menu={{ row: () => [{ label: "Copy", icon: Copy, onSelect: onCopy }] }}
        />
      );
      await settle();

      const row1 = container.querySelector("tbody tr[data-row]") as HTMLElement;
      fireEvent.contextMenu(row1);
      await settle();

      // Menu is open
      expect(document.querySelector("[data-context-menu]")).toBeTruthy();

      // Press Escape from a row checkbox (still inside the table)
      fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Escape" });
      await settle();

      expect(document.querySelector("[data-context-menu]")).toBeNull();
      // onCopy must not have been triggered
      expect(onCopy).not.toHaveBeenCalled();
    });

    test("Escape is ignored when focus is in the search filter input", async () => {
      const onRowSelectionChange = mock();
      const { container } = render(
        <TableWrapper
          filters={[{ type: "search", name: "global", placeholder: "Search users" }]}
          onRowSelectionChange={onRowSelectionChange}
        />
      );
      await settle();

      // Pre-select row 1
      fireEvent.click(getRowCheckbox(container, "1"));
      await settle();
      expect(isRowSelected(container, "1")).toBe(true);
      onRowSelectionChange.mockClear();

      // Press Escape from inside the search input
      const searchInput = Array.from(container.querySelectorAll("input")).find(
        (i) => i.placeholder === "Search users"
      ) as HTMLInputElement;
      fireEvent.keyDown(searchInput, { key: "Escape" });
      await settle();

      // Row 1 is still selected — our handler did not run
      expect(isRowSelected(container, "1")).toBe(true);
      expect(onRowSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe("Delete / Backspace trigger onBulkDelete", () => {
    test("Delete calls onBulkDelete with the selected row ids", async () => {
      const onBulkDelete = mock();
      const { container } = render(<TableWrapper onBulkDelete={onBulkDelete} />);
      await settle();

      fireEvent.click(getRowCheckbox(container, "1"));
      fireEvent.click(getRowCheckbox(container, "3"));
      await settle();

      fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Delete" });
      await settle();

      expect(onBulkDelete).toHaveBeenCalledTimes(1);
      expect(onBulkDelete.mock.calls[0][0]).toEqual(["1", "3"]);
    });

    test("Backspace calls onBulkDelete with the selected row ids", async () => {
      const onBulkDelete = mock();
      const { container } = render(<TableWrapper onBulkDelete={onBulkDelete} />);
      await settle();

      fireEvent.click(getRowCheckbox(container, "2"));
      await settle();

      fireEvent.keyDown(getRowCheckbox(container, "2"), { key: "Backspace" });
      await settle();

      expect(onBulkDelete).toHaveBeenCalledTimes(1);
      expect(onBulkDelete.mock.calls[0][0]).toEqual(["2"]);
    });

    test("Delete is a no-op when onBulkDelete is not provided", async () => {
      const { container } = render(<TableWrapper />);
      await settle();

      fireEvent.click(getRowCheckbox(container, "1"));
      await settle();

      // Should not throw even without an onBulkDelete handler
      expect(() => {
        fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Delete" });
      }).not.toThrow();
      await settle();
    });

    test("Delete is a no-op when no rows are selected", async () => {
      const onBulkDelete = mock();
      const { container } = render(<TableWrapper onBulkDelete={onBulkDelete} />);
      await settle();

      fireEvent.keyDown(getRowCheckbox(container, "1"), { key: "Delete" });
      await settle();

      expect(onBulkDelete).not.toHaveBeenCalled();
    });

    test("Delete is ignored when focus is in the search filter input", async () => {
      const onBulkDelete = mock();
      const { container } = render(
        <TableWrapper
          filters={[{ type: "search", name: "global", placeholder: "Search users" }]}
          onBulkDelete={onBulkDelete}
        />
      );
      await settle();

      fireEvent.click(getRowCheckbox(container, "1"));
      await settle();

      const searchInput = Array.from(container.querySelectorAll("input")).find(
        (i) => i.placeholder === "Search users"
      ) as HTMLInputElement;
      fireEvent.keyDown(searchInput, { key: "Delete" });
      await settle();

      expect(onBulkDelete).not.toHaveBeenCalled();
      expect(isRowSelected(container, "1")).toBe(true);
    });
  });

  describe("scope: shortcuts only fire inside the active NTable", () => {
    test("Ctrl+A in table A does not select rows in table B", async () => {
      const { container } = render(
        <div>
          <div data-testid="table-a">
            <NTable
              data={data}
              columns={columns}
              getRowId={(r) => r.id}
              dynamicHeight={false}
              showPagination={false}
              showAddButton={false}
              showCheckbox
            />
          </div>
          <div data-testid="table-b">
            <NTable
              data={data}
              columns={columns}
              getRowId={(r) => r.id}
              dynamicHeight={false}
              showPagination={false}
              showAddButton={false}
              showCheckbox
            />
          </div>
        </div>
      );
      await settle();

      const roots = Array.from(container.querySelectorAll("[data-ntable-root]")) as HTMLElement[];
      expect(roots.length).toBe(2);
      const rootA = roots[0];
      const rootB = roots[1];

      // Pick the first checkbox in table A
      const cbA = rootA.querySelector('[aria-label="Select row 1"]') as HTMLElement;
      expect(cbA).toBeTruthy();
      fireEvent.keyDown(cbA, { key: "a", ctrlKey: true });
      await settle();

      // Every row in A is selected
      const allA = Array.from(rootA.querySelectorAll('[aria-label^="Select row "]'));
      for (const cb of allA) {
        expect((cb as HTMLElement).getAttribute("data-state")).toBe("checked");
      }
      // No row in B is selected
      const allB = Array.from(rootB.querySelectorAll('[aria-label^="Select row "]'));
      for (const cb of allB) {
        expect((cb as HTMLElement).getAttribute("data-state")).not.toBe("checked");
      }
    });

    test("Delete in table A does not call table B's onBulkDelete", async () => {
      const onBulkDeleteA = mock();
      const onBulkDeleteB = mock();
      const { container } = render(
        <div>
          <NTable
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            dynamicHeight={false}
            showPagination={false}
            showAddButton={false}
            showCheckbox
            onBulkDelete={onBulkDeleteA}
          />
          <NTable
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            dynamicHeight={false}
            showPagination={false}
            showAddButton={false}
            showCheckbox
            onBulkDelete={onBulkDeleteB}
          />
        </div>
      );
      await settle();

      const roots = Array.from(container.querySelectorAll("[data-ntable-root]")) as HTMLElement[];
      const rootA = roots[0];
      const cbA = rootA.querySelector('[aria-label="Select row 1"]') as HTMLElement;
      fireEvent.click(cbA);
      await settle();
      fireEvent.keyDown(cbA, { key: "Delete" });
      await settle();

      expect(onBulkDeleteA).toHaveBeenCalledTimes(1);
      expect(onBulkDeleteA.mock.calls[0][0]).toEqual(["1"]);
      expect(onBulkDeleteB).not.toHaveBeenCalled();
    });
  });

  describe("regression: existing selection behavior still works", () => {
    test("clicking a row checkbox selects that row", async () => {
      const onRowSelectionChange = mock();
      const { container } = render(<TableWrapper onRowSelectionChange={onRowSelectionChange} />);
      await settle();

      fireEvent.click(getRowCheckbox(container, "2"));
      await settle();

      expect(onRowSelectionChange).toHaveBeenCalled();
      const lastCall = onRowSelectionChange.mock.calls.at(-1)![0] as Record<string, boolean>;
      expect(lastCall["2"]).toBe(true);
    });

    test("data-ntable-root attribute is present on the table root", async () => {
      const { container } = render(<TableWrapper />);
      await settle();
      const root = container.querySelector("[data-ntable-root]") as HTMLElement;
      expect(root).toBeTruthy();
    });
  });
});
