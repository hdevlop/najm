import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NDonutCard } from "../src/components/Card/DonutCard";
import type { NDonutCardItem } from "../src/components/Card/DonutCard";

const currency = (v: number) => `${v.toLocaleString()} MAD`;

const items: NDonutCardItem[] = [
  { id: "available", label: "Available", value: 5000, color: "#22c55e" },
  { id: "reserved", label: "Reserved", value: 3000, color: "#3b82f6" },
  { id: "spent", label: "Spent", value: 2000, color: "#ef4444" },
];

function formatRatio(r: number) {
  return `${(r * 100).toFixed(0)}%`;
}

describe("NDonutCard", () => {
  test("barrel exports NDonutCard", () => {
    expect(NDonutCard).toBeDefined();
  });

  test("uses theme palette colors when item colors are omitted and cycles after five", () => {
    const { container } = render(
      <NDonutCard
        title="Theme palette"
        items={Array.from({ length: 6 }, (_, index) => ({ id: String(index), label: String(index), value: 1 }))}
        valueFormatter={currency}
      />,
    );
    const style = container.querySelector("[data-slot='donut-ring']")?.getAttribute("style") ?? "";
    expect(style).toContain("var(--chart-1)");
    expect(style).toContain("var(--chart-5)");
    expect(style.match(/var\(--chart-1\)/g)?.length).toBe(2);
  });

  test("supports preset and custom shrinkable ring sizes", () => {
    const { container, rerender } = render(
      <NDonutCard title="Sized" items={items} size="sm" valueFormatter={currency} />,
    );
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    expect(ring.getAttribute("style")).toContain("112px");
    expect(ring.getAttribute("style")).toContain("max-width: 100%");
    rerender(<NDonutCard title="Sized" items={items} size={88} valueFormatter={currency} />);
    expect(ring.getAttribute("style")).toContain("88px");
  });

  test("renders an accessible shape-matched loading state", () => {
    const { getByRole } = render(
      <NDonutCard title="Loading donut" items={[]} loading loadingLabel="Loading budget" valueFormatter={currency} />,
    );
    expect(getByRole("status", { name: "Loading budget" }).getAttribute("aria-busy")).toBe("true");
  });

  test("default variant calculates total from positive items", () => {
    const { getByText } = render(
      <NDonutCard
        title="Budget"
        items={items}
        valueFormatter={currency}
        totalLabel="Total"
      />,
    );
    expect(getByText("10,000 MAD")).toBeDefined();
    expect(getByText("Total")).toBeDefined();
  });

  test("zero, negative, NaN, and infinite values are normalized safely", () => {
    const withBadValues: NDonutCardItem[] = [
      { id: "a", label: "A", value: -100, color: "#aaa" },
      { id: "b", label: "B", value: NaN, color: "#bbb" },
      { id: "c", label: "C", value: Infinity, color: "#ccc" },
      { id: "d", label: "D", value: 0, color: "#ddd" },
    ];
    const { container } = render(
      <NDonutCard
        title="Test"
        items={withBadValues}
        valueFormatter={currency}
      />,
    );
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    expect(ring).toBeDefined();
    const centerText = container.querySelector("[data-slot='donut-center-content'] span")!;
    expect(centerText.textContent).toBe("0 MAD");
  });

  test("zero total produces full muted ring and no invalid CSS", () => {
    const zeroItems: NDonutCardItem[] = [
      { id: "a", label: "A", value: 0, color: "#aaa" },
    ];
    const { container } = render(
      <NDonutCard
        title="Zero"
        items={zeroItems}
        valueFormatter={currency}
      />,
    );
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    expect(ring).toBeDefined();
    expect(ring.className).toContain("bg-muted");
    const style = ring.getAttribute("style");
    expect(style).not.toContain("conic-gradient");
  });

  test("zero-value categories remain in textual legend", () => {
    const mixedItems: NDonutCardItem[] = [
      { id: "ok", label: "OK", value: 100, color: "#0f0" },
      { id: "zero", label: "Zero", value: 0, color: "#f00" },
    ];
    const { getByText } = render(
      <NDonutCard
        title="Mixed"
        items={mixedItems}
        valueFormatter={currency}
      />,
    );
    expect(getByText("Zero")).toBeDefined();
  });

  test("compact variant exposes data-variant and correct sizes", () => {
    const { container } = render(
      <NDonutCard
        title="Compact"
        items={items}
        valueFormatter={currency}
        variant="compact"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-variant")).toBe("compact");
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    const ringStyle = ring.getAttribute("style")!;
    expect(ringStyle).toContain("96px");
  });

  test("compact center can render value, unit, and label as separate rows", () => {
    const { container } = render(
      <NDonutCard
        title="Compact"
        items={items}
        valueFormatter={currency}
        centerValueFormatter={(value) => value.toLocaleString()}
        centerUnit="MAD"
        totalLabel="Total"
        variant="compact"
      />,
    );

    expect(
      container.querySelector("[data-slot='donut-center-value']")?.textContent,
    ).toBe("10,000");
    expect(
      container.querySelector("[data-slot='donut-center-unit']")?.textContent,
    ).toBe("MAD");
    expect(
      container.querySelector("[data-slot='donut-center-label']")?.textContent,
    ).toBe("Total");
  });

  test("default variant exposes data-variant and correct sizes", () => {
    const { container } = render(
      <NDonutCard
        title="Default"
        items={items}
        valueFormatter={currency}
        variant="default"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-variant")).toBe("default");
    expect(card.getAttribute("data-layout")).toBe("auto");
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    const ringStyle = ring.getAttribute("style")!;
    expect(ringStyle).toContain("144px");
  });

  test("horizontal layout keeps the selected default size", () => {
    const { container } = render(
      <NDonutCard
        title="Horizontal"
        items={items}
        valueFormatter={currency}
        variant="default"
        layout="horizontal"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-variant")).toBe("default");
    expect(card.getAttribute("data-layout")).toBe("horizontal");
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    const ringStyle = ring.getAttribute("style")!;
    expect(ringStyle).toContain("144px");
  });

  test("compact variant supports the horizontal layout", () => {
    const { container } = render(
      <NDonutCard
        title="CompactHorizontal"
        items={items}
        valueFormatter={currency}
        variant="compact"
        layout="horizontal"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-variant")).toBe("compact");
    expect(card.getAttribute("data-layout")).toBe("horizontal");
    expect(card.className).toContain("grid");
    expect(card.className).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card.className).not.toContain("@min-[16rem]");
    expect(card.className).not.toContain("@container");
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    const ringStyle = ring.getAttribute("style")!;
    expect(ringStyle).toContain("96px");
    const centerValue = container.querySelector("[data-slot='donut-center-value']") as HTMLElement;
    expect(centerValue.className).toContain("text-xs");
  });

  test("default auto layout is horizontal on mobile and vertical from md", () => {
    const { container } = render(
      <NDonutCard
        title="Auto"
        items={items}
        valueFormatter={currency}
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-layout")).toBe("auto");
    expect(card.className).toContain("flex");
    expect(card.className).toContain("items-center");
    expect(card.className).toContain("gap-4");
    expect(card.className).toContain("md:flex-col");
    expect(card.className).not.toContain("grid");
    expect(card.className).not.toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card.className).not.toContain("@container");
    expect(card.className).not.toContain("@min-[16rem]");

    const legend = container.querySelector("[data-slot='donut-legend']") as HTMLElement;
    expect(legend.className).toContain("ms-auto");
    expect(legend.className).toContain("md:ms-0");
    expect(legend.className).toContain("md:w-full");
    expect(legend.className).toContain("md:flex-col");
  });

  test("auto legend stacks each value below its label with ms-4 indent", () => {
    const { container } = render(
      <NDonutCard
        title="Auto"
        items={items}
        valueFormatter={currency}
      />,
    );
    const legend = container.querySelector("[data-slot='donut-legend']") as HTMLElement;
    expect(legend.className).toContain("ms-auto");
    expect(legend.className).toContain("shrink-0");
    expect(legend.className).toContain("space-y-3");
    expect(legend.className).toContain("md:w-full");
    expect(legend.className).toContain("md:flex-col");
    expect(legend.className).toContain("md:gap-1.5");
    expect(legend.className).toContain("md:space-y-0");
    expect(legend.className).not.toContain("@container");
    expect(legend.className).not.toContain("@min-[16rem]");

    const legendItems = container.querySelectorAll("[data-slot='donut-legend-item']");
    expect(legendItems.length).toBe(items.length);

    const firstItemLabelRow = legendItems[0].querySelector(":scope > div") as HTMLElement;
    expect(firstItemLabelRow.className).toContain("flex");
    expect(firstItemLabelRow.className).toContain("items-center");
    expect(firstItemLabelRow.className).toContain("gap-2");
    expect(firstItemLabelRow.className).not.toContain("flex-col");
    expect(firstItemLabelRow.className).toContain("md:min-w-0");

    expect((legendItems[0] as HTMLElement).className).toContain("md:justify-between");

    const labelSpan = firstItemLabelRow.querySelectorAll(":scope > span")[1] as HTMLElement;
    expect(labelSpan.className).toContain("flex-1");
    expect(labelSpan.className).toContain("truncate");
    expect(labelSpan.className).toContain("min-w-0");

    const valueSpan = legendItems[0].querySelector(":scope > span") as HTMLElement;
    expect(valueSpan.className).toContain("ms-4");
    expect(valueSpan.className).toContain("block");
    expect(valueSpan.className).toContain("whitespace-nowrap");
    expect(valueSpan.className).toContain("tabular-nums");
    expect(valueSpan.className).toContain("font-semibold");
    expect(valueSpan.className).toContain("md:ms-0");
  });

  test("auto compact legend uses compact text sizes for label and value", () => {
    const { container } = render(
      <NDonutCard
        title="AutoCompact"
        items={items}
        valueFormatter={currency}
        variant="compact"
      />,
    );
    const legendItems = container.querySelectorAll("[data-slot='donut-legend-item']");
    const firstItemLabelRow = legendItems[0].querySelector(":scope > div") as HTMLElement;
    expect(firstItemLabelRow.className).toContain("items-center");

    const labelSpan = firstItemLabelRow.querySelectorAll(":scope > span")[1] as HTMLElement;
    expect(labelSpan.className).toContain("text-[11px]");
    expect(labelSpan.className).toContain("flex-1");

    const valueSpan = legendItems[0].querySelector(":scope > span") as HTMLElement;
    expect(valueSpan.className).toContain("text-[11px]");
    expect(valueSpan.className).toContain("ms-4");
    expect(valueSpan.className).toContain("font-semibold");
  });

  test("explicit layout=\"vertical\" overrides auto and stays vertical at all sizes", () => {
    const { container } = render(
      <NDonutCard
        title="ForcedVertical"
        items={items}
        valueFormatter={currency}
        layout="vertical"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-layout")).toBe("vertical");
    expect(card.className).not.toContain("grid");
    expect(card.className).not.toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card.className).not.toContain("sm:flex-col");
    expect(card.className).toContain("flex-col");
    expect(card.className).toContain("items-center");
  });

  test("explicit layout=\"horizontal\" overrides auto and stays horizontal at all sizes", () => {
    const { container } = render(
      <NDonutCard
        title="ForcedHorizontal"
        items={items}
        valueFormatter={currency}
        layout="horizontal"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.getAttribute("data-layout")).toBe("horizontal");
    expect(card.className).toContain("grid");
    expect(card.className).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card.className).not.toContain("sm:flex-col");
  });

  test("centerIcon replaces total text", () => {
    const { container } = render(
      <NDonutCard
        title="Icon"
        items={items}
        valueFormatter={currency}
        centerIcon="wallet"
      />,
    );
    const center = container.querySelector("[data-slot='donut-center-content']") as HTMLElement;
    expect(center.textContent).not.toContain("MAD");
  });

  test("percentageFormatter receives ratios and renders only when provided", () => {
    const { container } = render(
      <NDonutCard
        title="Pct"
        items={items}
        valueFormatter={currency}
        percentageFormatter={formatRatio}
      />,
    );
    const legendValues = container.querySelector("[data-slot='donut-legend']")!;
    expect(legendValues.textContent).toContain("50%");
    expect(legendValues.textContent).toContain("30%");
    expect(legendValues.textContent).toContain("20%");
  });

  test("percentageFormatter not rendered when omitted", () => {
    const { container } = render(
      <NDonutCard
        title="NoPct"
        items={items}
        valueFormatter={currency}
      />,
    );
    const legendValues = container.querySelector("[data-slot='donut-legend']")!;
    expect(legendValues.textContent).not.toContain("%");
  });

  test("emptyLabel is visible for zero totals", () => {
    const zeroItems: NDonutCardItem[] = [
      { id: "a", label: "A", value: 0, color: "#aaa" },
    ];
    const { getByText } = render(
      <NDonutCard
        title="Empty"
        items={zeroItems}
        valueFormatter={currency}
        emptyLabel="No budget data"
      />,
    );
    expect(getByText("No budget data")).toBeDefined();
  });

  test("footer content renders through card footer", () => {
    const { getByText } = render(
      <NDonutCard
        title="Footer"
        items={items}
        valueFormatter={currency}
        footer={<span>View all</span>}
      />,
    );
    expect(getByText("View all")).toBeDefined();
  });

  test("custom root and slot classes are applied", () => {
    const { container } = render(
      <NDonutCard
        title="Custom"
        items={items}
        valueFormatter={currency}
        className="my-custom-root"
        classNames={{
          ring: "my-ring",
          legend: "my-legend",
          legendItem: "my-legend-item",
        }}
      />,
    );
    const root = container.querySelector(".my-custom-root");
    expect(root).toBeDefined();
    const ring = container.querySelector("[data-slot='donut-ring'].my-ring");
    expect(ring).toBeDefined();
    const legend = container.querySelector("[data-slot='donut-legend'].my-legend");
    expect(legend).toBeDefined();
    const legendItem = container.querySelector("[data-slot='donut-legend-item'].my-legend-item");
    expect(legendItem).toBeDefined();
  });

  test("chart has accessible name and ring is decorative", () => {
    const { container } = render(
      <NDonutCard
        title="Budget Overview"
        items={items}
        valueFormatter={currency}
      />,
    );
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    expect(ring.getAttribute("aria-hidden")).toBe("true");

    const card = container.querySelector("[role='group'][aria-label='Budget Overview']");
    expect(card).toBeDefined();
  });

  test("non-string title with ariaLabel provides accessible name", () => {
    const { container } = render(
      <NDonutCard
        title={<strong>Budget</strong>}
        ariaLabel="Budget Overview"
        items={items}
        valueFormatter={currency}
      />,
    );
    const card = container.querySelector("[role='group'][aria-label='Budget Overview']");
    expect(card).toBeDefined();
  });

  test("gradient stops have correct cumulative angles", () => {
    const { container } = render(
      <NDonutCard
        title="Gradient"
        items={items}
        valueFormatter={currency}
      />,
    );
    const ring = container.querySelector("[data-slot='donut-ring']") as HTMLElement;
    const style = ring.getAttribute("style")!;
    expect(style).toContain("conic-gradient");
    expect(style).toContain("#22c55e 0turn 0.5turn");
    expect(style).toContain("#3b82f6 0.5turn 0.8turn");
    expect(style).toContain("#ef4444 0.8turn 1turn");
  });

  test("horizontal layout uses a grid with side-by-side donut and legend", () => {
    const { container } = render(
      <NDonutCard
        title="Horizontal"
        items={items}
        valueFormatter={currency}
        percentageFormatter={formatRatio}
        variant="default"
        layout="horizontal"
      />,
    );
    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.className).toContain("grid");
    expect(card.className).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(card.className).not.toContain("@min-[16rem]");
    expect(card.className).not.toContain("@container");

    const legendItems = container.querySelectorAll("[data-slot='donut-legend-item']");
    expect(legendItems.length).toBe(items.length);
  });

  test("horizontal legend shows detailed values and percentages", () => {
    const { container } = render(
      <NDonutCard
        title="Horizontal"
        items={items}
        valueFormatter={currency}
        percentageFormatter={formatRatio}
        variant="default"
        layout="horizontal"
      />,
    );
    const legend = container.querySelector("[data-slot='donut-legend']") as HTMLElement;
    const valueSpans = legend.querySelectorAll("span.tabular-nums");
    expect(valueSpans.length).toBe(items.length);
    expect(legend.textContent).toContain("50%");
    expect(legend.textContent).toContain("30%");
    expect(legend.textContent).toContain("20%");
  });

  test("legend markers support dots, item icons, and no marker", () => {
    const iconItems: NDonutCardItem[] = items.map((item) => ({
      ...item,
      icon: "wallet",
    }));
    const { container, rerender } = render(
      <NDonutCard
        title="Dots"
        items={iconItems}
        valueFormatter={currency}
      />,
    );

    expect(
      container.querySelectorAll("[data-slot='donut-legend-marker']").length,
    ).toBe(items.length);
    expect(
      container.querySelectorAll("[data-slot='donut-legend-marker'] svg").length,
    ).toBe(0);

    rerender(
      <NDonutCard
        title="Icons"
        items={iconItems}
        valueFormatter={currency}
        legendMarker="icon"
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='donut-legend-marker'] svg").length,
    ).toBe(items.length);

    rerender(
      <NDonutCard
        title="No markers"
        items={iconItems}
        valueFormatter={currency}
        legendMarker="none"
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='donut-legend-marker']").length,
    ).toBe(0);
  });

  test("compact legend stacks items vertically with space-y and no wrap", () => {
    const { container } = render(
      <NDonutCard
        title="Compact"
        items={items}
        valueFormatter={currency}
        variant="compact"
      />,
    );
    const legend = container.querySelector("[data-slot='donut-legend']") as HTMLElement;
    expect(legend.className).toContain("space-y-3");
    expect(legend.className).not.toContain("flex-wrap");
  });

  test("center content has max-width and padding to avoid touching the ring", () => {
    const { container } = render(
      <NDonutCard
        title="Compact"
        items={items}
        valueFormatter={currency}
        variant="compact"
      />,
    );
    const centerContent = container.querySelector(
      "[data-slot='donut-center-content']",
    ) as HTMLElement;
    expect(centerContent.className).toContain("max-w-[88%]");
    expect(centerContent.className).toContain("px-1");
  });

  test("center content defaults to column orientation", () => {
    const { container } = render(
      <NDonutCard
        title="Col"
        items={items}
        valueFormatter={currency}
        centerUnit="MAD"
        totalLabel="Total"
      />,
    );
    const centerContent = container.querySelector(
      "[data-slot='donut-center-content']",
    ) as HTMLElement;
    expect(centerContent.getAttribute("data-center-orientation")).toBe("column");
    expect(centerContent.className).toContain("flex-col");
    expect(centerContent.className).not.toContain("flex-row");
    const unit = container.querySelector("[data-slot='donut-center-unit']") as HTMLElement;
    const label = container.querySelector("[data-slot='donut-center-label']") as HTMLElement;
    expect(unit.className).toMatch(/\bmt-/);
    expect(label.className).toMatch(/\bmt-/);
  });

  test("centerOrientation=\"row\" lays value, unit, and label horizontally", () => {
    const { container } = render(
      <NDonutCard
        title="Row"
        items={items}
        valueFormatter={currency}
        centerUnit="MAD"
        totalLabel="Total"
        centerOrientation="row"
      />,
    );
    const centerContent = container.querySelector(
      "[data-slot='donut-center-content']",
    ) as HTMLElement;
    expect(centerContent.getAttribute("data-center-orientation")).toBe("row");
    expect(centerContent.className).toContain("flex-row");
    expect(centerContent.className).toContain("gap-1");
    expect(centerContent.className).not.toContain("flex-col");
    const unit = container.querySelector("[data-slot='donut-center-unit']") as HTMLElement;
    const label = container.querySelector("[data-slot='donut-center-label']") as HTMLElement;
    expect(unit.className).not.toMatch(/\bmt-/);
    expect(label.className).not.toMatch(/\bmt-/);
  });

  test("centerOrientation=\"row\" works in compact variant", () => {
    const { container } = render(
      <NDonutCard
        title="CompactRow"
        items={items}
        valueFormatter={currency}
        centerUnit="MAD"
        totalLabel="Total"
        variant="compact"
        centerOrientation="row"
      />,
    );
    const centerContent = container.querySelector(
      "[data-slot='donut-center-content']",
    ) as HTMLElement;
    expect(centerContent.getAttribute("data-center-orientation")).toBe("row");
    expect(centerContent.className).toContain("flex-row");
    const value = container.querySelector("[data-slot='donut-center-value']") as HTMLElement;
    expect(value.className).toContain("text-xs");
  });

  test("compact horizontal layout contains no container-query classes anywhere", () => {
    const { container } = render(
      <NDonutCard
        title="CompactHorizontalNoCQ"
        items={items}
        valueFormatter={currency}
        variant="compact"
        layout="horizontal"
      />,
    );

    const cardContent = container.querySelector("[data-slot='card-content']") as HTMLElement;
    expect(cardContent).toBeDefined();
    expect(cardContent.className).not.toContain("@container");
    expect(cardContent.className).not.toContain("@min-[16rem]");

    const card = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    expect(card.className).not.toContain("@container");
    expect(card.className).not.toContain("@min-[16rem]");
    expect(card.className).toContain("grid-cols-[auto_minmax(0,1fr)]");

    const legend = container.querySelector("[data-slot='donut-legend']") as HTMLElement;
    expect(legend.className).not.toContain("@min-[16rem]");
    expect(legend.className).toContain("min-w-0");
    expect(legend.className).toContain("flex-1");

    const donutWrapper = card.firstElementChild as HTMLElement;
    expect(donutWrapper.className).toContain("shrink-0");
  });

  test("card height follows content; h-full is not forced", () => {
    const { container, rerender } = render(
      <NDonutCard
        title="Default"
        items={items}
        valueFormatter={currency}
        variant="default"
      />,
    );
    const donutCard = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    const ncard = donutCard.closest("[data-slot='card']");
    const ncardClass = (ncard && (ncard as HTMLElement).className) || "";
    expect(ncardClass).not.toContain("h-full");

    rerender(
      <NDonutCard
        title="Tall"
        items={items}
        valueFormatter={currency}
        className="h-full"
        variant="default"
      />,
    );
    const donutCard2 = container.querySelector("[data-slot='donut-card']") as HTMLElement;
    const tallCard = donutCard2.closest("[data-slot='card']");
    const tallClass = (tallCard && (tallCard as HTMLElement).className) || "";
    expect(tallClass).toContain("h-full");
  });
});
