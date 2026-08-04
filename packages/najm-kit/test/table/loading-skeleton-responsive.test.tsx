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

  test("table loading uses the same borderless shadow surface contract as loaded content", () => {
    const props = {
      columns,
      dynamicHeight: false,
      showPagination: false,
      showCheckbox: false,
      showAddButton: false,
      showViewToggle: false,
      bordered: false,
      borderColor: "red",
      classNames: { content: "consumer-content" },
    } as const;
    const { container, rerender } = render(<NTable<Row> {...props} data={[]} loading />);

    const loadingSurface = container.querySelector('[data-testid="ntable-loading-skeleton"]') as HTMLElement;
    expect(loadingSurface.className).toContain("border-0");
    expect(loadingSurface.className).toContain("shadow-sm");
    expect(loadingSurface.className).toContain("consumer-content");
    expect(loadingSurface.style.borderColor).toBe("");
    expect(loadingSurface.querySelector('table')?.closest('[aria-hidden="true"]')).toBeTruthy();

    rerender(
      <NTable<Row>
        {...props}
        data={[{ id: "1", name: "One", guardian: "Guardian", status: "active" }]}
      />,
    );
    const loadedSurface = container.querySelector('[data-ntable-body] [data-bordered="false"]') as HTMLElement;
    expect(loadedSurface.className).toContain("border-0");
    expect(loadedSurface.className).toContain("shadow-sm");
    expect(loadedSurface.className).toContain("consumer-content");
    expect(loadedSurface.style.borderColor).toBe("");
  });

  test("card loading has one named busy region and respects a consumer grid override", () => {
    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        loading
        loadingText="Loading families"
        renderCard={CardRenderer as any}
        defaultMode="cards"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
        classNames={{ cards: "grid grid-cols-5 gap-4 custom-card-grid" }}
      />,
    );

    const busyRegions = container.querySelectorAll('[aria-busy="true"]');
    expect(busyRegions).toHaveLength(1);
    expect(busyRegions[0]?.getAttribute("aria-label")).toBe("Loading families");
    const grid = container.querySelector("[data-ntable-loading-cards-grid]") as HTMLElement;
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(grid.className).toContain("grid-cols-5");
    expect(grid.className).not.toContain("xl:grid-cols-4");
    expect(grid.querySelectorAll("[data-ntable-loading-card]")).toHaveLength(16);
  });

  test("explicit bordered loading uses the shared themed border without a fallback shadow", () => {
    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        loading
        bordered
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
      />,
    );
    const surface = container.querySelector('[data-testid="ntable-loading-skeleton"]') as HTMLElement;
    expect(surface.className).toContain("najm-border");
    expect(surface.className).not.toContain("shadow-sm");
  });
});
