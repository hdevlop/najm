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
  /*
   * There is no toolbar skeleton any more, and that is the point.
   *
   * A placeholder toolbar has to be matched to the real one pixel for pixel, or
   * swapping them moves the body underneath and the measured page size changes
   * with it. Rendering the real toolbar throughout the load makes the two
   * heights equal by construction. The loading state still has to show the
   * right controls at both breakpoints, which is what this checks — now against
   * the real toolbar rather than a copy of it.
   */
  test("shows the real toolbar at both breakpoints while loading", () => {
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

    const mobile = container.querySelector("[data-ntable-mobile-toolbar]") as HTMLElement;
    expect(mobile).toBeTruthy();
    expect(mobile.querySelector("[data-ntable-mobile-primary-filter]")).toBeTruthy();

    const desktop = container.querySelector("[data-ntable-desktop-filters]") as HTMLElement;
    expect(desktop.children).toHaveLength(3);

    // No second, differently sized header inside the skeleton.
    expect(container.querySelector("[data-ntable-loading-header]")).toBeNull();
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
    // Unmeasured fallback. Deliberately generous: the skeleton is clipped by an
    // overflow-hidden viewport, so surplus placeholders are free, while too few
    // leave a visibly short skeleton that grows once measurement lands.
    expect(grid.querySelectorAll("[data-ntable-loading-card]")).toHaveLength(48);
  });

  test("responsiveSkeleton emits both shapes and lets CSS pick", () => {
    // A viewport-derived view mode is unknowable on the server, so the first
    // paint would otherwise always be the card shape and correct itself after
    // hydration. Both shapes ship; the media query decides.
    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        loading
        responsiveSkeleton
        renderCard={CardRenderer as any}
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
      />,
    );

    const table = container.querySelector('[data-ntable-skeleton-variant="table"]') as HTMLElement;
    const cards = container.querySelector('[data-ntable-skeleton-variant="cards"]') as HTMLElement;
    expect(table).toBeTruthy();
    expect(cards).toBeTruthy();
    // Complementary at the same breakpoint: exactly one is ever laid out.
    expect(table.className).toContain("hidden");
    expect(table.className).toContain("lg:flex");
    expect(cards.className).toContain("flex");
    expect(cards.className).toContain("lg:hidden");
    expect(table.querySelector('[data-testid="ntable-loading-skeleton"]')).toBeTruthy();
    expect(cards.querySelector('[data-testid="ntable-cards-loading-skeleton"]')).toBeTruthy();
  });

  test("renderCardSkeleton replaces the placeholder and stays measurable", () => {
    function ProductShapedSkeleton() {
      return <div data-testid="product-skeleton" style={{ height: 260 }} />;
    }

    const { container } = render(
      <NTable<Row>
        data={[]}
        columns={columns}
        loading
        renderCard={CardRenderer as any}
        renderCardSkeleton={ProductShapedSkeleton}
        defaultMode="cards"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
      />,
    );

    const grid = container.querySelector("[data-ntable-loading-cards-grid]") as HTMLElement;
    expect(grid.querySelectorAll('[data-testid="product-skeleton"]').length).toBeGreaterThan(0);
    // The built-in avatar placeholder must not also render.
    expect(grid.querySelector("[data-ntable-loading-card-avatar]")).toBeNull();
    // Card-height measurement keys off this attribute, so the consumer's
    // placeholder has to carry it without the consumer knowing that.
    const measured = grid.querySelectorAll("[data-ntable-loading-card]");
    expect(measured.length).toBe(grid.querySelectorAll('[data-testid="product-skeleton"]').length);
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
