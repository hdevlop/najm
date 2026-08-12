import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { useTable } from "../../src/components/table/hooks";
import { NTable } from "../../src/components/table/NTable";
import { NTableContent } from "../../src/components/table/NTableContent";
import { TableStoreContext } from "../../src/components/table/TableContext";
import { createTableStore, type TableStore } from "../../src/components/table/store";

interface Item {
  id: string;
  name: string;
}

const rows: Item[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1),
  name: `Item ${index + 1}`,
}));
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];

function ContentHarness() {
  useTable("table");
  return <NTableContent effectiveMode="table" />;
}

function renderContent(store: TableStore) {
  return render(
    <TableStoreContext.Provider value={store}>
      <ContentHarness />
    </TableStoreContext.Provider>,
  );
}

function createMeasuredStore(isPageSizeUserSelected: boolean) {
  return createTableStore({
    data: rows,
    columns,
    dynamicHeight: true,
    manualPagination: true,
    pagination: { pageIndex: 0, pageSize: 30 },
    calculatedPageSize: 10,
    hasMeasuredLayout: true,
    isPageSizeUserSelected,
    bordered: false,
    showCheckbox: false,
    showAddButton: false,
    showViewToggle: false,
  });
}

describe("NTable explicit Rows/page scrolling", () => {
  test("routes the Rows/page control through explicit user sizing", () => {
    const onPaginationChange = mock(() => {});
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={rows}
          columns={columns}
          dynamicHeight={false}
          manualPagination
          pagination={{ pageIndex: 2, pageSize: 10 }}
          pageCount={3}
          onPaginationChange={onPaginationChange}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
        />
      </div>,
    );

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    const option = [...document.querySelectorAll('[role="option"]')]
      .find((candidate) => candidate.textContent?.trim() === "30") as HTMLElement;
    fireEvent.click(option);

    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 30 });
  });

  test("marks an explicit page-size choice and stops automatic fit reports", async () => {
    const onPaginationChange = mock(() => {});
    const store = createTableStore({
      data: rows,
      columns,
      dynamicHeight: true,
      manualPagination: true,
      isPaginationControlled: true,
      pagination: { pageIndex: 4, pageSize: 10 },
      calculatedPageSize: 10,
      hasMeasuredLayout: true,
      bodyHeight: 608,
      bodyWidth: 900,
      onPaginationChange,
    });

    act(() => store.getState().setPageSizeFromUser(30));

    expect(store.getState().isPageSizeUserSelected).toBe(true);
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 30 });

    onPaginationChange.mockClear();
    store.getState().syncWithProps({ pagination: { pageIndex: 0, pageSize: 30 } });
    renderContent(store);
    await act(async () => { await Promise.resolve(); });
    expect(onPaginationChange).not.toHaveBeenCalled();
  });

  test("keeps automatic pages clamped to the measured fit", () => {
    const { container } = renderContent(createMeasuredStore(false));

    expect(container.querySelectorAll("tbody tr[data-row]")).toHaveLength(10);
  });

  test("renders every explicitly requested row inside a scrollable body", () => {
    const { container } = renderContent(createMeasuredStore(true));

    expect(container.querySelectorAll("tbody tr[data-row]")).toHaveLength(30);
    const scrollHost = container.querySelector("[data-bordered]");
    const scrollHostClasses = scrollHost?.getAttribute("class") ?? "";
    expect(scrollHostClasses).toContain("flex-1");
    expect(scrollHostClasses).not.toContain("shrink");
  });
});
