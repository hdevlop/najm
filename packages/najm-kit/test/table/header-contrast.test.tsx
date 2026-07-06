import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";
import { NajmDesignProvider } from "../../src/theme/design-provider";

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
  test("default TableHead uses full primary background and primary foreground text", () => {
    const { container } = render(<TableWrapper />);
    const heads = getHeaderCells(container);
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      expect(head.className).toContain("text-foreground");
      expect(head.className).not.toContain("text-muted-foreground");
      expect(head.getAttribute("style")).toContain("background-color: var(--primary)");
      expect(head.getAttribute("style")).toContain("color: var(--primary-foreground)");
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

  test("headerColor accepts arbitrary CSS colors without generated slash classes", () => {
    const { container } = render(
      <TableWrapper
        headerColor="rgb(82, 39, 149)"
        headerTextColor="rgb(255, 255, 255)"
      />,
    );
    const heads = getHeaderCells(container);
    expect(heads.length).toBeGreaterThan(0);
    expect(heads[0].getAttribute("style")).toContain("background-color: rgb(82, 39, 149)");
    expect(heads[0].getAttribute("style")).toContain("color: rgb(255, 255, 255)");
    expect(heads[0].className).not.toContain("/");
  });

  test("token names resolve to CSS variables", () => {
    const { container } = render(
      <TableWrapper headerColor="secondary" headerTextColor="secondary-foreground" />,
    );
    const heads = getHeaderCells(container);
    expect(heads[0].getAttribute("style")).toContain("background-color: var(--secondary)");
    expect(heads[0].getAttribute("style")).toContain("color: var(--secondary-foreground)");
  });

  test("borderColor applies to the table rows", () => {
    const { container } = render(<TableWrapper bordered borderColor="rgb(85, 85, 85)" />);
    const row = container.querySelector('[data-slot="table-row"]') as HTMLElement;
    expect(row.getAttribute("style")).toContain("border-color: rgb(85, 85, 85)");
  });

  test("design recipe applies table header and border colors", () => {
    const { container } = render(
      <NajmDesignProvider
        config={{
          version: 1,
          theme: {},
          components: {
            table: {
              headerColor: "rgb(82, 39, 149)",
              headerTextColor: "rgb(255, 255, 255)",
              borderColor: "rgb(85, 85, 85)",
            },
          },
        }}
      >
        <TableWrapper />
      </NajmDesignProvider>,
    );

    const head = getHeaderCells(container)[0];
    const row = container.querySelector('[data-slot="table-row"]') as HTMLElement;
    const shell = container.querySelector("[data-ntable-body] [data-bordered]") as HTMLElement;
    expect(head.getAttribute("style")).toContain("background-color: rgb(82, 39, 149)");
    expect(head.getAttribute("style")).toContain("color: rgb(255, 255, 255)");
    expect(row.getAttribute("style")).toContain("border-color: rgb(85, 85, 85)");
    expect(shell.getAttribute("data-bordered")).toBe("true");
  });
});
