import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  guardian: string;
  status: string;
}

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "guardian", header: "Guardian" },
  { accessorKey: "status", header: "Status" },
];

function CardRenderer() {
  return <div>Card</div>;
}

describe("NTable responsive loading skeleton", () => {
  test("matches the compact mobile toolbar and keeps desktop filters", () => {
    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        filters={[
          { type: "text", name: "name", placeholder: "Search" },
          { type: "text", name: "guardian", placeholder: "Guardian" },
          { type: "select", name: "status", placeholder: "Status" },
        ]}
        loading
        onCreate={() => {}}
        renderCard={CardRenderer as any}
        defaultMode="cards"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
      />,
    );

    const mobile = container.querySelector("[data-ntable-loading-mobile-toolbar]") as HTMLElement;
    expect(mobile.querySelector("[data-ntable-loading-mobile-primary]")).toBeTruthy();
    expect(mobile.querySelector("[data-ntable-loading-mobile-filter-button]")).toBeTruthy();
    expect(mobile.querySelector("[data-ntable-loading-mobile-add-button]")).toBeTruthy();

    const desktop = container.querySelector("[data-ntable-loading-desktop-filters]") as HTMLElement;
    expect(desktop.children).toHaveLength(3);
  });

  test("uses a compact mobile avatar card and expanded desktop details", () => {
    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        loading
        renderCard={CardRenderer as any}
        defaultMode="cards"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
      />,
    );

    const layout = container.querySelector('[data-ntable-loading-card-layout="responsive-avatar"]') as HTMLElement;
    const avatar = layout.querySelector("[data-ntable-loading-card-avatar]") as HTMLElement;
    const status = layout.querySelector("[data-ntable-loading-card-status]") as HTMLElement;
    const details = layout.querySelector("[data-ntable-loading-card-details]") as HTMLElement;

    expect(layout.className).toContain("grid-cols-[80px_minmax(0,1fr)]");
    expect(avatar.className).toContain("size-20");
    expect(avatar.className).toContain("sm:size-16");
    expect(status.className).toContain("hidden");
    expect(status.className).toContain("sm:block");
    expect(details.className).toContain("col-start-2");
    expect(details.className).toContain("sm:col-span-full");
    expect(details.className).toContain("sm:bg-muted/50");
  });
});
