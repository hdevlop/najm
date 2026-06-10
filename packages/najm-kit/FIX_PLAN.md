# Najm Kit Fix Plan

## Goal

Collect small UI polish fixes for `najm-kit` and implement them in the shared component library instead of patching each consuming app.

## Fix 1: Dropdown Items Need Pointer Cursor

### Problem

Select and dropdown menu options look clickable but currently use the default cursor in the popup list. This is visible in filters such as the status dropdown.

### Affected Files

- `src/components/ui/select.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/command.tsx`
- Inputs that rely on these primitives, such as `SelectInput`, `ComboboxInput`, and `MultiSelectInput`

### Implementation

- Change interactive option rows from `cursor-default` to `cursor-pointer`.
- Keep disabled rows non-interactive with the existing disabled styles.
- Apply the change to:
  - `SelectItem`
  - `DropdownMenuItem`
  - `DropdownMenuCheckboxItem`
  - `DropdownMenuRadioItem`
  - `DropdownMenuSubTrigger`
  - `CommandItem`
- Leave non-clickable labels, separators, and scroll buttons unchanged unless they are meant to trigger an action.

### Acceptance

- Hovering any enabled select/dropdown/command option shows the pointer cursor.
- Disabled options do not show a clickable cursor.
- Existing keyboard navigation and focus styles still work.

### Verification

- Add or update focused tests for primitive class names where practical.
- Run:

```bash
bun test packages/najm-kit/test/barrel.test.ts
bun test packages/najm-kit/test/ntable.test.tsx
bun run build:ui
```

## Fix 2: NTable Header Text Needs More Contrast

### Problem

`NTable` headers can appear too light, especially with colored header backgrounds such as rose/pink. Header labels and sort icons should be easier to read.

### Affected Files

- `src/components/ui/table.tsx`
- `src/components/table/NTableContent.tsx`
- `src/components/table/tableColors.ts`
- `test/table/header-bordered.test.tsx` or a new focused table header test

### Implementation

- Update the base `TableHead` text color from muted text to a stronger default, such as `text-foreground`.
- Keep `NTableContent` applying `colorStyle?.text` so themed header colors still work.
- Increase colored header contrast in `tableColors.ts`, especially the light-mode `rose` token seen in the dashboard.
- Ensure sort icons inherit the same high-contrast header color instead of appearing faded.
- Keep checkbox and expansion header cells visually aligned with normal header cells.

### Acceptance

- Table header text passes visual contrast against default and colored header backgrounds.
- Rose/pink headers no longer render low-contrast red text on pale pink.
- Existing `headerColor`, `headerClassName`, and `classNames.tableHeader` overrides continue to work.

### Verification

- Run focused table tests:

```bash
bun test packages/najm-kit/test/ntable.test.tsx
bun test packages/najm-kit/test/table/header-bordered.test.tsx
```

- Build published output:

```bash
bun run build:ui
```

## Fix 3: Toaster `richColors` And Success Text Visibility

### Problem

The dashboard renders `<Toaster richColors />` in `apps/dashboard/src/components/NajmClientRoot.tsx`, but the `najm-kit` wrapper also sets `richColors={false}` in `src/components/ui/sonner.tsx`.

The current source spreads `{...props}` after the hardcoded value, so React should let the caller override it. Still, the explicit `false` is misleading, and the wrapper's `toastOptions.classNames.success` forces `!bg-emerald-600 !text-white`. When Sonner uses its non-rich/default palette, inner success elements can keep conflicting Sonner text/background tokens, making the toast title look missing or invisible.

### Affected Files

- `src/components/ui/sonner.tsx`
- `test/sonner.test.tsx` or a new focused toaster test
- Dashboard verification call site: `apps/dashboard/src/components/NajmClientRoot.tsx`

### Implementation

- Remove the hardcoded `richColors={false}` from the wrapper.
- Keep consumer props last in the JSX so app-level props such as `richColors`, `position`, `duration`, and `toastOptions` can override wrapper defaults.
- Consider destructuring `toastOptions` and merging class names instead of replacing the whole object, so consumers can extend defaults safely.
- Make success/error/warning/info styles apply to the title, description, and icon area consistently, or rely on Sonner `richColors` instead of fighting it with outer-only `!text-white`.
- Ensure the wrapper does not make the default Sonner palette and custom semantic classes conflict.

Suggested shape:

```tsx
function Toaster({ toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: "...",
          description: "...",
          actionButton: "...",
          cancelButton: "...",
          success: "...",
          error: "...",
          warning: "...",
          info: "...",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}
```

### Acceptance

- `<Toaster richColors />` enables Sonner rich colors from consuming apps.
- Success toast title and description are visible on the dashboard.
- Caller-provided `toastOptions.classNames` still override wrapper defaults.
- No hardcoded `richColors={false}` remains in source or rebuilt `dist/index.mjs`.

### Verification

- Add a test that renders `<Toaster richColors />` and verifies the underlying Sonner receives `richColors`.
- Add a test or visual playground case for success toast text visibility.
- Run:

```bash
bun test packages/najm-kit/test/barrel.test.ts
bun run build:ui
```

## Notes

- Make these fixes in `C:\Users\pc\Desktop\libs\najm\packages\najm-kit`, not in installed `node_modules` copies.
- After publishing or linking the package, verify the dashboard pages that use `NTable` filters and colored headers.
