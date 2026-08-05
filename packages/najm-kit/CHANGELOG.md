# Changelog

## 2.2.0

- Added `cardPagination` mode `infinite`: card lists continue on scroll instead of behind a button. No control and no end-of-list element render while the list is healthy. The continuation button appears only after an append failure, as the retry target.
- Infinite continuation is owned by `NTableCards`, so the sentinel lives inside the card list's own `NajmScroll` viewport and uses it as the observer root. An appending page renders shaped card placeholders at the grid tail rather than a spinner in a fixed strip, and the polite `aria-live` announcement of appended row counts is preserved.
- `cardPagination: { mode: "all" }` is now honored in table mode as well as cards: every supplied row renders and no pagination controls are shown.
- `dynamicHeight` now takes effect under `manualPagination`. The measured page size is reported through the ordinary `onPaginationChange` callback, debounced, so server-paginated tables fill their container while the consumer keeps ownership of fetching. `maxHeight` stays caller-owned under manual pagination, and no page size is reported before the first measurement.
- Added `calculateCardPageSize`, floored to whole card rows, published as `calculatedCardPageSize`. A card grid page no longer ends in a ragged partial row. This deliberately differs from `calculateCardSkeletonCount`, which ceils because overfilling placeholders is harmless.
- Removed the deprecated `baseUrl` compiler option from the package tsconfig; `paths` resolves relative to the config file.

## 2.1.56

- Honor `showIcon` on NTable `select` and `combobox` filters. The leading filter icon is still shown by default; pass `showIcon: false` on a filter to hide it.

## 2.1.55

- Added controlled remote-search and loading-state props to `ComboboxInput` and `FormInput type="combobox"` while preserving client filtering by default.

## 2.1.53 - 2026-08-05

- Add typed `NBarChart`, `NLineChart`, `NPieChart`, and `NStatusBreakdown`
  components with caller-formatted generic data, accessible summaries, empty
  states, responsive RTL-safe layouts, and shape-matched loading skeletons.
- Default chart colors to the live `--chart-1` through `--chart-5` theme
  variables, cycle deterministically after five items, and retain explicit
  per-series/item color overrides.
- Add preset and numeric chart diameter contracts to `NPieChart` and
  `NDonutCard`, including narrow-container shrinking without clipped legends.
- Make `NDonutCard` item colors optional and add accessible loading states to
  `NDonutCard` and `NStatCard`.
- Add public API tests, component tests, README guidance, and playground
  examples for the chart and loading contracts.

## 2.1.49 - 2026-08-04

### ImageInput and AvatarInput

- Add `previewAlt`, `fallbackImage`, `fallbackAlt`, `unavailableContent`,
  `imageClassName`, `onPreviewError`, `replaceAriaLabel`, and `clearAriaLabel`
  to `ImageInputProps`. `AvatarInput` forwards every new prop unchanged.
- Preview sources resolve in this priority order: `value`, `fallbackImage`,
  `defaultImage`. Candidate URLs are deduplicated so a failing primary URL is
  never retried through multiple stages. When every candidate fails, the
  broken `<img>` is unmounted and `unavailableContent` (or a neutral default)
  is rendered in its place.
- `imageVersion` is appended safely to relative, absolute, queried, and
  fragmented URLs. `data:`, `blob:`, `javascript:`, and `file:` URLs are
  left unchanged.
- Expose `data-image-input-state="empty" | "preview" | "fallback" | "unavailable"`
  on the preview container for styling, testing, and consumer diagnostics.
- File selection is race-safe: stale `FileReader` completions cannot replace
  a newer value. Object URLs created by the component are tracked so
  consumer-owned blob URLs are never revoked.
- Replace and clear controls are real `<button>` elements, are reachable
  with the keyboard, and stay visible on touch and coarse-pointer devices.
  Only on `(hover: hover) and (pointer: fine)` desktops do the controls fall
  back to a hover/focus reveal. `focus-visible` always restores visibility.
- Use logical positioning (`end-*`) so the clear button works correctly in
  RTL layouts.
- Re-export `ImageInputPreviewSource` and `ImageInputPreviewError` from
  `najm-kit/components/inputs` and the package root.

## 2.1.48 - 2026-08-04

- Keep responsive card row actions visible on phone, tablet, and touch input,
  while retaining hover and keyboard-focus reveal on fine-pointer desktops.
- Size table and card loading skeletons from the measured body and active grid,
  and keep loading borders, radius, color, and shadow aligned with loaded
  surfaces.
- Add the exported `NTableCardPagination` and `NTableLoadMorePagination`
  contracts for paged, complete supplied-data, and explicit server-backed Load
  more card presentation, including guarded append/retry behavior and accessible
  loading, result, error, and terminal feedback.
