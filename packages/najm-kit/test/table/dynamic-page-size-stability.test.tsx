import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";

interface Item { id: string; name: string }
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];
const rows: Item[] = Array.from({ length: 24 }, (_, index) => ({
  id: String(index + 1),
  name: `Item ${index + 1}`,
}));

function Card({ data }: { data: Item }) {
  return <div data-testid="item-card">{data.name}</div>;
}

/**
 * Card height is measured from rendered cards, so it changes as images decode.
 * Feeding that back into the page size caused a refetch → re-render →
 * re-measure → refetch loop, which surfaced as the list settling from 24 rows
 * to 16 with the loading skeleton flashing twice.
 *
 * A report is allowed once per container geometry. The container box does not
 * depend on the rows inside it, so the loop terminates.
 */
describe("dynamic page size stability under manual pagination", () => {
  test("does not keep re-reporting when measured content height changes", async () => {
    const onPaginationChange = mock(() => {});

    const { rerender } = render(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={rows}
          columns={columns}
          renderCard={Card as any}
          mode="cards"
          dynamicHeight
          manualPagination
          pagination={{ pageIndex: 0, pageSize: 10 }}
          pageCount={2}
          onPaginationChange={onPaginationChange}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
        />
      </div>,
    );

    // Let any debounced report fire.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    const afterFirstSettle = onPaginationChange.mock.calls.length;

    // Simulate content growing taller (images decoding) by re-rendering with a
    // changed row set. The container box is unchanged.
    rerender(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={[...rows, { id: "25", name: "Item 25" }]}
          columns={columns}
          renderCard={Card as any}
          mode="cards"
          dynamicHeight
          manualPagination
          pagination={{ pageIndex: 0, pageSize: 10 }}
          pageCount={2}
          onPaginationChange={onPaginationChange}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
        />
      </div>,
    );
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });

    // No further reports for the same container: at most the single settle.
    expect(onPaginationChange.mock.calls.length).toBe(afterFirstSettle);
    expect(afterFirstSettle).toBeLessThanOrEqual(1);
  });
});
