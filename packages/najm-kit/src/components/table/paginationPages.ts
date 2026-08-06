/** A rendered slot in the numbered page list. */
export type NTablePageItem =
  | { type: "page"; pageIndex: number }
  | { type: "gap"; key: "start" | "end" };

/**
 * The page numbers to render for a given position in the result.
 *
 * Always yields the first and last page, the current page, and `siblingCount`
 * pages either side of it, collapsing the rest into at most two gaps. Near
 * either end, where one gap is not needed, the freed slots extend the run of
 * pages instead of being dropped — so the slot count stays constant at
 * `2 * siblingCount + 5` for any result longer than that. A bar that changes
 * width on every click is worse than the text it replaced.
 *
 * `unbounded` says the result continues past `pageCount`, which is then every
 * page *known* to exist rather than the whole result — all an endpoint that
 * reports no total can prove. The window is built over the known pages and a
 * trailing gap is appended, so the bar reads "and more after this" from the
 * first page rather than silently growing a number each time one is
 * discovered. It goes back to false at the end of the result, where the pages
 * read are the result and the count is exact.
 */
export function buildPageItems(
  pageIndex: number,
  pageCount: number,
  siblingCount = 1,
  unbounded = false,
): NTablePageItem[] {
  const items = buildKnownPageItems(pageIndex, pageCount, siblingCount);
  // Nothing known means nothing to qualify: a trailing gap on its own would
  // claim pages exist without offering one to click.
  if (!unbounded || items.length === 0) return items;
  return [...items, { type: "gap", key: "end" }];
}

function buildKnownPageItems(
  pageIndex: number,
  pageCount: number,
  siblingCount: number,
): NTablePageItem[] {
  const pages = Math.max(0, Math.floor(pageCount));
  if (pages <= 0) return [];

  const current = Math.min(Math.max(0, Math.floor(pageIndex)), pages - 1);
  const siblings = Math.max(0, Math.floor(siblingCount));
  const lastIndex = pages - 1;

  // first + last + current + siblings on both sides + both gaps.
  const windowSize = siblings * 2 + 5;
  if (pages <= windowSize) {
    return range(0, lastIndex);
  }

  const left = Math.max(current - siblings, 0);
  const right = Math.min(current + siblings, lastIndex);

  // A gap is only worth a slot when it hides at least two pages; hiding one
  // behind an ellipsis costs the same width as showing it. Falling through to
  // the run branches below spends that slot on a page instead, so this never
  // trades away the constant width.
  const showStartGap = left - 1 >= 2;
  const showEndGap = lastIndex - 1 - right >= 2;

  // The run of consecutive pages shown when only one gap is needed.
  const runLength = siblings * 2 + 3;

  if (!showStartGap && showEndGap) {
    return [
      ...range(0, runLength - 1),
      { type: "gap", key: "end" },
      page(lastIndex),
    ];
  }

  if (showStartGap && !showEndGap) {
    return [
      page(0),
      { type: "gap", key: "start" },
      ...range(lastIndex - runLength + 1, lastIndex),
    ];
  }

  return [
    page(0),
    { type: "gap", key: "start" },
    ...range(left, right),
    { type: "gap", key: "end" },
    page(lastIndex),
  ];
}

function page(pageIndex: number): NTablePageItem {
  return { type: "page", pageIndex };
}

function range(from: number, to: number): NTablePageItem[] {
  return Array.from({ length: to - from + 1 }, (_, index) => page(from + index));
}
