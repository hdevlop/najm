import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";
import { MOBILE_LIST_BATCH_SIZE, mobileListPresentation } from "../../src/components/table/NTableMobileList";

interface Row { id: string; name: string; grade: number }

const rows: Row[] = Array.from({ length: 30 }, (_, index) => ({ id: String(index + 1), name: `Student ${index + 1}`, grade: index }));
const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "grade", header: "Grade", meta: { editable: true, editor: "number" } },
];

function setViewport(width: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = max ? width <= Number(max[1]) : min ? width >= Number(min[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
}

const observers: Array<{ callback: (entries: unknown[]) => void; disconnected: boolean }> = [];
const originalMatchMedia = window.matchMedia;
const originalIntersectionObserver = (globalThis as any).IntersectionObserver;

function intersectAll() {
  for (const observer of observers) {
    if (!observer.disconnected) observer.callback([{ isIntersecting: true }]);
  }
}

beforeEach(() => {
  observers.length = 0;
  (globalThis as any).IntersectionObserver = class {
    private entry: { callback: (entries: unknown[]) => void; disconnected: boolean };
    constructor(callback: (entries: unknown[]) => void) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() { this.entry.disconnected = true; }
  };
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  (globalThis as any).IntersectionObserver = originalIntersectionObserver;
  document.body.innerHTML = "";
});

const cardCount = (container: HTMLElement) => container.querySelectorAll("[data-ntable-cell-card]").length;

describe("NTable mobileList", () => {
  test("leaves a desktop table, a server-paged table and the JSON view as they are", () => {
    const props = { data: rows, columns } as any;
    expect(mobileListPresentation(props, false, 12)).toBe(props);
    expect(mobileListPresentation({ ...props, manualPagination: true }, true, 12).mode).toBeUndefined();
    expect(mobileListPresentation({ ...props, mode: "json" }, true, 12).mode).toBe("json");
  });

  test("on a phone, shows cards only, with no page bar or view toggle", () => {
    const presented = mobileListPresentation({ data: rows, columns } as any, true, 24);
    expect(presented.mode).toBe("cards");
    expect(presented.availableModes).toEqual(["cards"]);
    expect(presented.pagination).toEqual({ pageIndex: 0, pageSize: 24 });
    expect(presented.showPagination).toBe(false);
    expect(presented.showViewToggle).toBe(false);
    expect(presented.dynamicHeight).toBe(false);
  });

  test("a table without a card shows each column as a label and value, one batch at a time", async () => {
    setViewport(390);
    const { container } = render(<NTable<Row> data={rows} columns={columns} mobileList showCheckbox={false} />);

    expect(cardCount(container)).toBe(MOBILE_LIST_BATCH_SIZE);
    const first = container.querySelector("[data-ntable-cell-card]")!;
    expect(first.textContent).toContain("Name");
    expect(first.textContent).toContain("Student 1");
    expect(container.querySelector("table")).toBeNull();

    await act(async () => { intersectAll(); });
    expect(cardCount(container)).toBe(MOBILE_LIST_BATCH_SIZE * 2);
  });

  test("an editable column stays editable in the card", async () => {
    setViewport(390);
    const onCellEdit = mock(async () => {});
    const { container } = render(
      <NTable<Row> data={rows.slice(0, 1)} columns={columns} mobileList onCellEdit={onCellEdit} showCheckbox={false} />,
    );

    const display = container.querySelector("[data-ntable-editable-display]") as HTMLElement;
    expect(display).toBeTruthy();
    await act(async () => { fireEvent.click(display); });
    const input = container.querySelector("input[type='number']") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onCellEdit).toHaveBeenCalledWith(rows[0], "grade", 15);
  });

  test("is turned on for every table by NTableDefaults", () => {
    setViewport(390);
    const { container } = render(
      <NTableDefaultsProvider value={{ mobileList: true }}>
        <NTable<Row> data={rows} columns={columns} showCheckbox={false} />
      </NTableDefaultsProvider>,
    );
    expect(cardCount(container)).toBe(MOBILE_LIST_BATCH_SIZE);
  });

  /*
   * A server-rendered page hydrates at the server's desktop width, so NTable
   * first mounts with uncontrolled pagination and only then receives the
   * list's controlled first batch. The store used to keep treating the page as
   * uncontrolled and sized it to every row.
   */
  test("a server-rendered page still reveals one batch after hydrating on a phone", async () => {
    const element = <NTable<Row> data={rows} columns={columns} mobileList showCheckbox={false} />;
    setViewport(1440);
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);

    setViewport(390);
    await act(async () => { hydrateRoot(container, element); });

    expect(cardCount(container)).toBe(MOBILE_LIST_BATCH_SIZE);
  });

  test("a desktop keeps the paged table", () => {
    setViewport(1440);
    const { container } = render(
      <NTable<Row> data={rows} columns={columns} mobileList dynamicHeight={false} showCheckbox={false} />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(cardCount(container)).toBe(0);
  });
});
