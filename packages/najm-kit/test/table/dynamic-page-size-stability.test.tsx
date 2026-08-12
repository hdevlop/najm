import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";
import {
  shouldDeferCardPageSizeUntilRows,
  useDynamicPageSize,
} from "../../src/components/table/hooks";
import { TableStoreContext } from "../../src/components/table/TableContext";
import { createTableStore, type TableStore } from "../../src/components/table/store";

interface Item { id: string; name: string }
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];
const rows: Item[] = Array.from({ length: 24 }, (_, index) => ({
  id: String(index + 1),
  name: `Item ${index + 1}`,
}));

function Card({ data }: { data: Item }) {
  return <div data-testid="item-card">{data.name}</div>;
}

function renderTable(onPaginationChange: (p: unknown) => void, data = rows) {
  return (
    <div style={{ height: 600 }}>
      <NTable<Item>
        data={data}
        columns={columns}
        renderCard={Card as any}
        mode="cards"
        dynamicHeight
        manualPagination
        pagination={{ pageIndex: 0, pageSize: 25 }}
        pageCount={2}
        onPaginationChange={onPaginationChange}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
      />
    </div>
  );
}

/**
 * A server-paginated consumer refetches on every reported page size, so each
 * extra report is a wasted request and a visible loading skeleton.
 *
 * Observed in a real catalog before this was fixed: 25 (caller) -> 10 (store
 * default reported before anything was measured) -> 24 (cards measured, images
 * not yet decoded) -> 16 (cards measured, images decoded). Four cache entries,
 * three refetches, two skeleton flashes for one page visit.
 */
/**
 * An empty table that is not loading deliberately hides its toolbar and its
 * pagination bar, and `useDynamicPageSize` refuses to measure that layout —
 * the body is taller there than it will ever be with rows in it, and a page
 * size taken from it is wrong the moment the rows arrive. These tests are about
 * the measurement itself, so they describe a table that has something to show.
 */
const MEASURABLE_ROWS = [{ id: "1" }];

describe("dynamic page size stability under manual pagination", () => {
  test("waits for real cards before publishing the initial card page size", () => {
    expect(shouldDeferCardPageSizeUntilRows("cards", false)).toBe(true);
    expect(shouldDeferCardPageSizeUntilRows("cards", true)).toBe(false);
    expect(shouldDeferCardPageSizeUntilRows("table", false)).toBe(false);
  });

  test("never reports the seeded default before a real measurement", async () => {
    const store = createTableStore();
    store.getState().syncWithProps({
      dynamicHeight: true,
      viewMode: "cards",
      manualPagination: true,
    });
    // The store seeds a non-zero calculatedPageSize, which previously looked
    // like a measurement and was reported verbatim.
    expect(store.getState().calculatedPageSize).toBeGreaterThan(0);
    expect(store.getState().hasMeasuredLayout).toBe(false);
  });

  test("reports at most once for one container across content changes", async () => {
    const onPaginationChange = mock(() => {});
    const { rerender } = render(renderTable(onPaginationChange));

    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    const afterSettle = onPaginationChange.mock.calls.length;

    // Content grows, as it does when images decode and cards get taller. The
    // container box is unchanged, so this must not trigger another report.
    rerender(renderTable(onPaginationChange, [...rows, { id: "25", name: "Item 25" }]));
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });

    expect(onPaginationChange.mock.calls.length).toBe(afterSettle);
    expect(afterSettle).toBeLessThanOrEqual(1);
  });

  test("a settling view mode does not produce a second report", async () => {
    const onPaginationChange = mock(() => {});
    // Start in table mode, then resolve to cards, which is what the responsive
    // view-mode resolution does across the first paint.
    const { rerender } = render(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={rows}
          columns={columns}
          renderCard={Card as any}
          mode="table"
          dynamicHeight
          manualPagination
          pagination={{ pageIndex: 0, pageSize: 25 }}
          pageCount={2}
          onPaginationChange={onPaginationChange}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
        />
      </div>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    rerender(renderTable(onPaginationChange));
    await act(async () => { await new Promise((r) => setTimeout(r, 700)); });

    expect(onPaginationChange.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("useDynamicPageSize measurement flag", () => {
  function Harness() {
    const ref = React.useRef<HTMLDivElement | null>(null);
    useDynamicPageSize(ref);
    return (
      <div
        ref={(node) => {
          ref.current = node;
          if (node) Object.defineProperty(node, "clientHeight", { configurable: true, value: 1000 });
        }}
        data-ntable-root
      >
        <div
          ref={(node) => {
            if (node) Object.defineProperty(node, "clientHeight", { configurable: true, value: 500 });
          }}
          data-ntable-body
        />
      </div>
    );
  }

  test("flips only once the container has real dimensions", async () => {
    const store: TableStore = createTableStore();
    store.getState().syncWithProps({ dynamicHeight: true, viewMode: "table", manualPagination: true, data: MEASURABLE_ROWS });
    render(
      <TableStoreContext.Provider value={store}>
        <Harness />
      </TableStoreContext.Provider>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(store.getState().hasMeasuredLayout).toBe(true);
  });
});

/**
 * Zustand serves `getInitialState()` as the snapshot for server rendering and
 * for the hydration render. Seeding the store with a `set()` call after
 * creation therefore left the first paint reading raw defaults: `isLoading`
 * false while the caller passed true (empty state instead of skeleton), and
 * `manualPagination` false long enough for a layout effect to push a default
 * page size at a consumer that owns pagination.
 */
describe("store seed is part of the initial state", () => {
  test("getInitialState reflects seeded props, not raw defaults", () => {
    const seeded = createTableStore({
      isLoading: true,
      manualPagination: true,
      isPaginationControlled: true,
      pagination: { pageIndex: 0, pageSize: 25 },
    } as never);

    const initial = (seeded as unknown as {
      getInitialState: () => {
        isLoading: boolean;
        manualPagination: boolean;
        pagination: { pageSize: number };
        hasNoData: boolean;
      };
    }).getInitialState();

    expect(initial.isLoading).toBe(true);
    expect(initial.manualPagination).toBe(true);
    expect(initial.pagination.pageSize).toBe(25);
  });

  test("an unseeded store keeps its defaults", () => {
    const plain = createTableStore();
    expect(plain.getState().isLoading).toBe(false);
    expect(plain.getState().manualPagination).toBe(false);
  });
});
