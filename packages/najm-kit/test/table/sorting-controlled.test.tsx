import { afterEach, describe, test, expect, mock } from "bun:test";
import React, { useState } from "react";
import { render } from "@testing-library/react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row { id: string; name: string; }

const data: Row[] = [
  { id: "1", name: "Charlie" },
  { id: "2", name: "Alice" },
  { id: "3", name: "Bob" },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
];

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: mock((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: mock(),
      removeEventListener: mock(),
      addListener: mock(),
      removeListener: mock(),
      dispatchEvent: mock(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("sorting-controlled.test.tsx", () => {
  test("controlled sort: initial sorting prop is reflected in row order (descending)", async () => {
    mockMatchMedia(false);
    const onSortingChange = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          sorting={[{ id: "name", desc: true }]}
          onSortingChange={onSortingChange}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Descending order: Charlie > Bob > Alice alphabetically
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Charlie");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Alice");
  });

  test("controlled sort: ascending sort changes row order", async () => {
    mockMatchMedia(false);
    const onSortingChange = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          sorting={[{ id: "name", desc: false }]}
          onSortingChange={onSortingChange}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Ascending order: Alice, Bob, Charlie
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Alice");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Charlie");
  });

  test("controlled sort: external sorting prop change triggers resort", async () => {
    mockMatchMedia(false);

    function TestComponent({ sortProp }: { sortProp: SortingState }) {
      return (
        <div style={{ height: 600 }}>
          <NTable
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            sorting={sortProp}
            onSortingChange={mock()}
            dynamicHeight={false}
            showPagination={false}
            showAddButton={false}
          />
        </div>
      );
    }

    const { container, rerender } = render(
      <TestComponent sortProp={[{ id: "name", desc: false }]} />
    );
    await new Promise((r) => setTimeout(r, 100));

    // Ascending: Alice, Bob, Charlie
    let rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Alice");

    // Switch to descending — should re-sort without user interaction
    rerender(<TestComponent sortProp={[{ id: "name", desc: true }]} />);
    await new Promise((r) => setTimeout(r, 100));

    // Now descending: Charlie, Bob, Alice
    rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Charlie");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Alice");
  });

  // Note: "onSortingChange is called when sort prop changes from outside" is intentionally
  // not tested here. In controlled sort mode, onSortingChange is the *user-intent* callback
  // (fires on column header clicks). When a parent changes the `sorting` prop externally,
  // the new value is synced into the store via useStoreSync — no onSortingChange call fires.
  // The resort still happens (tested below). If you need a callback on external prop changes,
  // use onStateChange instead (fires with full NTableState on every state mutation).
});