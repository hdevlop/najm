import { describe, expect, test } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { NTabs } from "../../src/components/tabs/NTabs";
import { TAB_COLORS } from "../../src/components/tabs/tabColors";

const baseItems = [
  { value: "a", label: "Alpha",   content: <span>Alpha content</span> },
  { value: "b", label: "Beta",    content: <span>Beta content</span>  },
  { value: "c", label: "Gamma",   content: <span>Gamma content</span> },
];

describe("NTabs", () => {
  test("renders all item labels", () => {
    const { getByText } = render(<NTabs items={baseItems} defaultValue="a" />);
    expect(getByText("Alpha")).toBeTruthy();
    expect(getByText("Beta")).toBeTruthy();
    expect(getByText("Gamma")).toBeTruthy();
  });

  test("applies color preset list class to TabsList", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" color="primary" />,
    );
    const list = container.querySelector("[data-slot='tabs-list']")!;
    expect(list.className).toContain(TAB_COLORS.primary.list);
  });

  test("applies card color preset list class", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" color="card" />,
    );
    const list = container.querySelector("[data-slot='tabs-list']")!;
    expect(list.className).toContain(TAB_COLORS.card.list);
  });

  test("applies w-full to list and flex-1 to triggers when fullWidth", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" fullWidth />,
    );
    const list = container.querySelector("[data-slot='tabs-list']")!;
    expect(list.className).toContain("w-full");

    const triggers = container.querySelectorAll("[data-slot='tabs-trigger']");
    triggers.forEach((t) => expect(t.className).toContain("flex-1"));
  });

  test("does not apply w-full / flex-1 when fullWidth is false", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" fullWidth={false} />,
    );
    const list = container.querySelector("[data-slot='tabs-list']")!;
    expect(list.className).not.toContain("w-full");
  });

  test("marks a tab as disabled", () => {
    const items = [
      ...baseItems,
      { value: "d", label: "Delta", content: null, disabled: true },
    ];
    const { container } = render(<NTabs items={items} defaultValue="a" />);
    const triggers = container.querySelectorAll("[data-slot='tabs-trigger']");
    const disabled = Array.from(triggers).find((t) =>
      t.textContent?.includes("Delta"),
    ) as HTMLButtonElement | undefined;
    expect(disabled?.disabled).toBe(true);
  });

  test("classNames.list is applied to the list", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" classNames={{ list: "custom-list-class" }} />,
    );
    const list = container.querySelector("[data-slot='tabs-list']")!;
    expect(list.className).toContain("custom-list-class");
  });

  test("classNames.trigger is applied to every trigger", () => {
    const { container } = render(
      <NTabs items={baseItems} defaultValue="a" classNames={{ trigger: "custom-trigger-class" }} />,
    );
    const triggers = container.querySelectorAll("[data-slot='tabs-trigger']");
    triggers.forEach((t) => expect(t.className).toContain("custom-trigger-class"));
  });
});
