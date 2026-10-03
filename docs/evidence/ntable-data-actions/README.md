# NTable data actions browser acceptance

Verified on 2026-10-03 against a freshly built Najm Kit playground, served by
Vite preview at `http://127.0.0.1:5178`. Playwright 1.62.1 ran Chromium with
desktop (1440 x 1000) and Pixel 7 mobile (390 x 844) profiles.

The example is on **Table > Export, import, and print**. It exposes independent
Export/Import/Print switches, buttons/menu presentation, empty and loading
states, and default workflows without application action handlers. The earlier
`sections/TablePreview.tsx` is not mounted by the current playground.

## Results

- **12/12 Playwright acceptance checks passed**, without retries. Each test also
  asserts a clean console and no uncaught page errors.
- Dark, light, and RTL screenshots were generated and inspected. The mobile
  search field was cramped beside four action controls; it now occupies its own
  row whenever data actions are enabled, with a browser geometry assertion.
- Independent visibility flags, import-only/export-only states, buttons/menu
  presentation, keyboard opening/focus, desktop column-header right-click and
  the mobile menu trigger passed.
- CSV and JSON file uploads, structural errors, preview, cancellation, empty
  table import and confirmed local row replacement passed.
- Export produced a real `table.csv` download containing only filtered rows.
- Printing generated a separate plain table, invoked `window.print`, and
  removed the print iframe after `afterprint`. The test intercepts the print
  call; the operating-system print dialog, printers and PDF output were not
  exercised.
- **60 focused package tests** and source/test/acceptance type checks passed
  after the visual fixes.

These checks use local playground data. They do not exercise application
database persistence, consumer applications, package publication or deployment.

## Reproduce

From the repository root:

```powershell
bun run --cwd packages/najm-kit test:acceptance table-data-actions.acceptance.ts
bun run --cwd packages/najm-kit typecheck:acceptance
```

The existing Playwright configuration builds the playground first and refuses
to reuse a preview server, so the tests run against the current source. The
acceptance spec is named `.acceptance.ts` to avoid Bun's unit-test discovery.

## Screenshots

Screenshots are generated into ignored `.runtime/ntable-data-actions/`:

- [Desktop dark](../../../.runtime/ntable-data-actions/desktop-dark.png)
- [Desktop light](../../../.runtime/ntable-data-actions/desktop-light.png)
- [Desktop RTL](../../../.runtime/ntable-data-actions/desktop-rtl.png)
- [Desktop header menu](../../../.runtime/ntable-data-actions/desktop-header-menu.png)
- [Mobile dark](../../../.runtime/ntable-data-actions/mobile-dark.png)
- [Mobile light](../../../.runtime/ntable-data-actions/mobile-light.png)
- [Mobile RTL](../../../.runtime/ntable-data-actions/mobile-rtl.png)
- [Mobile import-only](../../../.runtime/ntable-data-actions/mobile-import-only.png)
- [Import preview](../../../.runtime/ntable-data-actions/mobile-import-preview.png)
- [Imported rows](../../../.runtime/ntable-data-actions/mobile-imported-rows.png)
- [Print layout](../../../.runtime/ntable-data-actions/desktop-print-layout.png)

The screenshot directory also contains the desktop counterparts and the mobile
print layout. Playwright failure traces use `.runtime/playwright-kit/`.
