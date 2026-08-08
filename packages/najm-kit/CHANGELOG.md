# Changelog

## 2.8.0 - 2026-08-08

- Added server-safe `najm-kit/format` helpers for currency minor units,
  numbers, percentages, dates, times, relative time, tokens, local date inputs,
  and slugs. Client applications can use the same contract reactively through
  `NajmFormatProvider` and `useNajmFormat`.
- Added the server-safe `najm-kit/pagination` offset protocol, including bounded
  page creation, total-aware continuation, probe-row continuation for APIs
  without totals, and query cleanup that preserves meaningful `false` and `0`.
- Added the optional-peer `najm-kit/query` entry with offset infinite-query and
  responsive paged/card-list hooks, plus shared card-pagination adapters and
  localized continuation labels.
- Extended `NajmAppProvider` with formatting locale, currency, and placeholder
  configuration so applications can bind language, time zone, and formatting
  without another host bridge provider.
- Added shared media-query/card-viewport helpers and avatar-source utilities.

## 2.6.2

- Added `NSidebarProvider` and `useNSidebar`, so sidebar state can be read from a distance. `NSidebar` renders beside the page content rather than around it, which left applications hand-rolling a context to hand `setMobileOpen` down to a page header — a wrapper component plus an aliased import at every call site. Wrap the shell in `NSidebarProvider` and `NPageHeader` now resolves both `onSidebarOpen` and `mobileBreakpoint` from it, so a header nested anywhere below renders a working mobile trigger with no props threaded to it. Also exports the `NSidebarContextValue` type.
- `NSidebar` resolves its open and collapsed state as explicit prop → surrounding provider → internal state. Passing `collapsed`, `mobileOpen`, `onCollapsedChange`, or `onMobileOpenChange` keeps behaving exactly as before, and a sidebar with no provider around it still owns its own state, so this is additive for every existing consumer.
- `logo` accepts a render prop, `({ collapsed, isMobile }) => ReactNode`, alongside the existing node. It receives the state the sidebar actually resolved — including whatever `autoCollapseAt` decided — which consumers previously had to approximate with their own responsive classes, guessing at a breakpoint the sidebar had already computed. The mobile drawer always reports `collapsed: false`, matching how it renders. Exported as `SidebarLogoRender`.

## 2.6.1

- Fixed the non-card `NPageHeader` bleed never taking effect. 2.6.0 cancelled the page padding with the Tailwind utilities `-mt-[var(--najm-section-gap,0px)]` and `-mx-[var(--najm-page-gutter,0px)]`, which only work if the consuming app's Tailwind build happens to emit those arbitrary classes — they exist nowhere but inside this package's bundle, so a consumer could load a stylesheet without them and the header stayed exactly where it was. The offsets are inline styles now and no longer depend on the consumer's CSS pipeline.

## 2.6.0

- Added `NThemePresets`, and wired it into `NThemeCustomizer` through `presets`, `selectedPresetId`, `presetsStatus`, `savedDesign`, `onPresetSelect`, `onPresetSave`, `onPresetDelete`, and `presetLabels`. The picker renders only when a host supplies both `presets` and `onPresetSelect`. It is presentational: the host owns where presets live and what saving one means, and selecting a row hands the design back so it can be previewed before anything is stored. Each row draws a swatch strip from the design's own `sidebar`, `primary`, `secondary`, `accent`, and `background` tokens; the selected row's check sits left in the success colour and per-row delete sits right. Omit `onPresetSave` or `onPresetDelete` to hide those controls. Deleting is pointer-only — Radix owns roving focus inside the listbox.
- **`NPageHeader` in non-card mode is now flush.** It rendered as a full-bleed bar (`border-b`, no radius) but still sat inside the padding `NPageLayout` applies, so it floated below and inside the page gutter and its bottom rule never met the sidebar header's. It now cancels that padding, and its base height goes `min-h-12` → `min-h-14` to match `NSidebarHeader`. **Non-card page headers move up and out to the page edges, and grow 8px below `sm`.** Card mode is unchanged.
- `NPageLayout` publishes its resolved spacing as `--najm-page-gutter` and `--najm-section-gap`. Descendants could not previously cancel the page padding: a design config resolves the gutter to a literal, so the pre-existing `--page-gutter` / `--section-gap` variables only ever held the fallbacks. Full-bleed children should negate these, with `0px` fallbacks so they stay inert outside `NPageLayout`.
- Fixed `SelectInput` discarding `SelectItemType.icon`. The prop was declared but `renderItems` rendered the label alone, so every per-item icon was silently dropped. Items with an icon now render it before a truncating label; items without one are unchanged.

## 2.5.0

- Added `NTableDefaultsProvider`, so an application supplies `paginationLabels` once instead of at every table. Labels merge per key, most specific first: a table's own `paginationLabels` override the provider's for the keys it sets, the provider covers the rest, and anything neither supplies falls back to the packaged English. Also exports `useNTableDefaults` and the `NTableDefaults` type.
- `value` is passed through the provider unmemoized; memoize it in the caller, or every table below re-renders with the shell.

## 2.4.0

- `NTablePagination` renders numbered page buttons instead of `Page X of Y`. The window shows the first and last page, the current page, and one page either side, collapsing the rest into at most two gaps. The slot count is constant for any result longer than the window, so the bar does not change width as the reader pages through it, and a gap never stands in for a single page — that slot goes to the page instead.
- Added `paginationVariant`, defaulting to `"numbered"`. Pass `"compact"` to keep the previous position text with first/previous/next/last controls. **This changes the default appearance of every paginated `NTable`.**
- The numbered variant drops the first/last double chevrons, because page 1 and page N are now single-click targets of their own. Previous and next remain. The compact variant is unchanged.
- Numbered pages fall back to compact on their own when the page count is not trustworthy — that is, under `manualPagination` with no `pageCount` supplied, where TanStack infers a count from the rows it happens to hold rather than from a result total. Numbering that would invite clicks on pages that may not exist is not rendered.
- Below the `sm` breakpoint the numbers give way to the position text; seven page buttons plus the rows-per-page select do not fit a phone.
- Added `paginationLabels` so the bar can be localized: `rowsPerPage`, `pagination`, `goToPage`, `currentPage`, `firstPage`, `previousPage`, `nextPage`, `lastPage`, `pageOf`, and `rowsSelected`. All optional, all falling back to the previous English strings.
- Pagination chevrons now mirror under `dir="rtl"`. They previously pointed against the reading direction in right-to-left layouts.
- The page controls are wrapped in a labelled `nav`, and the current page carries `aria-current="page"`.
- Exported `buildPageItems` and `NTablePageItem` for consumers that need the same windowing outside the table.

## 2.2.1

- Fixed a regression in 2.2.0: the dynamic page size reported under `manualPagination` could oscillate. Card row height is measured from rendered cards, so it grows as images decode; feeding that back into the page size refetched, re-rendered, re-measured, and refetched again. A list visibly settled from one page size to another with the loading skeleton flashing twice. The report is now allowed once per container geometry, which does not depend on the rows inside it, so it terminates. A resize still re-arms it, and the debounce still waits for the measurement to settle before reporting.

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
