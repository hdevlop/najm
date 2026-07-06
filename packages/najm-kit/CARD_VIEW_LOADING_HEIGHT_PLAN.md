# Plan: Card-view loading skeleton doesn't fill viewport height

## Status

2026-06-30:
- Fix 1 implemented: card loading skeleton now uses the same `NajmScroll` wrapper as real card content.
- Fix 2 implemented: card loading skeleton count now defaults from table state (`calculatedPageSize`, then pagination page size) instead of hardcoded `8`.
- Fix 4 implemented: skeleton card borders now use `surfaceBorderClasses(bordered)` like real cards.
- Fix 3 remains intentionally open. It changes real card-mode dynamic page sizing and pagination behavior, so it should be handled as a separate behavior change after UI review.

The analysis below is retained as historical context for the original issue.

## Problem

In `viewMode="cards"`, the loading skeleton (`NTableCardsLoadingSkeleton`) renders
a fixed 2 rows of cards (8 cards at `xl:grid-cols-4`) and then leaves a large
empty area below it, even when the table container is tall enough to fit many
more rows. Table-mode skeleton does not have this problem.

## Root causes

1. **`useDynamicPageSize` only runs for `viewMode === "table"`.**
   `src/components/table/hooks.ts:135`
   ```ts
   if (!dynamicHeight || !containerRef.current || viewMode !== "table" || manualPagination) return;
   ```
   Card view never measures the container, so `calculatedPageSize` stays at
   its store default (`10`, see `store.ts:181`) and is never recomputed from
   available height/columns-per-row the way table view is.

2. **`NTableCardsLoadingSkeleton` has a hardcoded `rows = 8` default**, unrelated
   to `calculatedPageSize` or any container measurement.
   `src/components/table/NTableLoadingSkeleton.tsx:121`
   ```ts
   export function NTableCardsLoadingSkeleton({ rows = 8 }: { rows?: number }) {
   ```
   8 ≠ the real default page size (10), and isn't responsive to height at all.

3. **The skeleton's grid wrapper doesn't stretch/scroll like the real card grid.**
   `src/components/table/NTableLoadingSkeleton.tsx:137-141` renders a plain
   `grid` div with no `flex-1`/`min-h-0`/scroll container. Compare to the real
   data path, `NTableCards.tsx:82-83`, which wraps the grid in
   `<NajmScroll axis="y" className="min-h-0 flex-1 overflow-hidden">`. Because
   the skeleton's parent (`NTable.tsx:237`, `data-ntable-body`) is
   `flex flex-1 flex-col`, a short, non-stretching grid just sits at the top
   and leaves the rest of the flex space blank — exactly what's in the
   screenshot.

## Fixes

### Fix 1 — Wrap the skeleton grid the same way the real card grid is wrapped
File: `src/components/table/NTableLoadingSkeleton.tsx` (`NTableCardsLoadingSkeleton`)
Wrap the `grid ...` div in `NajmScroll axis="y" className="min-h-0 flex-1 overflow-hidden"`
(same as `NTableCards.tsx:82-83`), so the skeleton has the same height/overflow
behavior as the real content it's standing in for, instead of collapsing to
its intrinsic content height.
- Risk: low, purely structural/CSS, mirrors an existing working pattern.
- Unblocks: makes Fix 2's row count actually visible/scrollable instead of
  silently overflowing or clipping.

### Fix 2 — Stop hardcoding `rows = 8`; default it from real page size
File: `src/components/table/NTableLoadingSkeleton.tsx:121`
Read `calculatedPageSize` (or `pagination.pageSize` if `calculatedPageSize`
isn't meaningful in card mode yet) from `useTableStore` instead of a bare
literal default, so the skeleton card count always matches how many real
cards will render on first paint (today: 8 vs the real 10 — a visible
mismatch independent of the height issue).
- Depends on: nothing strictly, but pairs naturally with Fix 1 (no point
  matching count if the grid still doesn't fill height).
- Risk: low. Note `rows` is still an overridable prop — keep that escape hatch.

### Fix 3 — Make card view height-aware like table view (the real fix for "show more")
File: `src/components/table/hooks.ts` (`useDynamicPageSize`, currently gated to
`viewMode === "table"` at line 135)
Extend the hook (or add a sibling `useDynamicCardPageSize`) to also run when
`viewMode === "cards"`:
  - Measure the grid container's current column count. The breakpoints are
    hardcoded Tailwind classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
    xl:grid-cols-4`, see `NTableCards.tsx:78` and the skeleton's matching
    class string) — either read them via `window.matchMedia` breakpoint
    checks or measure actual rendered column count via
    `getComputedStyle(gridEl).gridTemplateColumns.split(' ').length` once a
    card is mounted.
  - Measure a single card's rendered height (or use a fixed `CARD_HEIGHT`
    constant analogous to `ROW_HEIGHT` in `hooks.ts`) and the available body
    height (same `bodyHeight` measurement already done for table mode,
    `hooks.ts:144-155`).
  - Compute `rowsThatFit = floor(bodyHeight / cardHeight)`, then
    `calculatedPageSize = rowsThatFit * columnsPerRow`, and feed it through
    `syncWithProps` the same way table mode does (`hooks.ts:160`).
  - Wire this `calculatedPageSize` into both: the real `NTableCards` pagination
    size (today fixed at the store default, scrolls for overflow instead of
    paginating) and the loading skeleton's `rows` (`rows = calculatedPageSize
    / columnsPerRow`, rounded up).
- Risk: medium. Column count detection from Tailwind responsive classes is
  inherently a bit fragile (matches what `NTableCards`/skeleton already
  hardcode, so any future breakpoint change has to stay in sync in 3 places:
  `NTableCards.tsx`, `NTableLoadingSkeleton.tsx`, and the new measurement
  logic — consider extracting the breakpoint list to one shared constant as
  part of this fix to avoid drift).
- This is the only fix that makes real (non-skeleton) card data also fill the
  viewport instead of relying purely on scroll for a short first page.

### Fix 4 — Skeleton cards ignore the `bordered` prop (always render a border)
File: `src/components/table/NTableLoadingSkeleton.tsx:145`
```ts
className={cn("rounded-lg bg-card p-4 shadow-none", bordered ? "border" : "border border-border")}
```
Both ternary branches add `"border"`, so `bordered === false` still renders a
border. Two layered causes:
  1. The ternary itself is wrong — the `false` branch should remove the
     border, not add `border-border` on top of it.
  2. Even a correct `""` for the false branch wouldn't be enough: the
     skeleton wraps each card in the base `Card` component
     (`src/components/ui/card.tsx:5`), which bakes in `border` by default.
     Tailwind-merge only cancels a baked-in `border` if the override is the
     stronger `border-0`, not an empty string.
Fix: replace the hand-rolled ternary with `surfaceBorderClasses(bordered)`
(`src/theme/borders.ts:32`), the same helper `NDataCardShell` already uses for
real (non-skeleton) cards — it correctly emits `border-0` for the unbordered
case. This also fixes the secondary issue that the bordered-true branch uses
plain `"border"` instead of the themed `"najm-border border-border"` real
cards get, so skeleton and real cards stay visually consistent.
- Risk: low, swaps one expression for an existing shared helper already
  proven correct in `NDataCardShell`.
- Independent of Fixes 1-3; can land separately/first since it's a one-line,
  low-risk correctness fix.

## Suggested order

1. Fix 1 (structural, unlocks correct visual behavior for any row count)
2. Fix 2 (cheap correctness fix, no design work needed)
3. Fix 3 (larger, touches shared measurement logic — do once 1 and 2 are
   verified, since it's the piece that actually computes "how many rows fit")

## Out of scope / open questions

- Whether real card-mode pagination should switch from "fetch default
  pageSize, scroll past it" to "fetch exactly what fits, paginate" is a UX
  decision (scroll vs. paginate) that Fix 3 enables but doesn't force —
  confirm with product/design before changing real pagination behavior, not
  just the skeleton.
- Mobile/responsive card view (`isMobile && responsiveCards`, `NTable.tsx:224`)
  should be re-checked after Fix 3, since column count = 1 there and the
  height math degenerates differently than desktop grids.
