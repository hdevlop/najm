# NTable Responsive Column Visibility Plan

Status: implemented; remaining visual interaction checks pending

## Goal

Add a typed `NTable` column contract that can:

1. structurally exclude a column based on an app-owned capability decision;
2. hide the same included table header and body cells below a Tailwind
   breakpoint.

The first consumer is Kafil's Families table:

```tsx
{
  accessorKey: "email",
  header: "Email",
  meta: {
    visible: can("families.email.read"),
    hiddenBelow: "lg",
  },
}
```

This means:

- a user without `families.email.read` receives no Email table column;
- below `lg`, the Email header and every Email body cell are hidden;
- at `lg` and above, they render as table cells;
- cards and JSON view are unchanged;
- no application-level `matchMedia` hook or `nth-child` selector is needed.

`NTable` must not import an authentication package, read a session, or
interpret role names. The application converts its current role/capabilities
to the generic `visible` boolean.

## Scope

Work in:

```text
C:\Users\hdevlop\Desktop\najm\packages\najm-kit
```

Primary files:

```text
src/components/table/NTable.tsx
src/components/table/NTableContent.tsx
src/components/table/NTableLoadingSkeleton.tsx
src/components/table/index.ts
src/index.ts
src/theme.css
test/table/responsive-columns.test.tsx
test/barrel.test.ts
README.md
```

Adding a small helper such as this is encouraged:

```text
src/components/table/responsiveColumns.ts
```

Out of scope:

- modifying Kafil in this package task;
- changing the existing mobile `responsiveCards` behavior;
- changing Tailwind breakpoints;
- using JavaScript viewport detection for column visibility;
- importing `najm-auth` or coupling `NTable` to named roles;
- automatically choosing which columns to hide;
- redesigning the column settings menu;
- publishing or version-bumping without owner approval;
- changing unrelated Theme Customizer work already present in the worktree.

## Current Verified Baseline

- Package version is `najm-kit@2.1.35`.
- `NTableProps.columns` currently accepts TanStack `ColumnDef[]`.
- `NTableContent` renders all TanStack-visible headers and cells with fixed
  classes; it does not apply responsive metadata.
- `NTableLoadingSkeleton` independently renders the raw columns and must be
  updated to match the loaded table.
- TanStack `columnVisibility` is internal state used by the optional column
  settings menu.
- `responsiveCards` only switches table mode to card mode below `640px`; it is
  a separate concern from responsive table columns.
- `NajmResponsiveBreakpoint` already defines:
  `"base" | "sm" | "md" | "lg" | "xl" | "2xl"`.
- Najm Kit uses Tailwind v4 and consumers compile `najm-kit/theme.css`.

## Public API Decision

Export the following public types:

```ts
export type NTableColumnBreakpoint =
  Exclude<NajmResponsiveBreakpoint, "base">;

export interface NTableColumnMeta {
  /**
   * Whether this column is eligible to exist in NTable.
   * Defaults to true. Set from the application's role/capability decision.
   */
  visible?: boolean;

  /**
   * Hide this table column below the selected Tailwind breakpoint.
   * The column remains visible at that breakpoint and above.
   * Applies to table view only.
   */
  hiddenBelow?: NTableColumnBreakpoint;
}

export type NTableColumnDef<TData, TValue = any> =
  ColumnDef<TData, TValue> & {
    meta?: ColumnDef<TData, TValue>["meta"] & NTableColumnMeta;
  };
```

Then change the `NTableProps` column field to:

```ts
columns: NTableColumnDef<T, any>[];
```

Requirements:

- Existing `ColumnDef<T>[]` arrays must remain assignable to `columns`.
- Consumers using `NTableProps<T>["columns"]` receive autocomplete and
  validation for `meta.visible` and `meta.hiddenBelow`.
- Consumers can explicitly import `NTableColumnDef` when declaring a reusable
  columns array.
- Do not globally augment TanStack's `ColumnMeta`; a Najm-specific column type
  keeps the contract local and avoids collisions with consumer metadata.
- Preserve the existing runtime `meta.editable` and `meta.editor` handling.
  Do not remove or reinterpret unrelated metadata.

Export `NTableColumnBreakpoint`, `NTableColumnMeta`, and `NTableColumnDef` from:

```text
src/components/table/index.ts
src/index.ts
```

## Capability-Gating Contract

`meta.visible` is an eligibility gate:

- omitted or `true`: include the column normally;
- `false`: remove the column before passing columns to TanStack Table;
- excluded columns must not render headers, body cells, loading cells, column
  settings entries, or sorting controls;
- excluded grouped columns must not leave empty group headers;
- changing the capability result must update the effective columns without
  mutating the caller's array.

Use one pure helper for the effective-column calculation. It must:

1. avoid mutating the caller's column definitions;
2. remove a leaf column when `meta.visible === false`;
3. recursively filter `columns` for grouped definitions;
4. remove a group when its own `meta.visible === false`;
5. remove a group when no eligible child columns remain;
6. preserve all other TanStack column properties and metadata.

Do not implement a `roles: [...]` metadata field. Role names and permission
models belong to the application. Example:

```tsx
const canReadFamilyEmail = can("families.email.read");

const columns = useMemo<NTableColumnDef<Family>[]>(
  () => [
    {
      accessorKey: "email",
      header: "Email",
      meta: {
        visible: canReadFamilyEmail,
        hiddenBelow: "lg",
      },
    },
  ],
  [canReadFamilyEmail],
);
```

### Security boundary

Column gating is presentation behavior, not authorization:

- the backend must enforce the permission;
- fields a role may not receive must be omitted or privacy-projected in the
  response;
- `visible: false` does not remove a property from the row object already sent
  to the browser;
- cards, JSON/custom renderers, logs, exports, and detail views must enforce
  their own matching projection/gate.

Never claim that hiding a column protects sensitive data.

## Responsive Behavior Contract

Use a literal class map:

```ts
const hiddenBelowClasses = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} satisfies Record<NTableColumnBreakpoint, string>;
```

Do not construct Tailwind class names with template strings.

For a leaf column with `meta.hiddenBelow`:

1. apply the resolved class to its `<TableHead>`;
2. apply the identical class to every corresponding `<TableCell>`;
3. apply the identical class to loading-skeleton header and body cells;
4. merge it through `cn(...)` with existing fixed classes;
5. restore it with `table-cell`, not `block` or `flex`.

Keep the implementation CSS-only. This avoids hydration changes, resize state,
and duplicate breakpoint logic.

### Interaction with TanStack column visibility

Responsive visibility is a layout policy and TanStack visibility remains a
user preference:

- `meta.visible === false` means the column is ineligible and is removed before
  TanStack visibility state is applied;
- if TanStack hides a column, the header and cells are not rendered;
- if TanStack shows it, `hiddenBelow` still controls its viewport visibility;
- the column settings menu may continue to report the column as selected while
  CSS hides it below the configured breakpoint;
- sorting, filters, row selection, pagination, and expansion must not be reset
  when the viewport changes.

Do not add viewport state to `NTableState` and do not mutate
`columnVisibility` in response to a media query.

### View-mode boundaries

- Table view: apply both `visible` and `hiddenBelow`.
- Table loading skeleton: apply both `visible` and `hiddenBelow`.
- Column settings: omit columns with `visible: false`.
- Card view: ignore both metadata fields; `renderCard` owns card content and
  capability gating.
- JSON view: ignore both fields; the caller owns its value and security.
- Custom modes: ignore both fields.

### Grouped columns

The required contract is for ordinary leaf data columns. Do not redesign
TanStack grouped-header layout in this slice. If grouped headers are already
covered naturally, preserve them; otherwise document `hiddenBelow` as a leaf
column option and add a follow-up note instead of expanding scope.

## Implementation Plan

### 1. Add typed column metadata

- [x] Import and reuse `NajmResponsiveBreakpoint`.
- [x] Define the three public types from the API decision above.
- [x] Change `NTableProps.columns` to `NTableColumnDef<T, any>[]`.
- [x] Keep plain TanStack `ColumnDef[]` backward compatible.
- [x] Export the new types through both table and package barrels.
- [x] Type `meta.visible` as an optional boolean defaulting to inclusion.

### 2. Structurally filter capability-gated columns

- [x] Add a pure helper that produces effective columns without mutating input.
- [x] Filter `meta.visible === false` leaf columns.
- [x] Recursively filter grouped columns and remove empty groups.
- [x] Use the effective columns in `useTable()` before appending internal
      action columns.
- [x] Use the same effective columns in the loading skeleton.
- [x] Ensure capability changes cause TanStack and skeleton output to update.
- [x] Ensure excluded columns never appear in the column settings menu.
- [x] Keep the helper independent of Najm Auth, sessions, roles, and React
      context.

### 3. Centralize responsive class resolution

- [x] Add one literal breakpoint-to-class mapping.
- [x] Add a small resolver that returns `undefined` when `hiddenBelow` is
      absent.
- [x] Reuse the resolver in loaded table and loading skeleton code.
- [x] Do not duplicate class maps across components.
- [x] Do not use dynamic Tailwind strings.

### 4. Apply classes to loaded table markup

- [x] Read metadata from `header.column.columnDef.meta`.
- [x] Merge the class into the matching `<TableHead>`.
- [x] Read metadata from `cell.column.columnDef.meta`.
- [x] Merge the class into the matching `<TableCell>`.
- [x] Ensure the header and all body cells use the same breakpoint.
- [x] Preserve header color styles, sorting click targets, editable cells,
      row actions, checkboxes, and expansion controls.
- [x] Do not apply responsive metadata to the built-in checkbox, expansion, or
      action columns unless those internal columns explicitly opt in later.

### 5. Keep loading markup visually consistent

- [x] Resolve metadata for each raw loading-skeleton column.
- [x] Apply the responsive class to skeleton headers.
- [x] Apply it to all matching skeleton body cells.
- [x] Preserve explicit column widths and existing loading semantics.

### 6. Guarantee Tailwind v4 class discovery

- [x] Confirm the literal class map is present in the built `dist/index.mjs`.
- [x] Ensure the consumer build emits `hidden`, `sm:table-cell`,
      `md:table-cell`, `lg:table-cell`, `xl:table-cell`, and
      `2xl:table-cell`.
- [x] If source scanning alone is not sufficient, add an explicit static
      `@source inline(...)` entry to `src/theme.css`.
- [x] Do not rely on consumer-side safelists.

### 7. Add focused tests

Create:

```text
test/table/responsive-columns.test.tsx
```

Cover:

- [x] omitted `visible` and `visible: true` include the column;
- [x] `visible: false` removes its header and every corresponding body cell;
- [x] `visible: false` removes the column from loading markup;
- [x] `visible: false` removes the column from the settings menu;
- [x] a capability change followed by rerender updates the effective columns;
- [x] grouped columns are recursively filtered and empty groups are removed;
- [x] input column definitions are not mutated;
- [x] a column without metadata has no responsive hiding classes;
- [x] `hiddenBelow: "lg"` adds `hidden lg:table-cell` to its header;
- [x] the same classes appear on every corresponding body cell;
- [x] all supported values (`sm`, `md`, `lg`, `xl`, `2xl`) resolve to the
      expected literal classes;
- [x] loading skeleton headers and cells receive the same classes;
- [x] a different column remains unaffected;
- [x] cards do not consume or suppress fields based on this metadata;
- [x] existing column visibility still removes a column normally;
- [x] invalid breakpoint values and non-boolean `visible` values fail
      TypeScript validation with `@ts-expect-error`;
- [x] the public barrel exports the three new types.

Happy DOM does not need to evaluate media queries for these tests. Assert the
rendered classes; real responsive behavior belongs in the playground/browser
check.

### 8. Document the consumer contract

Add a concise `NTable` example to `README.md`:

```tsx
import {
  NTable,
  type NTableColumnDef,
} from "najm-kit";

const columns: NTableColumnDef<Family>[] = [
  {
    accessorKey: "name",
    header: "Family account",
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: {
      visible: can("families.email.read"),
      hiddenBelow: "lg",
    },
  },
];
```

Document:

- `visible` is app-owned eligibility, not an NTable role system;
- omitted `visible` defaults to inclusion;
- the mobile-first meaning of `hiddenBelow`;
- accepted breakpoints;
- table-only behavior;
- independence from the manual column visibility menu;
- cards must be controlled through `renderCard`;
- frontend gating does not replace backend authorization/privacy projection.

### 9. Perform visual verification

Use the Najm Kit playground or a minimal package-local table example.

- [x] At `1023px`, the `lg` column header and all corresponding cells are
      absent visually.
- [x] At `1024px`, the column appears and aligns correctly.
- [x] With `visible: false`, the column is absent at every width and from the
      settings menu.
- [ ] Resize across the boundary without React warnings or state resets.
- [ ] Verify sorting before and after resize.
- [ ] Verify loading markup does not show the hidden column.
- [ ] Verify card view is unchanged.
- [ ] Check horizontal scrolling with several responsive columns.

The playground now includes a dedicated Responsive columns example with an
app-owned Email capability toggle and `lg`-hidden columns. Automated DOM tests
verify the class contract, loading output, settings behavior, and card boundary;
an actual browser pass at the exact viewport widths was performed on
2026-07-26 using headless Chrome:

- `1023px`: Email header `display: none`; all 5 Email cells `display: none`.
- `1024px`: Email header `display: table-cell`; all 5 Email cells
  `display: table-cell`.
- capability toggled off: 0 Email headers and 0 Email body cells remained.

Sorting/state-reset, loading-state visual inspection, card visual inspection,
and horizontal-scroll interaction remain unchecked rather than inferred from
the DOM/unit coverage.

Record the tested viewport widths and outcome in the final implementation
handoff.

## Verification Commands

Run from:

```text
C:\Users\hdevlop\Desktop\najm
```

Focused test:

```bash
bun run --cwd packages/najm-kit test test/table/responsive-columns.test.tsx
```

Package type checks:

```bash
bun run --cwd packages/najm-kit lint
```

Full Najm Kit tests:

```bash
bun run test:ui
```

Published-output build:

```bash
bun run build:ui
```

After the build, verify declarations and runtime output:

```bash
rg "NTableColumnDef|NTableColumnMeta|hiddenBelow" packages/najm-kit/dist/index.d.ts
rg "hidden lg:table-cell" packages/najm-kit/dist/index.mjs
```

Optional playground production build after the browser check:

```bash
bun run --cwd packages/najm-kit build:preview
```

Do not claim the package is release-ready unless all applicable commands pass.

Latest verification on 2026-07-26:

- focused responsive-column suite: 27 passed, 0 failed;
- package source and test typechecks: passed;
- full Najm Kit suite: 612 passed, 0 failed;
- published-output build: passed;
- playground production build: passed;
- built declarations contain the public responsive-column types;
- built runtime contains the literal `hidden lg:table-cell` class.

## Acceptance Criteria

- [x] The exact Kafil usage
      `meta: { visible: canReadFamilyEmail, hiddenBelow: "lg" }` type-checks.
- [x] `visible: false` structurally removes the column from table, loading, and
      settings output.
- [x] The filtering helper supports grouped columns without mutation.
- [x] Header, loaded cells, and loading cells share the same responsive class.
- [x] No JavaScript viewport listener is added for column visibility.
- [x] Existing callers without metadata behave exactly as before.
- [x] Existing `ColumnDef[]` callers remain source compatible.
- [x] Cards and JSON output remain unchanged.
- [x] Najm Kit has no dependency on application roles or Najm Auth.
- [x] Documentation explicitly preserves the backend authorization boundary.
- [x] User-controlled column visibility still works.
- [x] Tailwind classes are available to package consumers without app-specific
      safelists.
- [x] New public types appear in built declarations.
- [x] Focused tests, package lint/type checks, full package tests, and package
      build pass.
- [x] Browser checks at `1023px` and `1024px` are recorded.
- [x] No unrelated dirty-worktree changes are modified.

## Release and Kafil Handoff

Publishing is a separate approval gate.

After the owner approves a Najm Kit release:

1. publish the new `najm-kit` version using the repository's normal package
   release workflow;
2. update Kafil to the released version;
3. add only this metadata to the Families email column:

   ```tsx
   meta: {
     visible: can("families.email.read"),
     hiddenBelow: "lg",
   },
   ```

4. ensure the Families list endpoint applies the matching backend permission
   and privacy projection before returning Email;
5. apply the same capability decision in `FamilyCard` if Email is rendered
   there;
6. run Kafil's local verification gate;
7. verify the Families table at widths immediately below and above `lg`, for
   both an allowed and denied role.

Do not add application CSS selectors as a fallback. If the released package
does not produce the required responsive utilities, fix the Najm Kit package
contract and publish a corrected version.
