import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { useTable } from "../../src/components/table/hooks";
import { NTableCards } from "../../src/components/table/NTableCards";
import { TableStoreContext } from "../../src/components/table/TableContext";
import { createTableStore, type TableStore } from "../../src/components/table/store";

interface Item {
  id: string;
  name: string;
}

const rows: Item[] = Array.from({ length: 24 }, (_, index) => ({
  id: String(index + 1),
  name: `Item ${index + 1}`,
}));
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];

function Card({ data }: { data: Item }) {
  return <div>{data.name}</div>;
}

function CardsHarness() {
  useTable("cards");
  return <NTableCards effectiveMode="cards" />;
}

function renderCards(store: TableStore) {
  return render(
    <TableStoreContext.Provider value={store}>
      <CardsHarness />
    </TableStoreContext.Provider>,
  );
}

/**
 * A measured card grid. `calculatedCardPageSize` is what `useDynamicPageSize`
 * publishes after measuring the container; seeding it directly keeps these
 * tests about what `useTable` does with the measurement rather than about
 * jsdom's willingness to report a layout.
 */
function createCardStore(overrides: Record<string, unknown> = {}) {
  return createTableStore({
    data: rows,
    columns,
    CardComponent: Card,
    viewMode: "cards",
    effectiveViewMode: "cards",
    cardPagination: { mode: "paged" },
    dynamicHeight: true,
    manualPagination: false,
    calculatedCardPageSize: 8,
    hasMeasuredLayout: true,
    bodyHeight: 500,
    bodyWidth: 900,
    cardColumnCount: 4,
    showCheckbox: false,
    showAddButton: false,
    showViewToggle: false,
    ...overrides,
  } as never);
}

const renderedCards = (container: HTMLElement) => container.querySelectorAll("[data-row]").length;

/**
 * Card grids that page client-side used to pin their page size to
 * `data.length`, so every row landed on page one however few of them fitted the
 * viewport. The measurement that says how many fit already existed — it was
 * only ever applied to server-paginated grids.
 */
describe("client-side card grids page at the measured size", () => {
  test("applies the measured card page size instead of the whole dataset", async () => {
    const store = createCardStore();
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination.pageSize).toBe(8);
    expect(renderedCards(container)).toBe(8);
  });

  test("pages the rest of the dataset rather than reporting a single page", async () => {
    const store = createCardStore();
    renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().table?.getPageCount()).toBe(3);
  });

  test("advancing a page keeps the measured size", async () => {
    const store = createCardStore();
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    act(() => store.getState().setPagination({ pageIndex: 2, pageSize: 8 }));
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination).toEqual({ pageIndex: 2, pageSize: 8 });
    expect(renderedCards(container)).toBe(8);
  });
});

/**
 * Rendering every supplied row stays the answer wherever there is no
 * measurement to fit the grid to. Falling back to the store's seeded page size
 * would silently clip a card list that had simply never been measured.
 */
describe("client-side card grids without a measurement", () => {
  test("renders every row before the container has been measured", async () => {
    const store = createCardStore({ hasMeasuredLayout: false, calculatedCardPageSize: 0 });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination.pageSize).toBe(rows.length);
    expect(renderedCards(container)).toBe(rows.length);
  });

  test("renders every row when the caller opted out of dynamic sizing", async () => {
    const store = createCardStore({ dynamicHeight: false });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination.pageSize).toBe(rows.length);
    expect(renderedCards(container)).toBe(rows.length);
  });

  test("hands over to the measured size once the container reports one", async () => {
    const store = createCardStore({ hasMeasuredLayout: false, calculatedCardPageSize: 0 });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });
    expect(renderedCards(container)).toBe(rows.length);

    await act(async () => {
      store.getState().syncWithProps({ hasMeasuredLayout: true, calculatedCardPageSize: 8 });
      await Promise.resolve();
    });

    expect(store.getState().pagination.pageSize).toBe(8);
    expect(renderedCards(container)).toBe(8);
  });
});

/**
 * The measurement is a default, not an override. Every existing way of owning
 * the page size still wins.
 */
describe("card page sizing yields to the caller", () => {
  test("leaves a controlled pagination prop alone", async () => {
    const store = createCardStore({
      isPaginationControlled: true,
      pagination: { pageIndex: 0, pageSize: 6 },
    });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination.pageSize).toBe(6);
    expect(renderedCards(container)).toBe(6);
  });

  test("leaves an explicit Rows/page choice alone", async () => {
    const store = createCardStore({
      isPageSizeUserSelected: true,
      pagination: { pageIndex: 0, pageSize: 20 },
    });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(store.getState().pagination.pageSize).toBe(20);
    expect(renderedCards(container)).toBe(20);
  });

  test("still reports rather than applies when the caller is fetching", async () => {
    const onPaginationChange = mock(() => {});
    const store = createCardStore({
      manualPagination: true,
      isPaginationControlled: true,
      pagination: { pageIndex: 0, pageSize: 25 },
      pageCount: 3,
      onPaginationChange,
    });
    renderCards(store);
    await act(async () => { await Promise.resolve(); });

    // The consumer owns fetching, so the size arrives as a request and the
    // store keeps the page size the caller passed in.
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 8 });
    expect(store.getState().pagination.pageSize).toBe(25);
  });

  test("renders every row when the list is not paged at all", async () => {
    const store = createCardStore({ cardPagination: { mode: "all" } });
    const { container } = renderCards(store);
    await act(async () => { await Promise.resolve(); });

    expect(renderedCards(container)).toBe(rows.length);
  });
});
