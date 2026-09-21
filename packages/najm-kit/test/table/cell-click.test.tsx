import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
}

const row: Row = { id: "1", name: "Alice" };
const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
];

describe("NTable cell clicks", () => {
  test("reports the row and column without also firing the row click", async () => {
    const onCellClick = mock();
    const onRowClick = mock();
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={[row]}
          columns={columns}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
          onCellClick={onCellClick}
          onRowClick={onRowClick}
        />
      </div>,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const cell = container.querySelector("tbody td") as HTMLTableCellElement;
    fireEvent.click(cell);

    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0][0]).toBe(row);
    expect(onCellClick.mock.calls[0][1]).toBe("name");
    expect(onCellClick.mock.calls[0][2]).toBeTruthy();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(cell.className).toContain("cursor-pointer");
  });
});
