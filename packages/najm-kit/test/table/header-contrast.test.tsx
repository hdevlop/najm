import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const sampleData: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
];

const sampleColumns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<React.ComponentProps<typeof NTable<Row>>>) {
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
        showSorting
        {...props}
      />
    </div>
  );
}

function getHeaderCells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-slot="table-head"]'));
}

describe("NTable header text contrast", () => {
  test("default TableHead uses high-contrast foreground color, not muted-foreground", () => {
    const { container } = render(<TableWrapper />);
    const heads = getHeaderCells(container);
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      expect(head.className).toContain("text-foreground");
      expect(head.className).not.toContain("text-muted-foreground");
    }
  });

  test("sort icons do not apply a faded opacity", () => {
    const { container } = render(<TableWrapper />);
    const sortIcons = Array.from(
      container.querySelectorAll("svg.lucide-arrow-up-down"),
    ) as HTMLElement[];
    expect(sortIcons.length).toBeGreaterThan(0);
    for (const icon of sortIcons) {
      expect(icon.className).not.toMatch(/\bopacity-(50|40|30|25|20)\b/);
    }
  });

  test("rose headerColor applies stronger background and dark text in light mode", () => {
    const { container } = render(<TableWrapper headerColor="rose" />);
    const headerRow = container.querySelector('[data-ntable-table-header]');
    expect(headerRow).toBeTruthy();
    const cls = headerRow!.className;
    expect(cls).toContain("[&_th]:text-rose-800");
    // background is applied on each TableHead cell
    const heads = getHeaderCells(container);
    expect(heads.some((h) => h.className.includes("bg-rose-600/30"))).toBe(true);
  });

  test("colored header tokens keep `text-rose-800` (no `text-rose-700`) for rose", () => {
    const { container } = render(<TableWrapper headerColor="rose" />);
    const headerRow = container.querySelector('[data-ntable-table-header]');
    const cls = headerRow!.className;
    expect(cls).not.toContain("text-rose-700");
  });

  test("colored header tokens use a darker dark-mode text shade (>=300) for less harsh contrast", () => {
    const { container: rose } = render(<TableWrapper headerColor="rose" />);
    const { container: violet } = render(<TableWrapper headerColor="violet" />);
    const { container: emerald } = render(<TableWrapper headerColor="emerald" />);
    const roseCls = rose.querySelector('[data-ntable-table-header]')!.className;
    const violetCls = violet.querySelector('[data-ntable-table-header]')!.className;
    const emeraldCls = emerald.querySelector('[data-ntable-table-header]')!.className;
    expect(roseCls).toMatch(/dark:\[&_th\]:text-rose-(300|400|500)\b/);
    expect(violetCls).toMatch(/dark:\[&_th\]:text-violet-(300|400|500)\b/);
    expect(emeraldCls).toMatch(/dark:\[&_th\]:text-emerald-(300|400|500)\b/);
  });
});
