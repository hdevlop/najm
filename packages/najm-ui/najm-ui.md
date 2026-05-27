# Najm UI — Component Naming Migration Guide

> This document tracks the `N*` prefix standardization applied across the component library. All exported components now use the `N` prefix (for **N**ajm UI) to ensure consistent branding and to avoid collisions with shadcn/ui primitives.

---

## Changelog

### 0.0.5
- **`data-row` attribute:** `NTable` now adds `data-row="true"` to every rendered `<tr>` in table mode, and spreads `data-row="true"` onto the root element of `renderCard` in cards mode. This allows refined CSS targeting (`[data-row]`) or programmatic selection of data rows without coupling to class names that may shift across releases.

### 0.0.4
- **NTable sorting:** Added controlled sort via `sorting`, `defaultSorting`, and `onSortingChange` props. Mirrors the `rowSelection` / `onRowSelectionChange` pattern. In controlled mode, sort state flows through the store; in uncontrolled mode, uses internal `useState`. The `sorting` prop accepts `SortingState` (`{ id: string; desc: boolean }[]`) and `onSortingChange` is called with the updated state on every sort change.
- **`appendCard` removed:** Prop was declared in `NTableProps` but `NTableCards` no longer renders it (STNU-001 refactor). Kept a no-op for two releases; now cleanly removed. If you need extra cards appended to the grid, that feature needs a fresh design.

### 0.0.3
- **renderCard contract:** `renderSubRow` now included in the type; consumers no longer need `(props: any)` casts. `singleColumn` prop removed from `NTable` and store (was deprecated in Phase 1).

### 0.0.2
- **cards mode:** `renderCard` now owns the full card root; use `NDataCardShell` to preserve the previous data-card chrome (checkbox, actions menu, expand chevron, selection ring, responsive width). The `renderCard` prop signature now accepts `onClick` and `onContextMenu` in addition to `data` and `row`. `NDataCardShell` is the new opt-in helper for data-card chrome.

---

## NTable Usage

`NTable` is a TanStack Table–powered component that renders data in table, cards, or JSON mode. A single `NTable` instance switches mode via the `mode` prop; the three view-toggle buttons in the header are built-in when `showViewToggle` is true. All props are optional unless noted.

### Picking a Mode

| Use case | Recommended `mode` | Notes |
|----------|---------------------|-------|
| Structured rows, many columns, sortable | `mode="table"` | Default. Full column headers, sorting icons, checkbox column. |
| Browsing visual items (files, products, cards) | `mode="cards"` | Requires `renderCard`. Grid layout with custom card roots. |
| Large datasets with server-side filter/sort/page | `mode="table"` + `manualPagination` | Turn off `showPagination` and wire `pagination` / `onPaginationChange` yourself. |
| Read-only JSON dump (API response, debug view) | `mode="json"` | Requires `jsonValue` prop. Header shows JSON toggle button. |
| Mobile + visual items, auto-switch to cards | `mode="table"` + `responsiveCards` | Cards mode activates automatically below 640px. |
| Locked single mode, no toggle | `availableModes={['table']}` | Hides the view-toggle buttons entirely. |
| Controlled mode from parent state | `mode={view}` + `onModeChange={setView}` | Parent holds `'table' | 'cards' | 'json'`; NTable mirrors it. |

> **JSON mode** requires `jsonValue` to be set. Without it, the JSON toggle button is hidden even if `"json"` is in `availableModes`.

---

### Example 1 — Basic Table

Simplest possible usage: array data, column definitions, render.

```tsx
import { NTable } from "najm-ui";
import type { ColumnDef } from "@tanstack/react-table";

interface Product { id: string; name: string; price: number; category: string; }

const data: Product[] = [
  { id: "1", name: "Widget", price: 29.99, category: "Hardware" },
  { id: "2", name: "Pro Plan", price: 99.00, category: "Software" },
];

const columns: ColumnDef<Product, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "price", header: "Price" },
];

<NTable data={data} columns={columns} />
```

**Props used:** `data`, `columns`.

---

### Example 2 — Cards Mode with `renderCard`

Switch to cards by setting `mode="cards"` and providing a `renderCard` function. Each card is a custom React component — `NTable` passes `data`, `row`, `onClick`, `onContextMenu`, `isExpanded`, `onToggleExpanded`, `canExpand`, and `renderSubRow`.

```tsx
import { NTable, NDataCardShell } from "najm-ui";

function ProductCard({ data: product, onClick, onContextMenu, isExpanded, onToggleExpanded, canExpand, renderSubRow }: {
  data: Product;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  canExpand?: boolean;
  renderSubRow?: (row: Product) => React.ReactNode;
}) {
  return (
    <NDataCardShell
      onClick={onClick}
      onContextMenu={onContextMenu}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      canExpand={canExpand}
    >
      <div className="p-4">
        <h3 className="font-semibold">{product.name}</h3>
        <p className="text-sm text-muted">{product.category}</p>
        <span className="text-lg font-bold">${product.price}</span>
      </div>
      {canExpand && isExpanded && renderSubRow && (
        <div className="px-4 pb-4">{renderSubRow(product)}</div>
      )}
    </NDataCardShell>
  );
}

<NTable
  data={data}
  columns={columns}
  mode="cards"
  renderCard={ProductCard}
  showViewToggle={false}
  showPagination={false}
/>
```

**Props used:** `data`, `columns`, `mode` (`"cards"`), `renderCard`, `showViewToggle`, `showPagination`.

---

### Example 3 — Three-Way Toggle (table / cards / json)

Provide `availableModes={['table', 'cards', 'json']}` (or a subset) to enable all three toggle buttons. JSON mode requires `jsonValue`.

```tsx
import { NTable } from "najm-ui";

const [mode, setMode] = useState<"table" | "cards" | "json">("table");
const [jsonValue] = useState(JSON.stringify(data, null, 2));

<NTable
  data={data}
  columns={columns}
  availableModes={["table", "cards", "json"]}
  mode={mode}
  onModeChange={setMode}
  jsonValue={jsonValue}
  renderCard={ProductCard}
/>
```

**Props used:** `data`, `columns`, `availableModes`, `mode`, `onModeChange`, `jsonValue`, `renderCard`.

---

### Example 4 — FileBrowser Pattern (storage-studio)

A real-world pattern from `najm-storage-studio` that combines table + cards + drag-and-drop selection. `FileBrowser` is a thin wrapper that builds `FileRow[]` from separate `files` and `folders` arrays and drives `mode` from the parent `view` prop.

```tsx
import { NTable } from "najm-ui";
import { useDragMove } from "../hooks/useDragMove";

export interface FileRow {
  key: string;
  name: string;
  isFolder: boolean;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
}

export function FileBrowser({
  files, folders, mode, selected, onSelectAll, onNavigate, onRowContextMenu,
}: {
  files: FileItem[];
  folders: string[];
  mode: "table" | "cards";
  selected: Set<string>;
  onSelectAll: (keys: string[]) => void;
  onNavigate: (key: string, isFolder: boolean) => void;
  onRowContextMenu: (e: React.MouseEvent, row: FileRow) => void;
}) {
  const { dropTarget, dragHandlers } = useDragMove(onMoveToFolder);

  const all = useMemo<FileRow[]>([
    ...folders.map(f => ({ key: f, name: f.split("/").pop() ?? f, isFolder: true })),
    ...files.map(f => ({ key: f.filePath, name: f.filePath.split("/").pop() ?? f.filePath, isFolder: false, mimeType: f.mimeType, size: f.size })),
  ], [files, folders]);

  const rowSelection = Object.fromEntries([...selected].map(k => [k, true]));

  return (
    <NTable<FileRow>
      data={all}
      columns={columns}
      mode={mode}
      getRowId={r => r.key}
      rowSelection={rowSelection}
      onRowSelectionChange={next => onSelectAll(Object.entries(next).filter(([, v]) => v).map(([k]) => k))}
      onRowClick={row => onNavigate(row.key, row.isFolder)}
      onRowContextMenu={onRowContextMenu}
      showCheckbox={mode === "table"}
      showViewToggle={false}
      noDataText="No files or folders"
      renderCard={props => <FileTile {...props} dropTarget={dropTarget} dragHandlers={dragHandlers} />}
    />
  );
}
```

**Props used:** `data`, `columns`, `mode`, `getRowId`, `rowSelection`, `onRowSelectionChange`, `onRowClick`, `onRowContextMenu`, `showCheckbox`, `showViewToggle`, `noDataText`, `renderCard`.

---

### Example 5 — Unified Context Menu

`onRowContextMenu` is called on right-click with `(e: React.MouseEvent, row: T)`. NTable calls `e.preventDefault()` internally before invoking the handler — only one call fires per right-click. Use it to open a context menu anchored to the cursor position.

```tsx
import { NTable } from "najm-ui";

function MyTable() {
  const [menu, setMenu] = useState<{ x: number; y: number; row: Product } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, row: Product) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, row });
  }, []);

  return (
    <>
      <NTable
        data={data}
        columns={columns}
        onRowContextMenu={handleContextMenu}
        renderCard={props => <ProductCard {...props} />}
      />
      {menu && (
        <div className="fixed z-50 bg-popover border rounded shadow" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => { onEdit(menu.row); setMenu(null); }}>Edit</button>
          <button onClick={() => { onDelete(menu.row); setMenu(null); }}>Delete</button>
          <button onClick={() => setMenu(null)}>Cancel</button>
        </div>
      )}
    </>
  );
}
```

**Props used:** `data`, `columns`, `onRowContextMenu`, `renderCard`.

---

### Example 6 — Server-Side Pagination

Turn off the built-in pagination UI with `showPagination={false}` and wire your own pagination via controlled `pagination` + `onPaginationChange`. `manualPagination` flags the mode. `pageCount` tells NTable how many total pages exist.

```tsx
import { NTable } from "najm-ui";

function ServerTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const { data, total } = fetchProducts({ page: pagination.pageIndex, pageSize: pagination.pageSize });

  return (
    <NTable
      data={data}
      columns={columns}
      manualPagination
      pageCount={Math.ceil(total / pagination.pageSize)}
      pagination={pagination}
      onPaginationChange={setPagination}
      showPagination={false}
    />
  );
}
```

**Props used:** `data`, `columns`, `manualPagination`, `pageCount`, `pagination`, `onPaginationChange`, `showPagination`.

> `onPaginationChange` is called with `{ pageIndex: number; pageSize: number }`. NTable does not fetch data for you — the consumer must derive `data` from the new `pageIndex`/`pageSize` and pass the updated array back in.

---

### Example 7 — Locked Mode (no toggle buttons)

Use `availableModes` to restrict which modes are offered. To hide the toggle buttons entirely, provide exactly one mode — or rely on `showViewToggle={false}` while controlling `mode` from parent state.

```tsx
// Cards-only locked mode — no toggle buttons shown
<NTable data={data} columns={columns} mode="cards" renderCard={ProductCard} showViewToggle={false} />

// Table-only with sorting enabled
<NTable data={data} columns={columns} mode="table" showViewToggle={false} showSorting={true} />

// JSON-only locked mode
<NTable availableModes={["json"]} mode="json" jsonValue={apiResponse} />
```

**Props used:** `mode`, `renderCard`, `showViewToggle`, `availableModes`, `jsonValue`, `showSorting`.

---

### Example 8 — Row Expansion with `renderSubRow`

`getRowCanExpand` enables the expand chevron per row. `renderSubRow` renders a sub-row beneath the expanded row. Both table and cards mode support expansion.

```tsx
function ProductCard({ data: p, isExpanded, onToggleExpanded, canExpand, renderSubRow }: {
  data: Product;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  canExpand?: boolean;
  renderSubRow?: (row: Product) => React.ReactNode;
}) {
  return (
    <NDataCardShell isExpanded={isExpanded} onToggleExpanded={onToggleExpanded} canExpand={canExpand}>
      <div className="p-4">{p.name}</div>
      {canExpand && isExpanded && renderSubRow && (
        <div className="px-4 pb-4">{renderSubRow(p)}</div>
      )}
    </NDataCardShell>
  );
}

<NTable
  data={data}
  columns={columns}
  mode="cards"
  getRowCanExpand={p => p.description.length > 50}
  renderSubRow={p => <div className="text-sm text-muted p-2">{p.description}</div>}
  renderCard={ProductCard}
/>
```

For table mode, expansion rows are inserted directly in the `<TableBody>`:

```tsx
<NTable
  data={data}
  columns={columns}
  getRowCanExpand={p => Boolean(p.details)}
  renderSubRow={p => <div className="p-2">{p.details}</div>}
  showPagination={false}
/>
```

**Props used:** `data`, `columns`, `mode`, `getRowCanExpand`, `renderSubRow`, `renderCard`.

---

### Props Reference

Quick reference of every `NTable` prop. "Not yet supported" means the prop exists on `NTableProps` but the underlying implementation is not yet complete — do not rely on it in production until it is documented as working.

| Prop | Status | Notes |
|------|--------|-------|
| `data` | ✅ Supported | Required. Array of row objects. |
| `columns` | ✅ Supported | Required. TanStack `ColumnDef<T, any>[]`. |
| `mode` | ✅ Supported | `'table' \| 'cards' \| 'json'`. Mirrors `viewMode` in store. |
| `availableModes` | ✅ Supported | Subset of `['table', 'cards', 'json']`. Controls which toggle buttons appear. |
| `onModeChange` | ✅ Supported | Called with the new mode when user clicks a toggle button. |
| `renderCard` | ✅ Supported | `ComponentType<{ data, row, onClick, onContextMenu, isExpanded, onToggleExpanded, canExpand, renderSubRow }>`. Owns the card root. |
| `rowSelection` | ✅ Supported | `RowSelectionState` object (`{ [rowId]: boolean }`). Controlled via `rowSelection` + `onRowSelectionChange`. |
| `onRowSelectionChange` | ✅ Supported | Called with the new `RowSelectionState` on any selection change. |
| `onRowClick` | ✅ Supported | Called with `row.original` on row click. |
| `onRowContextMenu` | ✅ Supported | Called with `(e: React.MouseEvent, row: T)`. NTable calls `e.preventDefault()` before invoking. |
| `getRowId` | ✅ Supported | `(row: T) => string`. Used to stable identify rows for selection and expansion. |
| `getRowCanExpand` | ✅ Supported | `(row: T) => boolean`. Enables the expand chevron. |
| `renderSubRow` | ✅ Supported | `(row: T) => React.ReactNode`. Rendered beneath the row in table mode and inside the card in cards mode. |
| `showCheckbox` | ✅ Supported | Defaults to `true`. Show the checkbox column for selection. |
| `showSorting` | ✅ Supported | Defaults to `true`. Show sort icons in column headers. Sorting is internal; controlled sort is **Not yet supported**. |
| `showPagination` | ✅ Supported | Defaults to `true`. Built-in pagination UI. |
| `showColumnVisibility` | ✅ Supported | Defaults to `false`. Column visibility dropdown. |
| `showAddButton` | ✅ Supported | Defaults to `Boolean(onCreate)`. Plus button in header. |
| `showViewToggle` | ✅ Supported | Defaults to `true`. Three-way toggle buttons. |
| `pagination` | ✅ Supported | `{ pageIndex: number; pageSize: number }`. Controlled pagination state. |
| `onPaginationChange` | ✅ Supported | Called with new pagination state. Use with `manualPagination`. |
| `manualPagination` | ✅ Supported | Flag for server-side pagination. Disables built-in page controls. |
| `pageCount` | ✅ Supported | Total number of pages for the built-in pagination display. |
| `noDataText` | ✅ Supported | Text shown when `data` is empty. Defaults to `"No data available"`. |
| `noResultsText` | ✅ Supported | Text shown when filtered data is empty. |
| `loading` | ✅ Supported | Shows loading skeleton / spinner instead of content. |
| `error` | ✅ Supported | Shows error state instead of content. |
| `renderLoading` | ✅ Supported | Custom loading renderer. |
| `renderEmpty` | ✅ Supported | Custom empty-state renderer. |
| `renderError` | ✅ Supported | Custom error renderer. |
| `filters` | ✅ Supported | `Array<{ name, type, placeholder, options?, onChange? }>`. Rendered as filter controls in the header. |
| `jsonValue` | ✅ Supported | Value displayed in JSON mode. Must be set for JSON toggle to appear. |
| `jsonColors` | ✅ Supported | Color scheme for the JSON syntax highlighter. |
| `renderJson` | ✅ Supported | Custom JSON renderer function. |
| `renderToolbar` | ✅ Supported | `(state: NTableState) => React.ReactNode`. Renders a custom toolbar with sorting/filtering state. |
| `className` | ✅ Supported | Root wrapper class. |
| `classNames` | ✅ Supported | `{ root?, header?, tableHeader?, content?, pagination?, cards? }`. Per-section styling. |
| `density` | ✅ Supported | `"compact" \| "comfortable" \| "spacious"`. Row height / padding. |
| `dynamicHeight` | ✅ Supported | Defaults to `true`. When `false`, the table scrolls instead of filling its container. |
| `headerClassName` | ✅ Supported | Class applied to the `<TableHeader>` element. |
| `headerSlot` | ✅ Supported | Arbitrary React node rendered to the right of the header controls. |
| `pageSizeOptions` | ✅ Supported | Defaults to `[10, 20, 30, 40, 50]`. Options in the page-size select. |
| `selectedRowId` | ✅ Supported | Highlights a specific row by ID with a background color. |
| `onStateChange` | ✅ Supported | Called with the full `NTableState` (`{ sorting, columnFilters, columnVisibility, rowSelection, globalFilter }`) on any state mutation. |
| `onCreate` | ✅ Supported | Callback for the add button. Also controls visibility of the add button. |
| `onEdit` | ✅ Supported | Passed through to `NDataCardShell` actions if using the shell. |
| `onView` | ✅ Supported | Passed through to `NDataCardShell` actions if using the shell. |
| `onDelete` | ✅ Supported | Passed through to `NDataCardShell` actions if using the shell. |
| `onCellEdit` | ✅ Supported | `(row, columnId, value) => Promise<any>`. Enables inline editing on cells with `meta.editable: true`. |
| `onBulkDelete` | ✅ Supported | Called with `string[]` of row IDs when bulk delete is triggered. |
| `defaultMode` | ✅ Supported | Initial mode if `mode` is not controlled. Falls back to `"table"`. |
| `defaultRowSelection` | ✅ Supported | Initial selection state. |
| `defaultPagination` | ✅ Supported | Initial pagination state. |
| `defaultExpanded` | ✅ Supported | Initial expansion state. |
| `expanded` | ✅ Supported | Controlled expansion state (`ExpandedState`). |
| `onExpandedChange` | ✅ Supported | Called with new `ExpandedState`. Use with `expanded`. |
| `responsiveCards` | ✅ Supported | Auto-switches to cards mode below 640px when `true` (defaults to `true` when `renderCard` is provided). |
| `appendCard` | ⚠️ Not yet supported | Prop is wired but no longer rendered in `NTableCards` after STNU-001 refactor. Avoid relying on it; a follow-up packet will resolve the design. |
| `isEmpty` | ✅ Supported | Force the empty state regardless of data length. |
| `isFilteredEmpty` | ✅ Supported | Force the "no results" filtered-empty state. |
| `renderFilteredEmpty` | ✅ Supported | Custom "no results" renderer shown when filters are active and no rows match. |
| `loadingText` | ✅ Supported | Override the loading label. |
| `addButtonText` | ✅ Supported | Override the add button text. |
| `rowCount` | ✅ Supported | Total row count for pagination display when using server-side data. |

## Migration Summary

| Category | Status |
|----------|--------|
| Data Display | ✅ Renamed |
| Dialog | ✅ Renamed |
| Form | ✅ Already prefixed (`NForm`) |
| Layout | ✅ Renamed |
| Table | ⚠️ `NTable` only; sub-components pending |
| Feedback | ⚠️ No prefix yet (`Spinner`, `EmptyState`, etc.) |

---

## Data Display

### Renamed Components

| Old Name | New Name | File |
|----------|----------|------|
| `StatusBadge` | `NStatusBadge` | `NStatusBadge.tsx` |
| `AvatarCell` | `NAvatarItem` | `NAvatarItem.tsx` |
| `NCard` | `NAsyncCard` | `NAsyncCard.tsx` |
| `NSectionCard` | `NDetailCard` | `NDetailCard.tsx` |
| `NSectionInfo` | `NDetailItem` | `NDetailCard.tsx` |
| `NSectionList` | `NDetailList` | `NDetailCard.tsx` |
| `NStatWidget` | `NStatCard` | `NStatCard.tsx` |
| `ViewModeToggle` | `NViewToggle` | `NViewToggle.tsx` |
| `FilterBar` | `NFilterBar` | `NFilterBar.tsx` |
| `RowActions` | `NRowActions` | `NRowActions.tsx` |
| `DataViewBody` | `NViewBody` | `NViewBody.tsx` |

### Renamed Types

| Old Name | New Name |
|----------|----------|
| `StatusBadgeProps` | `NStatusBadgeProps` |
| `AvatarCellProps` | `NAvatarItemProps` |
| `AvatarCellClassNames` | `NAvatarItemClassNames` |
| `NCardProps` | `NAsyncCardProps` |
| `NCardClassNames` | `NAsyncCardClassNames` |
| `NSectionCardProps` | `NDetailCardProps` |
| `NSectionCardClassNames` | `NDetailCardClassNames` |
| `NSectionInfoProps` | `NDetailItemProps` |
| `NSectionListProps` | `NDetailListProps` |
| `NSectionListItem` | `NDetailListItem` |
| `NStatWidgetProps` | `NStatCardProps` |
| `NStatWidgetClassNames` | `NStatCardClassNames` |

### Consumers Updated
- `najm-rag-studio/src/components/common/RTable.tsx`
- `najm-ui/playground/src/sections/DataDisplayPreview.tsx`
- `najm-ui/playground/src/sections/FeedbackPreview.tsx`

---

## Dialog

### Renamed Components

| Old Name | New Name | File |
|----------|----------|------|
| `DeleteDialogContent` | `NDeleteDialogContent` | `NDeleteDialog.tsx` |
| `SmartPasteDialog` | `NSmartPasteDialog` | `NSmartPasteDialog.tsx` |

> `NMultiDialog` and `useDialog` were already correctly named.

### Renamed Types

| Old Name | New Name |
|----------|----------|
| `DeleteDialogContentProps` | `NDeleteDialogContentProps` |
| `SmartPasteDialogProps` | `NSmartPasteDialogProps` |

### Consumers Updated
- `najm-rag-studio/src/components/routing/tests/components/TestRunnerJsonView.tsx`
- `najm-rag-studio/src/components/routing/semantics/components/SemanticsJsonView.tsx`

---

## Layout

### Renamed Components

| Old Name | New Name | File |
|----------|----------|------|
| `AppShell` | `NAppShell` | `NAppShell.tsx` |
| `Sidebar` | `NSidebar` | `NSidebar.tsx` |
| `SidebarItem` | `NSidebarItem` | `NSidebarItem.tsx` |
| `Navbar` | `NNavbar` | `NNavbar.tsx` |
| `CommandPalette` | `NCommandPalette` | `NCommandPalette.tsx` |
| `PanelFrame` | `NPageHeader` | `NPageHeader.tsx` |
| `InspectorPanel` | `NInspectorSheet` | `NInspectorSheet.tsx` |

### Renamed Types

| Old Name | New Name |
|----------|----------|
| `AppShellProps` | `NAppShellProps` |
| `AppShellClassNames` | `NAppShellClassNames` |
| `AppShellUser` | `NAppShellUser` |
| `AppShellAction` | `NAppShellAction` |
| `AppCommandItem` | `NAppCommandItem` |
| `CommandPaletteProps` | `NCommandPaletteProps` |

### Consumers Updated
- `najm-ui/test/sidebar.test.tsx`
- `najm-ui/playground/src/sections/LayoutPreview.tsx`
- `najm-rag-studio/src/App.tsx`
- `najm-rag-studio/src/components/knowledge/index.tsx`
- `najm-rag-studio/src/components/chat/StudioChat.tsx`
- `najm-rag-studio/src/components/routing/lab/RoutingLab.tsx`
- `najm-rag-studio/src/components/settings/IndexSettings.tsx`
- `najm-rag-studio/src/components/settings/AccessSettings.tsx`
- `najm-rag-studio/src/components/routing/tools/ToolList.tsx`
- `najm-rag-studio/src/components/knowledge/DocumentInspector.tsx`
- `najm-rag-studio/src/components/knowledge/ChunkTable.tsx`
- `najm-rag-studio/src/components/knowledge/DocumentList.tsx`
- `najm-rag-studio/src/components/routing/tests/TestRunner.tsx`
- `najm-rag-studio/src/components/routing/semantics/SemanticsEditor.tsx`

---

## Form

No changes required — `NForm` and `NMultiDialog` already used the `N` prefix.

---

## How to Migrate Your Consumer Code

### Before
```tsx
import { StatusBadge, Sidebar, PanelFrame, SmartPasteDialog } from "najm-ui";
```

### After
```tsx
import { NStatusBadge, NSidebar, NPageHeader, NSmartPasteDialog } from "najm-ui";
```

Replace all JSX usages accordingly:
```tsx
// Before
<StatusBadge status="active" />
<Sidebar navItems={items} />
<PanelFrame title="Details">...</PanelFrame>

// After
<NStatusBadge status="active" />
<NSidebar navItems={items} />
<NPageHeader title="Details">...</NPageHeader>
```

---

## Feedback

### Renamed Components

| Old Name | New Name | File |
|----------|----------|------|
| `Spinner` | `NSpinner` | `NSpinner.tsx` |
| `LoadingState` | `NLoadingState` | `NLoadingState.tsx` |
| `ErrorState` | `NErrorState` | `NErrorState.tsx` |
| `EmptyState` | `NEmptyState` | `NEmptyState.tsx` |
| `ConfirmDialog` | `NConfirmDialog` | `NConfirmDialog.tsx` |
| `ErrorBoundary` | `NErrorBoundary` | `NErrorBoundary.tsx` |
| `Skeleton` | `NSkeleton` | `NSkeletonPresets.tsx` |
| `StatCardSkeleton` | `NStatCardSkeleton` | `NSkeletonPresets.tsx` |
| `TableRowSkeleton` | `NTableRowSkeleton` | `NSkeletonPresets.tsx` |
| `TableSkeleton` | `NTableSkeleton` | `NSkeletonPresets.tsx` |

### Renamed Types

| Old Name | New Name |
|----------|----------|
| `SpinnerProps` | `NSpinnerProps` |
| `LoadingStateProps` | `NLoadingStateProps` |
| `ErrorStateProps` | `NErrorStateProps` |
| `EmptyStateProps` | `NEmptyStateProps` |
| `ConfirmDialogProps` | `NConfirmDialogProps` |

### Consumers Updated
- `najm-ui/src/components/data-display/NAsyncCard.tsx`
- `najm-ui/src/components/table/NTable.tsx`
- `najm-ui/playground/src/sections/FeedbackPreview.tsx`
- `najm-rag-studio/src/App.tsx`
- `najm-rag-studio/src/components/dashboard/Dashboard.tsx`
- `najm-rag-studio/src/components/knowledge/ChunkTable.tsx`
- `najm-rag-studio/src/components/knowledge/DocumentList.tsx`
- `najm-rag-studio/src/components/knowledge/index.tsx`
- `najm-rag-studio/src/components/routing/index.tsx`
- `najm-rag-studio/src/components/routing/tools/ToolList.tsx`
- `najm-rag-studio/src/components/routing/semantics/SemanticsEditor.tsx`
- `najm-rag-studio/src/components/routing/lab/components/LabEmptyState.tsx`
- `najm-rag-studio/src/components/routing/tests/TestRunner.tsx`
- `najm-rag-studio/src/components/routing/tests/components/TestRunnerDialogs.tsx`
- `najm-rag-studio/src/components/routing/semantics/components/SemanticsDialogs.tsx`

---

## Remaining Work

| Category | Components | Status |
|----------|-----------|--------|
| **Table sub-components** | `TableHeader`, `TableContent`, `TableCards`, `TablePagination`, `TableJson` | Pending |
| **Inputs** | `TextInput`, `NumberInput`, `SelectInput`, etc. | Pending |
| **Hooks** | `useKeyboard`, `useDelayedLoading`, etc. | No prefix needed |

---

## Notes

- Internal utility types (`NavItem`, `UserMenuAction`, `LinkComponentType`) keep their generic names.
- Helper functions (`getStatusTheme`, `cn`, `resolveSlot`) keep their original names.
- `shadcn/ui` primitives (`Button`, `Badge`, `Card`, `Dialog`, etc.) are **not** renamed — they remain as-is from the upstream source.
