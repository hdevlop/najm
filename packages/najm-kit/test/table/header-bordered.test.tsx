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
        {...props}
      />
    </div>
  );
}

function findInputByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement | null {
  const inputs = Array.from(container.querySelectorAll("input"));
  return inputs.find((el) => el.placeholder === placeholder) ?? null;
}

function hasBorderedBaseInputClass(el: HTMLElement | null): boolean {
  if (!el) return false;
  const wrapper = el.closest("div[class*='relative'][class*='flex']");
  if (!wrapper) return false;
  const cls = (wrapper as HTMLElement).className;
  // With NTable's `bordered` prop, the resting border color follows the resolved
  // border degree. The table defaults to "default" degree + bordered=true →
  // "strong" → `border-border-strong`.
  return /\bborder\b/.test(cls) && /border-border-strong/.test(cls);
}

function findBaseInputByIcon(container: HTMLElement, lucideClass: string): HTMLElement | null {
  // Find a lucide icon (SVG) and return its closest BaseInput wrapper
  const icons = Array.from(container.querySelectorAll("svg"));
  const target = icons.find((svg) => svg.classList.toString().includes(lucideClass));
  return target ? (target.closest("div[class*='relative'][class*='flex']") as HTMLElement) : null;
}

describe("NTableHeader bordered propagation", () => {
  test("search filter has bordered BaseInput when NTable is bordered", () => {
    const { container } = render(
      <TableWrapper
        bordered
        filters={[{ type: "search", name: "global", placeholder: "Search users" }]}
      />
    );

    const searchInput = findInputByPlaceholder(container, "Search users");
    expect(searchInput).toBeTruthy();
    expect(hasBorderedBaseInputClass(searchInput)).toBe(true);
  });

  test("search filter does NOT have bordered BaseInput when NTable is not bordered", () => {
    const { container } = render(
      <TableWrapper
        filters={[{ type: "search", name: "global", placeholder: "Search users" }]}
      />
    );

    const searchInput = findInputByPlaceholder(container, "Search users");
    expect(searchInput).toBeTruthy();
    expect(hasBorderedBaseInputClass(searchInput)).toBe(false);
  });

  test("text filter has bordered BaseInput when NTable is bordered", () => {
    const { container } = render(
      <TableWrapper
        bordered
        filters={[{ type: "text", name: "name", placeholder: "Filter name" }]}
      />
    );

    const filterInput = findInputByPlaceholder(container, "Filter name");
    expect(filterInput).toBeTruthy();
    expect(hasBorderedBaseInputClass(filterInput)).toBe(true);
  });

  test("text filter does NOT have bordered BaseInput when NTable is not bordered", () => {
    const { container } = render(
      <TableWrapper
        filters={[{ type: "text", name: "name", placeholder: "Filter name" }]}
      />
    );

    const filterInput = findInputByPlaceholder(container, "Filter name");
    expect(filterInput).toBeTruthy();
    expect(hasBorderedBaseInputClass(filterInput)).toBe(false);
  });

  test("select filter has bordered BaseInput when NTable is bordered", () => {
    const { container } = render(
      <TableWrapper
        bordered
        filters={[
          {
            type: "select",
            name: "name",
            placeholder: "Filter role",
            options: [{ value: "admin", label: "Admin" }],
          },
        ]}
      />
    );

    const filterWrapper = findBaseInputByIcon(container, "lucide-chevron-down");
    expect(filterWrapper).toBeTruthy();
    expect(hasBorderedBaseInputClass(filterWrapper)).toBe(true);
  });

  test("select filter does NOT have bordered BaseInput when NTable is not bordered", () => {
    const { container } = render(
      <TableWrapper
        filters={[
          {
            type: "select",
            name: "name",
            placeholder: "Filter role",
            options: [{ value: "admin", label: "Admin" }],
          },
        ]}
      />
    );

    const filterWrapper = findBaseInputByIcon(container, "lucide-chevron-down");
    expect(filterWrapper).toBeTruthy();
    expect(hasBorderedBaseInputClass(filterWrapper)).toBe(false);
  });

  test("settings trigger has bordered BaseInput when NTable is bordered and showColumnVisibility", () => {
    const { container } = render(
      <TableWrapper
        bordered
        showViewToggle={true}
        showColumnVisibility={true}
      />
    );

    const settingsTrigger = findBaseInputByIcon(container, "lucide-sliders-horizontal");
    expect(settingsTrigger).toBeTruthy();
    expect(hasBorderedBaseInputClass(settingsTrigger)).toBe(true);
  });

  test("settings trigger does NOT have bordered BaseInput when NTable is not bordered", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        showColumnVisibility={true}
      />
    );

    const settingsTrigger = findBaseInputByIcon(container, "lucide-sliders-horizontal");
    expect(settingsTrigger).toBeTruthy();
    expect(hasBorderedBaseInputClass(settingsTrigger)).toBe(false);
  });
});
