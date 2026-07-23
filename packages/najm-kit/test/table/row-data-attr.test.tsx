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

  test("cards mode: default-shell cards have data-row and data-row-id on shell wrapper", async () => {
    mockMatchMedia(true);
    function CardComponent({ data: row }: { data: Row; row: any }) {
      return (
        <div data-testid={`card-${row.id}`}>
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

    const shellsWithRow = container.querySelectorAll("[data-row][data-row-id]");
    expect(shellsWithRow.length).toBe(data.length);
  });

  test("cards mode: no-shell cards receive data-row and data-row-id as best-effort props", async () => {
    mockMatchMedia(true);
    function CardComponent({ data: row, onClick, onContextMenu, 'data-row': dataRow, 'data-row-id': dataRowId }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; 'data-row'?: string; 'data-row-id'?: string }) {
      return (
        <div data-testid={`card-${row.id}`} onClick={onClick} onContextMenu={onContextMenu} data-row={dataRow} data-row-id={dataRowId}>
          {row.name}
        </div>
      );
    }

    const enrichedData = data.map((d) => ({ ...d, __smsNoShell: true }));

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={enrichedData}
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

    const cardsWithMarker = container.querySelectorAll("[data-testid^='card-'][data-row][data-row-id]");
    expect(cardsWithMarker.length).toBe(enrichedData.length);
  });
});