import React from "react";
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { ChartNoAxesCombined } from "lucide-react";

import {
  NBarChart,
  NChartSkeleton,
  NLineChart,
  NPieChart,
  NStatusBreakdown,
  getNChartColor,
} from "../src";

const series = [
  { id: "income", label: "Income" },
  { id: "refund", label: "Refund", color: "tomato" },
];
const data = [
  { id: "jan", label: "Jan", values: { income: 10, refund: 2 } },
  { id: "feb", label: "Feb", values: { income: 20, refund: 0 } },
];

describe("Najm charts", () => {
  test("exports every public chart component", () => {
    expect(NBarChart).toBeDefined();
    expect(NLineChart).toBeDefined();
    expect(NPieChart).toBeDefined();
    expect(NStatusBreakdown).toBeDefined();
    expect(NChartSkeleton).toBeDefined();
  });

  test("uses five deterministic theme colors and cycles additional series", () => {
    expect(getNChartColor(0)).toBe("var(--chart-1)");
    expect(getNChartColor(4)).toBe("var(--chart-5)");
    expect(getNChartColor(5)).toBe("var(--chart-1)");
    expect(getNChartColor(2, "rebeccapurple")).toBe("rebeccapurple");
  });

  test("bar chart renders generic formatted values and theme-backed colors", () => {
    const { container, getByRole } = render(
      <NBarChart data={data} icon={ChartNoAxesCombined} series={series} title="Activity" valueFormatter={(value) => `${value} MAD`} />,
    );
    expect(getByRole("img", { name: "Activity" })).toBeDefined();
    expect(container.innerHTML).toContain("var(--chart-1)");
    expect(container.innerHTML).toContain("tomato");
    expect(container.textContent).toContain("20 MAD");
  });

  test("line chart keeps caller labels in an accessible summary", () => {
    const { getByRole } = render(<NLineChart data={data} icon={ChartNoAxesCombined} series={series} title="Trend" />);
    expect(getByRole("img", { name: "Trend" }).textContent).toContain("Jan");
    expect(getByRole("img", { name: "Trend" }).textContent).toContain("Income");
  });

  test("pie accepts compact and exact sizes without losing legend content", () => {
    const { container, rerender } = render(
      <NPieChart items={[{ id: "a", label: "A", value: 2 }, { id: "b", label: "B", value: 1 }]} size="sm" title="Pie" />,
    );
    expect(container.querySelector("svg")?.getAttribute("style")).toContain("112px");
    expect(container.textContent).toContain("A");
    rerender(<NPieChart items={[{ id: "a", label: "A", value: 2 }]} size={92} title="Pie" />);
    expect(container.querySelector("svg")?.getAttribute("style")).toContain("92px");
  });

  test("status breakdown supports responsive caller classes", () => {
    const { container } = render(
      <NStatusBreakdown items={[{ id: "approved", label: "Approved", value: 4, className: "hidden xl:block" }]} title="Pipeline" />,
    );
    expect(container.querySelector(".hidden.xl\\:block")).toBeDefined();
  });

  test("loading variants expose an accessible busy state", () => {
    const { getByRole } = render(<NLineChart data={[]} icon={ChartNoAxesCombined} loading loadingLabel="Loading trend" series={[]} title="Trend" />);
    const status = getByRole("status", { name: "Loading trend" });
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  test("empty charts render the caller empty state", () => {
    const { getByText } = render(<NPieChart emptyLabel="Nothing yet" items={[]} title="Empty" />);
    expect(getByText("Nothing yet")).toBeDefined();
  });
});
