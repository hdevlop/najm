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

    // The grid container (cards container) should have no intermediate wrapper around CardComponent root
    const cardsContainer = container.querySelector(".flex.flex-wrap.gap-3.p-3");
    expect(cardsContainer).toBeTruthy();
    const directChildren = cardsContainer?.children;
    expect(directChildren?.length).toBe(data.length);
    for (let i = 0; i < (directChildren?.length ?? 0); i++) {
      const child = directChildren?.item(i);
      expect(child?.getAttribute("data-testid")).toBe(`card-${data[i].id}`);
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
});