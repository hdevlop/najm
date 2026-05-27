import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
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

describe("cards-handlers.test.tsx", () => {
  test("CardComponent onClick invokes onRowClick(row.original)", async () => {
    mockMatchMedia(true);
    const onRowClick = mock();
    const onRowContextMenu = mock();

    function CardComponent(
      { data: row, onClick }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void }
    ) {
      return (
        <div data-testid={`card-${row.id}`} onClick={onClick}>
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

    const card1 = container.querySelector("[data-testid=card-1]");
    expect(card1).toBeTruthy();

    fireEvent.click(card1!);
    await new Promise((r) => setTimeout(r, 50));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  test("CardComponent onContextMenu invokes onRowContextMenu(e, row.original)", async () => {
    mockMatchMedia(true);
    const onRowClick = mock();
    const onRowContextMenu = mock();

    function CardComponent(
      { data: row, onContextMenu }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void }
    ) {
      return (
        <div data-testid={`card-${row.id}`} onContextMenu={onContextMenu}>
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

    const card1 = container.querySelector("[data-testid=card-1]");
    expect(card1).toBeTruthy();

    // Simulate a right-click context menu event
    fireEvent.contextMenu(card1!);
    await new Promise((r) => setTimeout(r, 50));

    expect(onRowContextMenu).toHaveBeenCalledTimes(1);
    // Second argument should be row.original
    const call = onRowContextMenu.mock.calls[0];
    expect(call[1]).toEqual(data[0]);
  });
});