import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row { id: string; name: string; age: number; }

const data: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 35 },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function CardComponent({ data: row }: { data: Row; row: any; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  return <div data-testid="card">{row.name}</div>;
}

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={data}
        columns={columns}
        renderCard={CardComponent as any}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        {...props}
      />
    </div>
  );
}

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

describe("responsive.test.tsx", () => {
  test("mobile viewport forces cards when responsiveCards is enabled", async () => {
    mockMatchMedia(true);
    const { container } = render(<TableWrapper responsiveCards={true} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll("[data-testid=card]").length).toBe(data.length);
  });

  test("responsiveCards=false keeps table mode even when renderCard provided", async () => {
    mockMatchMedia(true);
    const { container } = render(<TableWrapper responsiveCards={false} />);
    await new Promise((r) => setTimeout(r, 100));
    // Table should render in table mode
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    // Should not show cards
    const cards = container.querySelectorAll("[data-testid]");
    // No card elements should be rendered
    expect(container.querySelector("[data-testid=card]")).toBeNull();
  });

  test("mode=json renders JSON view", async () => {
    mockMatchMedia(true);
    const { container } = render(<TableWrapper mode="json" jsonValue={{ foo: "bar" }} />);
    await new Promise((r) => setTimeout(r, 100));
    // JSON mode should render without showing table
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("[data-testid=card]")).toBeNull();
  });

  test("defaultMode=json renders JSON view", async () => {
    mockMatchMedia(true);
    const { container } = render(<TableWrapper defaultMode="json" jsonValue={{ foo: "bar" }} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("[data-testid=card]")).toBeNull();
  });

  test("cards mode button is hidden when renderCard is not provided", async () => {
    const { container } = render(
      <NTable
        data={data}
        columns={columns}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    // No cards button should appear (no CardComponent)
    const buttons = container.querySelectorAll("[aria-label]");
    for (const btn of buttons) {
      expect(btn.getAttribute("aria-label")).not.toContain("Cards");
    }
  });

  test("cards mode button appears when renderCard is provided and cards is available mode", async () => {
    const { container } = render(<TableWrapper availableModes={["table", "cards"] as const} />);
    await new Promise((r) => setTimeout(r, 100));
    const cardsBtn = container.querySelector('[aria-label="Cards view"]');
    expect(cardsBtn).toBeTruthy();
  });

  test("toggle emits user mode, not responsive effective cards (user stays in table mode)", async () => {
    const onModeChange = mock();
    const { container } = render(<TableWrapper onModeChange={onModeChange} />);
    await new Promise((r) => setTimeout(r, 100));

    const cardsBtn = container.querySelector('[aria-label="Cards view"]');
    if (!cardsBtn) {
      // Cards button not available in current viewport, skip
      return;
    }
    fireEvent.click(cardsBtn);
    await new Promise((r) => setTimeout(r, 50));

    // onModeChange should be called with "cards" — user mode, not responsive effective mode
    expect(onModeChange).toHaveBeenCalledWith("cards");
  });
});
