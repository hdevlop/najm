# Changelog

## 2.11.16 - 2026-09-04

- `NBrandingPayload` accepts a `slots` registry, so `NajmAppProvider` takes what
  `najm-theme`'s `loadServerBranding()` returned as `initialBranding` unchanged
  instead of renaming `sidebarLogoExpanded` and `sidebarLogoCollapsed` at the
  call site. Structural — the kit still does not depend on `najm-theme`.
  Precedence is explicit marks, then flat payload fields, then slots, and only
  the two sidebar keys are read: an auth logo, a hero, and a consumer's own
  slots stay out of the context the sidebar sees.

## 2.11.15 - 2026-09-04

- Fixed `ComboboxInput` keyboard interaction. Enter and Space now open its
  focusable trigger, and Enter commits the active filtered result instead of
  doing nothing when the previously active CmdK item was filtered out. Disabled
  comboboxes remain non-activatable.

## 2.11.14 - 2026-09-04

- Added `defineNajmPreferences` to `najm-kit/server`: the language, theme, and
  time-zone cookie contract every Najm application otherwise hand-writes across
  three route handlers and a root layout. `handlers.language`, `handlers.theme`,
  and `handlers.timeZone` export directly as Next.js `POST` handlers, and
  `resolve(cookieStore, { languageFallback })` seeds the root layout. Pure Web
  `Request`/`Response` and a structural cookie reader — no React, no Next import.
- Made it convention-first. A new application passes `{ i18n }` and nothing
  else: `light` default theme, `light | dark` the only accepted modes, `UTC`
  default zone, the canonical `TimeZoneInput` zones, `najm-ui-*` cookie names,
  and `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000` cookies are all
  defaults. Applications with published cookie names or another product default
  override only those keys. No consumer-side theme guard or normalizer.
- Fixed the time-zone contract having two sources of truth. `TimeZoneInput`'s
  values moved out of the component into `NAJM_TIME_ZONES`, a pure module now
  read by the input, the resolver, and the POST handler alike, so a zone the
  control offers can no longer be rejected by server validation. Applications
  that pass custom `items` pass the same values as `timeZones`.
- Exported `NAJM_TIME_ZONES`, `NAJM_DEFAULT_TIME_ZONE`, `NajmTimeZone`, and
  `NajmMode` from `najm-kit/server`, plus `NajmPreferenceLanguage<T>` and
  `NajmPreferenceTimeZone<T>` inferred from a configured definition, so
  consumers declare no language, theme, or time-zone alias of their own.
- Validated before normalizing in every handler: an unsupported value is a
  `400` with a generic message and no `Set-Cookie`, never the default silently
  written into a cookie. Malformed JSON, a non-object body, and a missing field
  answer the same way, and no request content reaches the response.

## 2.11.13 - 2026-09-04

- Fixed the documented `common.feedback.<field>` convention so all shared
  loading, empty, error, forbidden, and not-found states resolve localized
  labels without an application-owned `feedbackDefaults` key map. Missing
  convention keys still fall back to the packaged English labels.
- Forwarded Najm i18n's missing-key fallback and language-direction resolver
  through `NajmAppProvider`, keeping language changes reactive for partial
  catalogs and non-Arabic RTL languages.

## 2.11.10 - 2026-09-03

- Fixed the selected numbered `NTable` pagination button inheriting the regular
  foreground colour over its filled primary style. The active page now keeps
  the primary button foreground token, which is white in the light theme.
- Fixed focused invalid inputs combining a destructive border with the normal
  theme focus colour. `BaseInput` now keeps the visible keyboard-focus ring but
  colours it from the destructive token for both directly focused composite
  controls and wrappers whose child has `:focus-visible`.
- Made the desktop and mobile sidebar use logical inline edges, spacing, border
  utilities, chevrons, and drag direction so the complete rail behaves
  correctly in both LTR and RTL layouts.

## 2.11.9 - 2026-08-30

- Fixed card grids that paginate client-side rendering their entire dataset on
  one page. `useTable` pinned an uncontrolled paged card list to `data.length`,
  a branch that predates the container measurement added in 2.2.0 and was never
  reconciled with it: `calculatedCardPageSize` was measured and published, but
  only ever applied to a server-paginated grid. A 500-row list rendered 500
  cards on page one, reported a single page, and showed 500 as the current
  Rows/page value. The measured size is now applied to an uncontrolled card grid
  too, through the guards that already keep a server-paginated one stable —
  geometry bucketing, the per-container report budget, and the deferral until
  real cards have been measured. That loop is a property of the measurement
  rather than of fetching: page size decides which cards render, and rendered
  cards are what card height is measured from. Rendering every supplied row
  stays the behavior wherever there is nothing to measure against, so
  `dynamicHeight={false}` and a container that has not yet reported a layout are
  unchanged, and a controlled `pagination` prop or an explicit Rows/page choice
  still wins.

## 2.11.8 - 2026-08-28

- Fixed `NContextMenu` leaving keyboard focus on its opener after the menu
  appeared. The first enabled action now receives focus, disabled actions are
  skipped, Arrow Up/Down wrap, Home/End jump to the bounds, Tab dismisses the
  menu, and Escape restores focus to the opener. Focused actions also receive
  the same visual treatment as hovered actions.

## 2.11.7 - 2026-08-17

- Fixed date, combobox, and multiselect `FormInput` controls reaching the
  accessibility tree with no accessible name. These types render their trigger
  as a styled `div`, so the `<label for>` that `FormControl` wires up pointed at
  a non-labelable element and named nothing: screen readers announced an unnamed
  control, and `getByRole(..., { name })` could not resolve one. The form label
  now becomes the trigger's `aria-label`, and `DateInput` and `ComboboxInput`
  accept an explicit `ariaLabel` to override it. `select` keeps naming itself
  from `ariaLabel || placeholder`; renaming it would break consumers that select
  it by placeholder today.
- Fixed `DateInput` rendering its popover trigger as a `div`. Radix only merges
  trigger props onto the child, so the control had no role, no tab stop, and no
  keyboard activation — it was unreachable without a mouse. It is now a real
  `<button type="button">`, which also keeps it from submitting the surrounding
  form when the calendar opens.

## 2.11.6 - 2026-08-15

- Fixed `FormInput` dropping React Hook Form's native field binding for text,
  number, password, textarea, and time controls. These controls now forward
  their field name, composed blur handler, and focus ref to the actual native
  element, preserving browser form semantics, touched-state tracking, and
  programmatic focus without changing composite-control contracts.

## 2.11.5 - 2026-08-14

- Fixed numbered lists staying on an invalid final page after a deletion or
  another mutation reduced the server total. Paged lists now clamp before
  slicing their row buffer, render the previous valid page immediately, and
  reconcile the controlled pagination state without showing a false empty
  state. A genuinely empty result still remains on page one.
- Fixed panel feedback states stretching their icon, copy, and action across
  separate grid rows in tall table and dialog bodies. Panel content now stays
  together in one centered vertical stack with consistent spacing.

## 2.11.4 - 2026-08-12

- Fixed server-paginated card grids briefly rendering at a placeholder-derived
  page size before correcting to the real card height. Card mode now waits for
  real rows and publishes the measured fit before their first paint; fixed-row
  table sizing remains immediate during loading.

## 2.11.3 - 2026-08-12

- Fixed `NTable` replacing or clipping an explicit Rows/page choice when
  `dynamicHeight` was enabled. Automatic fit sizing still owns the initial page
  size; after the reader chooses a value, the table preserves it and scrolls
  its bounded body when the requested rows exceed the measured fit.

## 2.11.2 - 2026-08-11

- Fixed `PasswordInput` forwarding native input attributes such as generated
  form IDs and ARIA metadata to the actual `<input>`, restoring programmatic
  label association for assistive technology and browser automation.

## 2.11.1 - 2026-08-11

- Fixed `NajmThemeProvider` precedence so an explicit runtime `mode` overrides
  a preset stored in the design config. An explicit `preset` prop still wins,
  allowing deliberately fixed-preset subtrees without producing mixed light
  and dark application surfaces.

## 2.11.0 - 2026-08-10

- Gave every keyboard-focusable primitive a visible focus ring, from one shared
  source: `focusRingClasses` and `focusRingWithinClasses`, exported from the
  root barrel so consumers stop hand-rolling app-level focus CSS. `TabsContent`
  is keyboard-focusable (Radix sets `tabIndex={0}`) and previously showed no
  indicator at all; `CollapsibleTrigger` now carries its own ring rather than
  relying on whatever it wraps. `BaseInput` paints the ring on the wrapper via
  `has-[:focus-visible]:`, which is what finally gives `NumberInput` and the
  multi-select trigger an indicator — both suppress the inner control's ring,
  so focusing the child element used to change only the border colour.
- Fixed `Dialog` focus restoration. The opener is captured in
  `onOpenAutoFocus` and refocused on close when focus would otherwise land on
  `<body>`, so dismissing a dialog with Escape returns the keyboard to the
  control that opened it (WCAG 2.4.3) instead of stranding it at the top of
  the document. A caller that calls `preventDefault()` on the close event still
  owns focus entirely.
- Added `NCredentialsCard`, a one-time handover surface for freshly generated
  secrets. Renders a description list of fields with monospaced, break-all
  values, an optional header icon that defaults to a check mark, an optional
  consumer `actions` slot, and a built-in Copy button. The Copy action resolves
  text through `copyText` when supplied or joins `${label}: ${value}` with
  `\n` in field order otherwise. The button is disabled while a clipboard
  write is pending; on success it swaps to a check icon and `copiedLabel`,
  on failure to a warning icon and `copyErrorLabel`, and either state reverts
  to idle after roughly two seconds. Header and field icons are marked
  decorative, status is announced through a polite `aria-live` region, and
  the Copy button renders before consumer actions so a Done-style dismiss
  stays the last tab stop. The component never rethrows: a missing
  `navigator.clipboard`, a rejected or synchronously thrown `writeText`, and
  a synchronously thrown `copyText` all land in the error state with
  `onCopyError` invoked. State updates and revert timers are guarded so
  unmounting during a pending copy, or starting a second copy while the
  first success state is still showing, never fire stale setters. Logical
  spacing properties keep the layout correct under `dir="rtl"` without a
  consumer override, and each value carries `dir="auto"` so it resolves its own
  text direction: credentials are weak-directionality strings, and inheriting an
  ambient `rtl` paints `+1 555 0100` as `0100 555 1+` and `p@ssw0rd!` as
  `!p@ssw0rd` while the DOM and the copied text stay correct. A genuinely Arabic
  value still renders right-to-left. Packaged English fallbacks ship for the three action
  labels only; every field label, title, and description is the consumer's
  text. Exported as `NCredentialsCard`, `NCredentialField`,
  `NCredentialsCardProps`, and `NCredentialsCardClassNames` from the root
  barrel and from `packages/najm-kit/src/components/data-display`.
- Added a shared `surface` contract across `NLoadingState`, `NErrorState`, and
  `NEmptyState`. `inline` (default) preserves existing behavior; `panel` adds a
  centered minimum-height frame for table, card, dialog, and sheet bodies
  without a page gutter or a landmark; `page` uses the configured page
  spacing through `NPageLayout as="div"` so it never introduces a nested
  `<main>`. `NLoadingState.fullScreen` keeps precedence over `surface`.
- Added `NForbiddenState` and `NNotFoundState` as first-class generic Kit
  components. Both default to the page surface, ship token-backed default
  icons (`ShieldOff`, `Compass`), and resolve title and description through
  the new provider defaults. Neither knows the dashboard URL, renders a Next
  `Link`, redirects, or writes route metadata.
- Added `feedbackDefaults` to `NajmUIProvider`. It is inherited by
  `NajmNextUIProvider` and `NajmAppProvider` through TypeScript — no second
  adapter prop or translation source. Labels resolve through the existing
  structural `t` (most specific: explicit prop > literal default > translated
  key > packaged English). Generic error body copy and empty description
  deliberately have no packaged fallback so the no-provider render is
  unchanged.
- Exported the new feedback components and props (`NLoadingStateProps`,
  `NErrorStateProps`, `NEmptyStateProps`, `NForbiddenStateProps`,
  `NNotFoundStateProps`, `NFeedbackSurface`, `NFeedbackDefaults`,
  `NFeedbackLabels`, `NFeedbackLabelKeys`, `NFeedbackIconSize`) from the root
  barrel and re-exported them directly from `najm-kit/app` so a Next Server
  Component route can render them without authoring a local `"use client"`
  wrapper. The root entry stays free of `"use client"` and continues to
  share a single `NFeedbackDefaultsContext` across `index` and the adapters.

## 2.10.0 - 2026-08-10

- Added a shared, failure-aware media source chain for `NAvatar`, `NImage`, and
  the new Next-only `NNextImage` export. Sources reset cleanly when inputs or
  cache versions change, duplicate candidates are tried once, consumer event
  handlers are preserved, and failed avatars return to initials without a
  broken-image glyph.
- `NAvatar` now uses a native lazy-loaded image so loading and error events are
  observable, keeps initials visible until the image paints, supports native
  `imageProps`, and actually tries `fallbackSrc` after a primary failure.
- Added provider-level status badge defaults and the public
  `normalizeStatusToken` helper. Applications can configure translated status
  labels, colors, icons, look, shape, and size once while explicit badge props
  retain precedence.
- Added `NNextImage` and `NNextImageProps` to `najm-kit/next` only, preserving
  Next Image `fill`, `sizes`, optimizer, and `unoptimized` controls without
  adding Next.js to the root runtime graph.

## 2.9.0 - 2026-08-09

- Added `najm-kit/server`, a pure UI bootstrap loader. `createUiBootstrapLoader()`
  takes the application's own fetcher, endpoint paths, payload parsers, and
  factory values, then runs the resources concurrently, unwraps the `{ data }`
  envelope (or one the application selects), and falls back per resource so a
  branding outage never discards a valid appearance. Failures are reported
  through an optional structured `onDiagnostic` callback carrying resource,
  reason, path, and status — never a response body, header, cookie, or raw
  thrown value. A `fallback()` that throws stays a visible error. The entry
  imports no React, no Next.js, and no Node built-in, and re-exports
  `parseNajmDesignConfig` so an appearance payload can be parsed without
  reaching the root barrel.
- Added `najm-kit/server/react`, the React Server Component adapter.
  `createReactServerUiBootstrap()` memoizes one bootstrap per request with
  React's `cache()` and derives the per-resource accessors from it, so a root
  layout, a nested layout, and a page share one resolution and one stable
  snapshot for the whole render. Resolution is request-scoped only: separate
  requests share no snapshot, failure, or diagnostic, and a transient outage is
  retried on the next request. The `browser` export condition resolves to a
  module that throws, so importing the adapter from a Client Component fails at
  build time instead of shipping the application's fetcher and factory values
  into a browser bundle.
- The root `najm-kit`, `najm-kit/next`, and `najm-kit/app` entries are unchanged
  and do not reach either server entry.

## 2.8.2 - 2026-08-08

- Added the framework-neutral `najm-kit/person-images` subpath. It ships a
  built-in resolver for `child`, `adult`, `parent`, and `family` roles with
  the seven WebP illustrations embedded as base64 data URLs, plus
  `createPersonImageResolver` so an application can declare its own role
  names (`teacher`, `student`, `doctor`, `driver`, …) and TypeScript catches
  unknown role strings at the call site. The root `najm-kit` entry stays
  unchanged and does not pull in the person images.

## 2.8.1 - 2026-08-08

- Added schema-driven form development tools to `NajmAppProvider`. Passing
  `formDevTools` enables F8 filling for every `NForm` and `WizardForm` without
  an application helper or additional provider.
- Added built-in Zod 4 form-value generation with per-form overrides for
  relation fields and other application-owned values. Existing explicit
  `devTools.enabled` and `devTools.fill` usage remains supported.

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
