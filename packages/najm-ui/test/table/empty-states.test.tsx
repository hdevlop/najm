import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row { id: string; name: string; age: number; }

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable data={[]} columns={columns} dynamicHeight={false} showPagination={false} showAddButton={false} showCheckbox {...props} />
    </div>
  );
}

function CustomEmpty() { return <div data-testid="custom-empty">No items</div>; }
function CustomFilteredEmpty() { return <div data-testid="custom-filtered-empty">No results found</div>; }

describe("empty-states.test.tsx", () => {
  test("isEmpty renders empty state", async () => {
    const { container } = render(<TableWrapper isEmpty={true} noDataText="No items available" />);
    await new Promise((r) => setTimeout(r, 100));
    // Empty state should be shown
    const emptyText = container.textContent;
    expect(emptyText).toContain("No items available");
  });

  test("isEmpty=false with empty data renders default noDataText", async () => {
    const { container } = render(<TableWrapper data={[]} isEmpty={false} noDataText="Custom no data" />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.textContent).not.toContain("Custom no data");
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.textContent).toContain("No results.");
  });

  test("isFilteredEmpty renders filtered-empty before empty", async () => {
    const { container } = render(
      <TableWrapper
        data={[]}
        isFilteredEmpty={true}
        renderFilteredEmpty={CustomFilteredEmpty}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    // Filtered-empty custom renderer should appear
    expect(container.querySelector("[data-testid=custom-filtered-empty]")).toBeTruthy();
  });

  test("renderFilteredEmpty falls back to renderEmpty when not provided and isFilteredEmpty=true", async () => {
    const { container } = render(<TableWrapper data={[]} isFilteredEmpty={true} renderEmpty={CustomEmpty} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector("[data-testid=custom-empty]")).toBeTruthy();
  });

  test("loading renders loading state before empty", async () => {
    const { container } = render(<TableWrapper loading={true} loadingText="Loading..." />);
    await new Promise((r) => setTimeout(r, 100));
    // Loading state takes priority over empty
    expect(container.textContent).toContain("Loading...");
  });

  test("error renders error state before empty", async () => {
    const { container } = render(<TableWrapper error="Something went wrong" />);
    await new Promise((r) => setTimeout(r, 100));
    // Error state takes priority
    expect(container.textContent).toContain("Something went wrong");
  });

  test("filtered-empty does not render when isFilteredEmpty=false", async () => {
    const { container } = render(
      <TableWrapper
        data={[]}
        isFilteredEmpty={false}
        renderFilteredEmpty={CustomFilteredEmpty}
        noDataText="No data"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    // Custom filtered empty should NOT show when flag is false
    expect(container.querySelector("[data-testid=custom-filtered-empty]")).toBeNull();
  });

  test("renderEmpty custom component is used when provided and isEmpty=true", async () => {
    const { container } = render(<TableWrapper isEmpty={true} renderEmpty={CustomEmpty} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector("[data-testid=custom-empty]")).toBeTruthy();
  });

  test("resolution order: loading > error > filtered-empty > empty > content", async () => {
    // When all are present, loading wins
    const { container } = render(<TableWrapper loading={true} error="err" isFilteredEmpty={true} isEmpty={true} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.textContent).toContain("Loading");
    expect(container.querySelector("[data-testid=custom-filtered-empty]")).toBeNull();

    // When error is present (no loading), error wins
    const { container: c2 } = render(<TableWrapper loading={false} error="err" isFilteredEmpty={true} isEmpty={true} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(c2.textContent).toContain("err");

    // When filtered-empty is set (no loading, no error), filtered-empty wins
    const { container: c3 } = render(<TableWrapper loading={false} error={null} isFilteredEmpty={true} renderFilteredEmpty={CustomFilteredEmpty} isEmpty={true} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(c3.querySelector("[data-testid=custom-filtered-empty]")).toBeTruthy();
  });
});
