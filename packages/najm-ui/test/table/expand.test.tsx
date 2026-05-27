import { describe, test, expect, mock } from "bun:test";
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

function Wrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        renderSubRow={(row) => <div data-testid={`subrow-${row.id}`}>SUB {row.name}</div>}
        {...props}
      />
    </div>
  );
}

describe("expand.test.tsx", () => {
  test("uncontrolled expander click renders subrow and calls onExpandedChange", async () => {
    const onExpandedChange = mock();
    const { container, queryByTestId, getByLabelText } = render(
      <Wrapper onExpandedChange={onExpandedChange} />
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(container.querySelector("table")).toBeTruthy();
    expect(queryByTestId("subrow-1")).toBeNull();

    fireEvent.click(getByLabelText("Expand row 1"));
    await new Promise((r) => setTimeout(r, 50));

    expect(queryByTestId("subrow-1")).toBeTruthy();
    expect(onExpandedChange).toHaveBeenCalled();
    const last = onExpandedChange.mock.calls[onExpandedChange.mock.calls.length - 1][0];
    expect(last["1"]).toBe(true);
  });

  test("controlled expansion fires onExpandedChange but does not show subrow until parent updates expanded prop", async () => {
    const onExpandedChange = mock();
    const { getByLabelText, queryByTestId, rerender } = render(
      <Wrapper expanded={{}} onExpandedChange={onExpandedChange} />
    );
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.click(getByLabelText("Expand row 1"));
    await new Promise((r) => setTimeout(r, 50));

    expect(onExpandedChange).toHaveBeenCalled();
    // Still controlled to {} → subrow remains hidden
    expect(queryByTestId("subrow-1")).toBeNull();

    // Parent re-passes expanded with row 1 expanded
    rerender(<Wrapper expanded={{ "1": true }} onExpandedChange={onExpandedChange} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("subrow-1")).toBeTruthy();
  });

  test("defaultExpanded seeds an initially expanded row in uncontrolled mode", async () => {
    const { queryByTestId } = render(<Wrapper defaultExpanded={{ "2": true }} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("subrow-2")).toBeTruthy();
    expect(queryByTestId("subrow-1")).toBeNull();
  });

  test("getRowCanExpand prevents expansion controls and subrows for disallowed rows", async () => {
    const { queryByLabelText, queryByTestId, getByLabelText } = render(
      <Wrapper getRowCanExpand={(r) => r.id === "1"} />
    );
    await new Promise((r) => setTimeout(r, 50));

    // Row 1 has an expander; row 2 does not.
    expect(getByLabelText("Expand row 1")).toBeTruthy();
    expect(queryByLabelText("Expand row 2")).toBeNull();

    fireEvent.click(getByLabelText("Expand row 1"));
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("subrow-1")).toBeTruthy();
    expect(queryByTestId("subrow-2")).toBeNull();
  });

  test("cards mode renders expanded subrow content inside the card", async () => {
    function CardBody({ data, isExpanded, renderSubRow }: { data: Row; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; isExpanded?: boolean; onToggleExpanded?: () => void; canExpand?: boolean; renderSubRow?: (row: unknown) => React.ReactNode }) {
      return <div data-testid={`card-${data.id}`}>{data.name}{isExpanded && renderSubRow && <div data-testid={`subrow-${data.id}`}>SUB {data.name}</div>}</div>;
    }
    const { container, getByTestId, queryByTestId } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
          mode="cards"
          renderCard={CardBody}
          renderSubRow={(row) => <div data-testid={`subrow-${row.id}`}>SUB {row.name}</div>}
          defaultExpanded={{ "1": true }}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 50));

    // Cards mode: no <table>
    expect(container.querySelector("table")).toBeNull();
    expect(getByTestId("card-1")).toBeTruthy();
    expect(getByTestId("subrow-1")).toBeTruthy();
    expect(queryByTestId("subrow-2")).toBeNull();
  });

  test("expander click does not trigger onRowClick and does not change checkbox selection", async () => {
    const onRowClick = mock();
    const onRowSelectionChange = mock();
    const { container, getByLabelText } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox
          onRowClick={onRowClick}
          onRowSelectionChange={onRowSelectionChange}
          renderSubRow={(row) => <div data-testid={`subrow-${row.id}`}>SUB {row.name}</div>}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.click(getByLabelText("Expand row 1"));
    await new Promise((r) => setTimeout(r, 50));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(onRowSelectionChange).not.toHaveBeenCalled();

    // The row 1 checkbox should not be checked
    const cb = container.querySelector('[aria-label="Select row 1"]') as HTMLElement;
    expect(cb?.getAttribute("data-state")).not.toBe("checked");
  });
});
