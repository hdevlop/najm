import { describe, expect, test } from "bun:test";

import { buildPageItems, type NTablePageItem } from "../../src/components/table/paginationPages";

/** "1 … 4 5 6 … 20" — the shape a reader actually sees. */
function shape(items: NTablePageItem[]) {
  return items
    .map((item) => (item.type === "gap" ? "…" : String(item.pageIndex + 1)))
    .join(" ");
}

describe("numbered page windowing", () => {
  test("a short result lists every page", () => {
    expect(shape(buildPageItems(0, 5))).toBe("1 2 3 4 5");
    expect(shape(buildPageItems(3, 7))).toBe("1 2 3 4 5 6 7");
  });

  test("a result exactly at the window size is still listed whole", () => {
    // siblingCount 1 gives a 7-slot window, so 7 pages need no gap at all.
    expect(shape(buildPageItems(3, 7))).toBe("1 2 3 4 5 6 7");
  });

  test("the middle of a long result collapses both ends", () => {
    expect(shape(buildPageItems(9, 20))).toBe("1 … 9 10 11 … 20");
  });

  test("near the start the freed slots extend the run", () => {
    // Not "1 2 … 20" — the slots the missing gap frees are spent on pages.
    expect(shape(buildPageItems(0, 20))).toBe("1 2 3 4 5 … 20");
    expect(shape(buildPageItems(2, 20))).toBe("1 2 3 4 5 … 20");
  });

  test("near the end the freed slots extend the run", () => {
    expect(shape(buildPageItems(19, 20))).toBe("1 … 16 17 18 19 20");
    expect(shape(buildPageItems(17, 20))).toBe("1 … 16 17 18 19 20");
  });

  test("the slot count never changes once the result exceeds the window", () => {
    // A bar that reflows as the reader pages through it is worse than the text
    // it replaced, so this is the property that matters most.
    const widths = new Set(
      Array.from({ length: 20 }, (_, index) => buildPageItems(index, 20).length),
    );
    expect([...widths]).toEqual([7]);
  });

  test("a gap never stands in for a single page", () => {
    // Page 4 of 9 would put a gap over page 2 alone; the slot goes to the page.
    expect(shape(buildPageItems(3, 9))).toBe("1 2 3 4 5 … 9");
    // Page 6 of 9 is the mirror case, over page 8.
    expect(shape(buildPageItems(5, 9))).toBe("1 … 5 6 7 8 9");
    // Page 5 of 9 genuinely has two pages to hide on each side.
    expect(shape(buildPageItems(4, 9))).toBe("1 … 4 5 6 … 9");
  });

  test("every page reachable from the window includes the current page", () => {
    // A window that can leave the current page unrendered would show the
    // reader a bar with nothing marked as where they are.
    for (let pages = 1; pages <= 40; pages += 1) {
      for (let index = 0; index < pages; index += 1) {
        const shown = buildPageItems(index, pages)
          .filter((item) => item.type === "page")
          .map((item) => (item as { pageIndex: number }).pageIndex);
        expect(shown).toContain(index);
      }
    }
  });

  test("siblingCount widens the window symmetrically", () => {
    expect(shape(buildPageItems(9, 20, 2))).toBe("1 … 8 9 10 11 12 … 20");
    const widths = new Set(
      Array.from({ length: 20 }, (_, index) => buildPageItems(index, 20, 2).length),
    );
    expect([...widths]).toEqual([9]);
  });

  test("degenerate counts produce nothing to render", () => {
    expect(buildPageItems(0, 0)).toEqual([]);
    expect(buildPageItems(0, -3)).toEqual([]);
  });

  test("a page index outside the result is clamped into it", () => {
    expect(shape(buildPageItems(99, 5))).toBe("1 2 3 4 5");
    expect(shape(buildPageItems(-4, 5))).toBe("1 2 3 4 5");
  });

  test("one page renders one button", () => {
    expect(shape(buildPageItems(0, 1))).toBe("1");
  });
});

describe("an unknown result total", () => {
  /** What an endpoint with no total can prove while sitting on `pageIndex`. */
  function known(pageIndex: number, hasNextPage = true) {
    return pageIndex + (hasNextPage ? 2 : 1);
  }

  test("the pages proven to exist carry a trailing gap for the rest", () => {
    // The gap is there on page one, so discovering page three on the way to
    // page two reads as the result continuing, not as the bar growing.
    expect(shape(buildPageItems(0, known(0), 1, true))).toBe("1 2 …");
    expect(shape(buildPageItems(1, known(1), 1, true))).toBe("1 2 3 …");
    expect(shape(buildPageItems(2, known(2), 1, true))).toBe("1 2 3 4 …");
  });

  test("reaching the end drops the gap and the bar becomes exact", () => {
    // No next page means the pages read *are* the result, so the count is now
    // exact and the qualifier has nothing left to qualify.
    expect(shape(buildPageItems(3, known(3, false), 1, false))).toBe("1 2 3 4");
  });

  test("the slot count settles instead of growing without bound", () => {
    // Once the window collapses, every further page is one gap plus the same
    // run — an unknown total costs one extra slot, not one slot per click.
    expect(shape(buildPageItems(6, known(6), 1, true))).toBe("1 … 4 5 6 7 8 …");
    expect(shape(buildPageItems(20, known(20), 1, true))).toBe("1 … 18 19 20 21 22 …");

    const widths = new Set(
      Array.from({ length: 30 }, (_, index) =>
        buildPageItems(index + 5, known(index + 5), 1, true).length),
    );
    expect([...widths]).toEqual([8]);
  });

  test("the current page is always in the window", () => {
    for (let index = 0; index < 40; index += 1) {
      const shown = buildPageItems(index, known(index), 1, true)
        .filter((item) => item.type === "page")
        .map((item) => (item as { pageIndex: number }).pageIndex);
      expect(shown).toContain(index);
    }
  });

  test("nothing known renders nothing, not a bare gap", () => {
    // A lone "…" would claim pages exist while offering none to click.
    expect(buildPageItems(0, 0, 1, true)).toEqual([]);
  });
});
