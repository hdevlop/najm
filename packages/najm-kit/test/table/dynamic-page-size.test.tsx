import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { calculateCardSkeletonCount, calculateDynamicPageSize } from "../../src/components/table/hooks";
import { useDynamicPageSize } from "../../src/components/table/hooks";
import { TableStoreContext } from "../../src/components/table/TableContext";
import { createTableStore, type TableStore } from "../../src/components/table/store";

function setMeasuredSize(el: HTMLElement | null, sizes: { clientHeight?: number; offsetHeight?: number }) {
  if (!el) return;
  for (const [key, value] of Object.entries(sizes)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

function DynamicSizingHarness() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  useDynamicPageSize(containerRef);

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setMeasuredSize(node, { clientHeight: 1000 });
      }}
      data-ntable-root
    >
      <div ref={(node) => setMeasuredSize(node, { offsetHeight: 100 })} data-ntable-header />
      <div ref={(node) => setMeasuredSize(node, { clientHeight: 500 })} data-ntable-body>
        <table>
          <thead ref={(node) => setMeasuredSize(node, { offsetHeight: 48 })} data-ntable-table-header />
        </table>
      </div>
      <div ref={(node) => setMeasuredSize(node, { offsetHeight: 100 })} data-ntable-pagination />
    </div>
  );
}

function renderWithStore(store: TableStore) {
  return render(
    <TableStoreContext.Provider value={store}>
      <DynamicSizingHarness />
    </TableStoreContext.Provider>
  );
}

/**
 * An empty table that is not loading deliberately hides its toolbar and its
 * pagination bar, and `useDynamicPageSize` refuses to measure that layout —
 * the body is taller there than it will ever be with rows in it, and a page
 * size taken from it is wrong the moment the rows arrive. These tests are about
 * the measurement itself, so they describe a table that has something to show.
 */
const MEASURABLE_ROWS = [{ id: "1" }];

describe("calculateDynamicPageSize", () => {
  test("returns at least 1 when body is empty", () => {
    expect(calculateDynamicPageSize({ bodyHeight: 0, tableHeaderHeight: 0 })).toBe(1);
  });

  test("returns 1 when only table header fits", () => {
    // bodyHeight == tableHeaderHeight → 0 available → 1
    expect(calculateDynamicPageSize({ bodyHeight: 48, tableHeaderHeight: 48 })).toBe(1);
  });

  test("returns 1 when body is smaller than table header", () => {
    expect(calculateDynamicPageSize({ bodyHeight: 20, tableHeaderHeight: 48 })).toBe(1);
  });

  test("computes rows from remaining body space", () => {
    // bodyHeight=320, tableHeaderHeight=48 → 272/56 = 4.857 → 4
    expect(calculateDynamicPageSize({ bodyHeight: 320, tableHeaderHeight: 48 })).toBe(4);
  });

  test("uses default row height of 56 when none provided", () => {
    // bodyHeight=48+3*56 = 216 → 3
    expect(calculateDynamicPageSize({ bodyHeight: 216, tableHeaderHeight: 48 })).toBe(3);
  });

  test("honors a custom row height", () => {
    // bodyHeight=300, tableHeaderHeight=48, rowHeight=40 → 252/40 = 6.3 → 6
    expect(calculateDynamicPageSize({ bodyHeight: 300, tableHeaderHeight: 48, rowHeight: 40 })).toBe(6);
  });

  test("never returns 0 even for very small positive area", () => {
    expect(calculateDynamicPageSize({ bodyHeight: 49, tableHeaderHeight: 48 })).toBe(1);
  });

  test("matches the plan example: bodyHeight=500, tableHeaderHeight=48 → 8 rows", () => {
    // (500-48)/56 = 8.07 → 8
    expect(calculateDynamicPageSize({ bodyHeight: 500, tableHeaderHeight: 48 })).toBe(8);
  });

  test("useDynamicPageSize uses the measured body slot before root fallback", async () => {
    const store = createTableStore();
    store.getState().syncWithProps({ dynamicHeight: true, viewMode: "table", manualPagination: false, data: MEASURABLE_ROWS });

    renderWithStore(store);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState().calculatedPageSize).toBe(8);
    expect(store.getState().maxHeight).toBe(48 + 8 * 56);
  });

  test("useDynamicPageSize measures manual pagination but does not constrain it", async () => {
    const store = createTableStore();
    store.getState().syncWithProps({
      dynamicHeight: true,
      viewMode: "table",
      manualPagination: true,
      data: MEASURABLE_ROWS,
      calculatedPageSize: 10,
      maxHeight: null,
    });

    renderWithStore(store);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The measurement is published so a server-paginated table can fill its
    // container; useTable reports it through onPaginationChange rather than
    // mutating the table, so the consumer still owns fetching.
    expect(store.getState().calculatedPageSize).toBe(8);
    // maxHeight stays caller-owned under manual pagination.
    expect(store.getState().maxHeight).toBeNull();
    expect(store.getState().skeletonRowCount).toBe(8);
  });

  test("publishes a card page size under manual pagination", async () => {
    const store = createTableStore();
    store.getState().syncWithProps({
      dynamicHeight: true,
      viewMode: "cards",
      manualPagination: true,
      data: MEASURABLE_ROWS,
      cardRowHeight: 176,
      cardGap: 12,
    });

    renderWithStore(store);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Column count is measured from the rendered grid, not from props. This
    // harness renders no cards grid and has zero width, so it falls back to a
    // single column: bodyHeight 500 → floor((500+12)/188) = 2 whole rows × 1.
    // The floor semantics themselves are covered in infinite-continuation.
    expect(store.getState().calculatedCardPageSize).toBe(2);
  });

  test("calculates complete card-grid rows for one through four columns", () => {
    expect(calculateCardSkeletonCount({ bodyHeight: 500, columnCount: 1, cardHeight: 160, gap: 12 })).toBe(3);
    expect(calculateCardSkeletonCount({ bodyHeight: 500, columnCount: 2, cardHeight: 160, gap: 12 })).toBe(6);
    expect(calculateCardSkeletonCount({ bodyHeight: 500, columnCount: 3, cardHeight: 160, gap: 12 })).toBe(9);
    expect(calculateCardSkeletonCount({ bodyHeight: 500, columnCount: 4, cardHeight: 160, gap: 12 })).toBe(12);
  });
});
