import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row { id: string; name: string; }

const data: Row[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Charlie" },
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

describe("row-data-attr.test.tsx", () => {
  test("table mode: each data row has data-row attribute", async () => {
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
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const rows = container.querySelectorAll("tbody tr[data-row]");
    expect(rows.length).toBe(data.length);
  });

  test("cards mode: card spreads data-row onto its root", async () => {
    mockMatchMedia(true);
    function CardComponent({ data: row, ...rest }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; 'data-row'?: string }) {
      return (
        <div data-testid={`card-${row.id}`} {...rest}>
          {row.name}
        </div>
      );
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          mode="cards"
          renderCard={CardComponent}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const cardsWithMarker = container.querySelectorAll("[data-testid^='card-'][data-row]");
    expect(cardsWithMarker.length).toBe(data.length);
  });
});