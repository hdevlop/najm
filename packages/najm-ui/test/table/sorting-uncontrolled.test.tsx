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

describe("sorting-uncontrolled.test.tsx", () => {
  test("uncontrolled: defaultSorting seeds initial sort order", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          defaultSorting={[{ id: "name", desc: false }]}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Ascending: Alice, Bob, Charlie
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Alice");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Charlie");
  });

  test("uncontrolled: no defaultSorting leaves data in original order", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Default insert order: Charlie, Alice, Bob
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Charlie");
    expect(rows[1].textContent).toContain("Alice");
    expect(rows[2].textContent).toContain("Bob");
  });

  test("uncontrolled: defaultSorting descending gives correct order", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          defaultSorting={[{ id: "name", desc: true }]}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Descending: Charlie, Bob, Alice
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Charlie");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Alice");
  });

  test("controlled sort and uncontrolled defaultSorting coexist correctly", async () => {
    mockMatchMedia(false);

    // When both sorting (controlled) and defaultSorting are provided,
    // controlled takes precedence (sorting is the "truth" when provided)
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          // conflicting: defaultSorting says asc, sorting says desc
          defaultSorting={[{ id: "name", desc: false }]}
          sorting={[{ id: "name", desc: true }]}
          onSortingChange={mock()}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Descending because controlled sorting prop takes precedence
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Charlie");
    expect(rows[1].textContent).toContain("Bob");
    expect(rows[2].textContent).toContain("Alice");
  });
});