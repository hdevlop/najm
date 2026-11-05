import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { NStatCard } from "../src/components/Card/StatCard";
import { NStatCardSkeleton } from "../src/components/feedback/NSkeletonPresets";

const classes = (element: Element | null | undefined) => new Set((element?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));

// The skeleton must take the card's room at every breakpoint, or a row of stat
// cards jumps when its figures arrive. Layout is not computed here, so parity
// is checked on what sets it: the surface, padding, icon box and line type.
describe("NStatCardSkeleton", () => {
  test("uses NStatCard's surface, padding and gaps", () => {
    const card = render(<NStatCard icon={Wallet} label="Cash" value="1.200 dh" />).container.firstElementChild;
    const skeleton = render(<NStatCardSkeleton />).container.firstElementChild;
    const cardClasses = classes(card);
    for (const name of ["p-2", "lg:p-3", "2xl:p-4", "rounded-xl", "border", "bg-card"]) {
      expect(cardClasses.has(name)).toBe(true);
      expect(classes(skeleton).has(name)).toBe(true);
    }
    const content = (root: Element | null | undefined) => root?.firstElementChild;
    for (const name of ["flex-row", "items-center", "gap-2", "lg:gap-3", "2xl:gap-4"]) {
      expect(classes(content(skeleton)).has(name)).toBe(classes(content(card)).has(name));
    }
  });

  test("sizes the icon box and each line like the card", () => {
    const card = render(<NStatCard icon={Wallet} label="Cash" value="1.200 dh" subtext="Excludes future" />).container;
    const skeleton = render(<NStatCardSkeleton subtext />).container;
    for (const name of ["h-8", "w-8", "lg:h-9", "lg:w-9", "2xl:h-10", "2xl:w-10", "rounded-xl"]) {
      expect(classes(card.querySelector("svg")?.parentElement).has(name)).toBe(true);
      expect(classes(skeleton.querySelector(".animate-pulse")).has(name)).toBe(true);
    }
    const cardLines = [...card.querySelectorAll("p")];
    const skeletonLines = [...skeleton.querySelectorAll("[data-skeleton-line]")];
    expect(skeletonLines).toHaveLength(3);
    const type = /^(?:\w+:)?(?:text-|leading-|font-)/;
    cardLines.forEach((line, index) => {
      const typeOf = (element: Element) => [...classes(element)].filter(name => type.test(name) && !/^text-(muted-)?foreground$/.test(name)).sort();
      expect(typeOf(skeletonLines[index])).toEqual(typeOf(line));
    });
  });

  test("adds the hint line only when asked", () => {
    expect(render(<NStatCardSkeleton />).container.querySelectorAll("[data-skeleton-line]")).toHaveLength(2);
    expect(render(<NStatCardSkeleton subtext />).container.querySelectorAll("[data-skeleton-line]")).toHaveLength(3);
  });

  test("a loading NStatCard keeps its hint line", () => {
    const { container } = render(<NStatCard loading icon={Wallet} label="Overdue" value="0" subtext="Excludes future" />);
    expect(container.querySelector("[role=status]")?.querySelectorAll("[data-skeleton-line]")).toHaveLength(3);
  });
});
