# Najm Kit reusable donut card plan

## Goal

Create one public `NDonutCard` component in `najm-kit`, publish it, and migrate
Kafil's four donut usages to that contract.

This replaces both current implementations:

- `SupportBudgetCard` in `SponsorOverview/components` (96 px donut, MAD
  formatting, empty state, optional footer).
- `DonutBreakdown` in `Dashboard/components/DashboardCharts.tsx` (144 px donut,
  caller formatter, optional center icon).

The component must also support the supplied horizontal design:

- donut and center total at the inline start (left in English/French);
- detailed legend at the inline end (right in English/French);
- each legend entry shows its marker and label, then its formatted value and
  optional percentage;
- it stacks cleanly on narrow screens and follows the document direction in
  RTL.

## Decision: do not add a chart library

Kafil does not currently use Recharts, Chart.js, Nivo, ECharts, or another chart
package. Its bar, line, pie, and donut charts are custom CSS/SVG. `najm-kit`
also has no chart dependency or existing donut primitive.

Adding a full chart library for one non-interactive donut would increase the
published UI package's dependency and peer-dependency surface without reducing
the Kafil migration. Keep the current lightweight `conic-gradient` technique,
but implement it once in `najm-kit`. A future migration of all line, bar, pie,
tooltip, and axis charts can evaluate a chart library as a separate slice.

## Public Najm Kit contract

Add the component under:

```text
packages/najm-kit/src/components/DonutCard/
  DonutCard.tsx
  index.ts
```

Use this public shape (names may only change if an existing Najm convention
requires it):

```ts
export type NDonutCardVariant = "compact" | "default" | "horizontal";

export interface NDonutCardItem {
  id: string;
  label: React.ReactNode;
  value: number;
  color: string;
}

export interface NDonutCardClassNames {
  root?: string;
  content?: string;
  ring?: string;
  center?: string;
  legend?: string;
  legendItem?: string;
  legendLabel?: string;
  legendValue?: string;
  empty?: string;
  footer?: string;
}

export interface NDonutCardProps {
  title: React.ReactNode;
  ariaLabel?: string;
  icon?: NIconSource;
  iconColor?: string;
  items: readonly NDonutCardItem[];
  valueFormatter: (value: number) => React.ReactNode;
  totalLabel?: React.ReactNode;
  centerIcon?: NIconSource;
  emptyLabel?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: NDonutCardVariant;
  percentageFormatter?: (ratio: number) => React.ReactNode;
  className?: string;
  classNames?: NDonutCardClassNames;
}
```

Contract rules:

- Compute the total inside the component. Do not accept a second `total` source
  that can drift from the item values.
- Normalize non-finite or negative item values to zero for ring geometry,
  totals, displayed item values, and percentages.
- Preserve zero-value items in the legend so categories do not disappear
  between loaded and empty states.
- `valueFormatter` keeps the component generic. Currency, compact numbers, and
  locale decisions remain with the consuming app.
- `percentageFormatter` receives a ratio from `0` to `1`. If omitted, hide
  percentages. This avoids hardcoded locale formatting in the library.
- `centerIcon`, when supplied, replaces the center total and label. Without it,
  render the formatted computed total and `totalLabel`.
- When the computed total is zero, render a full muted ring, never
  `conic-gradient()` with an empty stop list. Render `emptyLabel` when supplied.
- Use item `id`, not translated label text, as the React key.
- If `title` is a string, it can be the accessible name. Require callers with a
  non-string title to pass `ariaLabel`.
- The chart group owns the accessible name; the colored ring is decorative.
  The textual legend must expose every label and value, so meaning never depends
  on color alone.

## Variant specification

| Variant | Ring | Layout | Legend | Intended use |
| --- | ---: | --- | --- | --- |
| `compact` | 96 px, 72 px center | vertically stacked | tight label/value rows | narrow cards and dialogs |
| `default` | 144 px, 112 px center | vertically stacked | standard label/value rows | normal dashboard cards |
| `horizontal` | 128 px, 92-96 px center | ring at inline start, legend at inline end; stack below `sm` | label on first line, value and optional percentage on second line | supplied spending-breakdown design |

Implementation details:

- Build `NDonutCard` on the existing `NCard`; forward `title`, `icon`,
  `iconColor`, `className`, and root/content slot classes.
- Render the optional footer through `NCardFooter` so it stays at the bottom of
  equal-height grid cards.
- Use static Tailwind class maps for variants. Do not construct Tailwind class
  names dynamically.
- Use CSS custom properties only where pixel ring/center dimensions materially
  reduce duplicate markup. Keep colors as item-provided CSS color strings.
- Build the gradient in one pure helper using a running angle rather than
  repeatedly slicing and reducing the array.
- Add `data-slot` values for `donut-card`, `donut-ring`, `donut-center`,
  `donut-legend`, and `donut-legend-item`; use `data-variant` on the root. These
  give tests and consumers stable hooks without coupling them to class strings.
- Preserve `h-full` behavior through the caller's `className`, rather than
  forcing every card to fill its parent.

## Najm implementation steps

Work in `C:\Users\hdevlop\Desktop\najm`.

### 1. Implement and export

1. Add `DonutCard.tsx` and its local `index.ts`.
2. Export `NDonutCard` and the four public types from
   `packages/najm-kit/src/index.ts` in the Data Display section.
3. Do not add a new package subpath or change `package.json` exports:
   `NDonutCard` belongs on the existing root `najm-kit` surface.
4. Do not add global theme tokens unless the component cannot use existing
   `--muted`, `--card`, `--foreground`, `--muted-foreground`, and border tokens.
5. If any Tailwind class is generated dynamically, replace it with a static
   class map. Only update `src/theme.css` safelisting if a static map is
   genuinely impossible.

### 2. Add focused component tests

Create:

```text
packages/najm-kit/test/donut-card.test.tsx
```

Cover:

- root barrel exports `NDonutCard`;
- default variant calculates the total from positive items;
- gradient stop order and cumulative angles are correct;
- zero, negative, `NaN`, and infinite values are normalized safely;
- zero total produces one full muted ring and no invalid CSS;
- zero-value categories remain in the textual legend;
- compact, default, and horizontal variants expose the correct `data-variant`
  and layout/ring hooks;
- `centerIcon` replaces total text;
- `percentageFormatter` receives ratios and renders only when provided;
- `emptyLabel` is visible for zero totals;
- footer content renders through the card footer;
- custom root/slot classes are applied;
- the chart has an accessible name and the ring itself is decorative.

Add an explicit `NDonutCard` assertion to
`packages/najm-kit/test/barrel.test.ts`.

### 3. Document and visually verify

Add a dedicated playground docs page:

```text
packages/najm-kit/playground/src/docs/pages/DonutCardPage.tsx
```

Register it in:

- `packages/najm-kit/playground/src/docs/navigation.ts`
- `packages/najm-kit/playground/src/App.tsx`

The page must show:

1. `compact` with three currency segments and an empty-state toggle/example;
2. `default` with a center total;
3. `default` with a center icon;
4. `horizontal` matching the supplied reference: donut at the left, three
   detailed entries at the right, formatted value plus one-decimal percentage;
5. light and dark theme compatibility;
6. a narrow container proving the horizontal version stacks without overflow.

Use generic labels and values in Najm docs; do not embed Kafil-specific
translations or `formatMad` in the library.

### 4. Verify and publish Najm Kit

Run from the Najm repository root:

```bash
bun test packages/najm-kit/test/donut-card.test.tsx
bun run test:ui
bun run build:ui
bun run --cwd packages/najm-kit build:preview
bun scripts/publish-package.ts najm-kit --dry-run
```

Manually inspect all playground variants at desktop and narrow widths before
publishing. Confirm the built `dist/index.d.ts` exports the component and all
public types.

Publish the next available `najm-kit` patch only after those checks pass:

```bash
bun run pub:ui
```

Record the actual published version; do not assume `2.1.24` if another Najm Kit
release lands first.

## Kafil migration steps

Work in `C:\Users\hdevlop\Desktop\kafil` only after the new Najm Kit package is
published.

### 1. Upgrade the contract

1. Change `apps/web/package.json` from `najm-kit@2.1.23` to the exact published
   version.
2. Run `bun install` from the Kafil root.
3. Verify `NDonutCard` and its types exist in the installed
   `node_modules/najm-kit/dist/index.d.ts` before editing call sites.

### 2. Replace all four usages

Use stable untranslated item IDs such as `available`, `reserved`, and `spent`.
Keep translated strings in `label`.

| Call site | Najm variant | Formatter | Other behavior |
| --- | --- | --- | --- |
| Sponsor dashboard | `compact` | existing `formatMad` closure | preserve empty label and “view all budgets” footer |
| Operator sponsor overview dialog | `compact` | existing `formatMad` closure | preserve empty label; no footer |
| Operator dashboard | `default` | existing `money` formatter | preserve total label and current colors |
| Family dashboard | `horizontal` | existing `money` formatter | use a locale-aware one-decimal percentage formatter and match the supplied left-donut/right-values design |

For the family horizontal card, create the percentage formatter in the page
using the current language:

```ts
const percentage = new Intl.NumberFormat(locale, {
  style: "percent",
  maximumFractionDigits: 1,
});
```

Pass `(ratio) => percentage.format(ratio)` to `percentageFormatter`. Reuse the
same locale mapping already used by Kafil format helpers; do not hardcode
English percentage output.

### 3. Delete superseded app code

After all call sites import `NDonutCard` directly from `najm-kit`:

- delete
  `apps/web/src/features/SponsorOverview/components/SupportBudgetCard.tsx`;
- remove its export from `apps/web/src/features/SponsorOverview/index.ts`;
- delete the `DonutBreakdown` function and `getDonutBackground` helper from
  `apps/web/src/features/Dashboard/components/DashboardCharts.tsx`;
- remove `BudgetSegment` from
  `apps/web/src/features/SponsorOverview/types.ts` if no longer referenced;
- remove the derived `budgetTotal` property from both sponsor overview view
  model types/builders and stop passing it to the UI, because `NDonutCard`
  computes its own total;
- keep the other bar, line, pie, and status components in
  `DashboardCharts.tsx` unchanged.

Do not keep compatibility wrappers with the old component names. Four direct
Najm Kit usages make the shared ownership clear and prevent the duplicates from
returning.

### 4. Update Kafil tests

Update `apps/web/test/sponsor-overview-reuse.test.ts`:

- expect sponsor and operator overview sources to import `NDonutCard` from
  `najm-kit`;
- remove the expectation that `SupportBudgetCard` exists in SponsorOverview;
- keep the no-hardcoded-sponsor-route checks for the remaining shared cards.

Update `apps/web/test/phase7-dashboard-feature.test.ts`:

- assert operator and family dashboards use `NDonutCard`;
- assert `DashboardCharts.tsx` no longer contains `DonutBreakdown` or
  `getDonutBackground`;
- assert the family usage selects `horizontal` and supplies
  `percentageFormatter`.

Add a small view-model assertion, or update the closest existing sponsor tests,
to prove each budget item list still sums to the previous displayed total after
`budgetTotal` is removed.

## Kafil visual acceptance

Verify in English, French, and Arabic:

- sponsor dashboard: compact 96 px visual parity, empty label, footer, and no
  overflow in its `xlSpan={3}` grid item;
- sponsor overview dialog: compact visual parity and no dialog overflow;
- operator dashboard: default 144 px visual parity in its narrow
  `xlSpan={2}` item;
- family dashboard: horizontal layout shows the donut/total at inline start and
  detailed labels, values, and percentages at inline end; it stacks on mobile;
- all legends remain readable with long translated labels;
- zero totals show a muted ring, formatted zero in the center, and the requested
  empty message only where one is provided;
- light/dark colors come from existing theme tokens and segment colors;
- focus, reading order, and RTL layout remain logical.

Capture before/after screenshots for the four call sites and attach them to the
implementation evidence.

## Final Kafil verification gate

Run from the Kafil root:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:generate
```

`db:generate` should report no schema change. If it creates a migration, stop
and investigate because this slice is presentation-only.

## Done checklist

- [ ] `NDonutCard` exists in `najm-kit` with compact, default, and horizontal
      variants.
- [ ] The horizontal variant matches the supplied donut-left/details-right
      reference and is responsive.
- [ ] No chart library was added.
- [ ] Najm focused tests, full UI tests, UI build, preview build, and publish
      dry-run pass.
- [ ] The published Najm Kit declaration exposes the component and types.
- [ ] Kafil consumes the exact published Najm Kit version.
- [ ] All four Kafil call sites use `NDonutCard` directly.
- [ ] `SupportBudgetCard`, the old `DonutBreakdown`, and its gradient helper are
      removed.
- [ ] Duplicate sponsor `budgetTotal` view-model fields are removed.
- [ ] Kafil tests and the full verification gate pass.
- [ ] English, French, Arabic, mobile, desktop, light, dark, and zero-data
      visuals are checked.
