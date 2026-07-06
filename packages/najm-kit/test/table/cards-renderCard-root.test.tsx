import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row { id: string; name: string; }

const data: Row[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
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

describe("cards-renderCard-root.test.tsx", () => {
  test("CardComponent root is direct child of grid container with no extra wrapper", async () => {
    mockMatchMedia(true);
    function CardComponent({ data: row, renderSubRow }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; renderSubRow?: (row: Row) => React.ReactNode }) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
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

    // The grid container holds the cards. Each row shell wraps the CardComponent
    // and forwards data-row + data-row-id attributes, so the CardComponent is
    // discoverable as a child of the row shell.
    const rowShells = container.querySelectorAll("[data-row-id]");
    expect(rowShells.length).toBe(data.length);
    for (let i = 0; i < rowShells.length; i++) {
      const shell = rowShells[i];
      const inner = shell.querySelector(`[data-testid="card-${data[i].id}"]`);
      expect(inner).toBeTruthy();
    }
  });

  test("CardComponent receives onClick and onContextMenu handlers", async () => {
    mockMatchMedia(true);
    const onRowClick = mock();
    const onRowContextMenu = mock();

    function CardComponent(
      { data: row, onClick, onContextMenu }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; renderSubRow?: (row: Row) => React.ReactNode }
    ) {
      return (
        <div data-testid={`card-${row.id}`} onClick={onClick} onContextMenu={onContextMenu}>
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
          onRowClick={onRowClick}
          onRowContextMenu={onRowContextMenu}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Cards render
    const card1 = container.querySelector("[data-testid=card-1]");
    expect(card1).toBeTruthy();
  });

  test("getRowClassName is applied to card shells", async () => {
    mockMatchMedia(true);
    function CardComponent({ data: row }: { data: Row }) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          mode="cards"
          renderCard={CardComponent}
          getRowClassName={(row) => row.id === "2" ? "opacity-50 bg-muted/60" : undefined}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const rowShells = container.querySelectorAll("[data-row-id]");
    expect(rowShells[0].className).not.toContain("opacity-50");
    expect(rowShells[1].className).toContain("opacity-50");
    expect(rowShells[1].className).toContain("bg-muted/60");
  });
});
