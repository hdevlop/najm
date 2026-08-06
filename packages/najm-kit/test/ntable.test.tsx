import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const sampleData: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 35 },
];

const sampleColumns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={sampleData}
        columns={sampleColumns}
        dynamicHeight={false}
        showPagination={false}
        showViewToggle={false}
        showAddButton={false}
        showCheckbox={false}
        {...props}
      />
    </div>
  );
}

function queryText(container: HTMLElement, text: string): Element | null {
  const all = container.querySelectorAll("*");
  for (const el of all) {
    if (el.textContent === text || (el as HTMLInputElement).value === text) return el;
  }
  return null;
}

function queryAllText(container: HTMLElement, text: string): Element[] {
  const results: Element[] = [];
  const all = container.querySelectorAll("*");
  for (const el of all) {
    if (el.textContent === text || (el as HTMLInputElement).value === text) results.push(el);
  }
  return results;
}

describe("NTable", () => {
  test("renders table rows from data", () => {
    const { container } = render(<TableWrapper />);
    expect(queryText(container, "Alice")).toBeTruthy();
    expect(queryText(container, "Bob")).toBeTruthy();
    expect(queryText(container, "Charlie")).toBeTruthy();
  });

  test("renders column headers", () => {
    const { container } = render(<TableWrapper />);
    expect(queryText(container, "Name")).toBeTruthy();
    expect(queryText(container, "Age")).toBeTruthy();
  });

  test("renders custom renderEmpty when no data", () => {
    const { container } = render(
      <TableWrapper
        data={[]}
        loading={false}
        renderEmpty={() => <div data-testid="custom-empty">Nothing here</div>}
      />
    );
    const el = container.querySelector("[data-testid='custom-empty']");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Nothing here");
  });

  test("renders built-in empty state when no data and no renderEmpty", () => {
    const { container } = render(<TableWrapper data={[]} loading={false} />);
    expect(queryText(container, "No data available")).toBeTruthy();
  });

  test("renders custom renderError when error is set", () => {
    const { container } = render(
      <TableWrapper
        error="Server crashed"
        renderError={(err) => <div data-testid="custom-error">{String(err)}</div>}
      />
    );
    const el = container.querySelector("[data-testid='custom-error']");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Server crashed");
  });

  test("renders built-in error state when error is set and no renderError", () => {
    const { container } = render(<TableWrapper error="Something went wrong" />);
    expect(queryText(container, "Something went wrong")).toBeTruthy();
  });

  // A loading state with rows already on screen is a refresh, not a first
  // load, so these pass empty data to exercise the skeleton path.
  test("renders custom renderLoading when loading", () => {
    const { container } = render(
      <TableWrapper
        data={[]}
        loading={true}
        renderLoading={() => <div data-testid="custom-loading">Loading...</div>}
      />
    );
    const el = container.querySelector("[data-testid='custom-loading']");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Loading...");
  });

  test("renders built-in loading state when loading and no renderLoading", () => {
    const { container } = render(<TableWrapper data={[]} loading={true} />);
    expect(queryText(container, "Loading...")).toBeTruthy();
  });

  test("a reload with rows on screen keeps them instead of showing a skeleton", () => {
    const { container } = render(<TableWrapper loading={true} />);
    expect(container.querySelector("[data-testid='ntable-loading-skeleton']")).toBeNull();
    expect(queryText(container, "Alice")).toBeTruthy();
    const body = container.querySelector("[data-ntable-body]");
    expect(body?.getAttribute("data-ntable-refreshing")).toBe("true");
    expect(body?.getAttribute("aria-busy")).toBe("true");
  });

  test("uses getRowId for row identity", () => {
    const getRowId = (row: Row) => `custom-${row.id}`;
    const { container } = render(<TableWrapper getRowId={getRowId} />);
    // Verify data renders — that means getRowId was accepted without error
    expect(queryText(container, "Alice")).toBeTruthy();
    expect(queryText(container, "Bob")).toBeTruthy();
  });

  test("renders renderToolbar content", () => {
    const { container } = render(
      <TableWrapper
        renderToolbar={() => <div data-testid="toolbar">Custom Toolbar</div>}
      />
    );
    const el = container.querySelector("[data-testid='toolbar']");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Custom Toolbar");
  });

  test("applies classNames.root to root container", () => {
    const { container } = render(
      <TableWrapper classNames={{ root: "custom-root-class" }} />
    );
    expect(container.querySelector(".custom-root-class")).toBeTruthy();
  });

  test("applies classNames.content to table card", () => {
    const { container } = render(
      <TableWrapper classNames={{ content: "custom-content-class" }} />
    );
    expect(container.querySelector(".custom-content-class")).toBeTruthy();
  });

  test("applies classNames.pagination to pagination", () => {
    const { container } = render(
      <TableWrapper showPagination={true} classNames={{ pagination: "custom-pag-class" }} />
    );
    expect(container.querySelector(".custom-pag-class")).toBeTruthy();
  });

  /*
   * The toolbar renders throughout a load, and that is load-bearing rather than
   * cosmetic. `dynamicHeight` derives the page size from the body, and the body
   * is what is left of the container once the toolbar and the pagination bar
   * have taken their share. A toolbar that appears only when rows arrive makes
   * the body measure taller while loading than it will ever be afterwards — by
   * its own height plus a flex gap — so the measurement fits one row too many
   * and drops it the moment the rows land. Hiding it again reintroduces that.
   */
  test("keeps the toolbar mounted during loading so the body keeps its height", () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={[]}
          columns={sampleColumns}
          dynamicHeight={false}
          showPagination={false}
          showCheckbox={false}
          loading={true}
          onCreate={() => {}}
        />
      </div>
    );
    const header = container.querySelector("[data-ntable-header]");
    expect(header).not.toBeNull();
    // Mounted but inert — there is nothing to act on until rows exist. Opacity
    // and pointer-events are used precisely because they cost no layout.
    expect(header?.getAttribute("aria-busy")).toBe("true");
    expect(header?.className).toContain("pointer-events-none");
  });

  test("hides header (toolbar) during error even with onCreate", () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={[]}
          columns={sampleColumns}
          dynamicHeight={false}
          showPagination={false}
          showCheckbox={false}
          error="boom"
          onCreate={() => {}}
        />
      </div>
    );
    expect(container.querySelector("[data-ntable-header]")).toBeNull();
  });

  test("hides header (toolbar) during empty state but keeps the create CTA in body", () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={[]}
          columns={sampleColumns}
          dynamicHeight={false}
          showPagination={false}
          showCheckbox={false}
          loading={false}
          onCreate={() => {}}
        />
      </div>
    );
    expect(container.querySelector("[data-ntable-header]")).toBeNull();
    expect(queryText(container, "No data available")).toBeTruthy();
    expect(queryAllText(container, "Add item").length).toBeGreaterThan(0);
  });

  test("shows header when data is present and onCreate is set", () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={sampleData}
          columns={sampleColumns}
          dynamicHeight={false}
          showPagination={false}
          showCheckbox={false}
          onCreate={() => {}}
        />
      </div>
    );
    expect(container.querySelector("[data-ntable-header]")).toBeTruthy();
  });

  test("keeps header during filtered-empty so users can adjust filters", () => {
    const searchCol: ColumnDef<Row, any> = {
      accessorKey: "name",
      header: "Name",
      filterFn: "includesString",
    };
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={sampleData}
          columns={[searchCol]}
          dynamicHeight={false}
          showPagination={false}
          showCheckbox={false}
          isFilteredEmpty={true}
          onCreate={() => {}}
        />
      </div>
    );
    expect(container.querySelector("[data-ntable-header]")).toBeTruthy();
  });
});
