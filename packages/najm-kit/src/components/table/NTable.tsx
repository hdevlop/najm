import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useNTableDefaults, useResolvedToolbarLabels } from "./TableDefaults";
import { rowActionCopy } from "./rowActionLabels";
import { Download, Eye, Inbox, Pencil, Plus, Printer, SearchX, Trash2, Upload } from "lucide-react";
import type { ColumnDef, Row, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState, ExpandedState } from "@tanstack/react-table";
import { TableStoreContext } from "./TableContext";
import { useContextMenu, type ContextMenuItem } from "../data-display/useContextMenu";
import { useStoreSync, useDynamicPageSize, useTable, useTableKeyboard } from "./hooks";
import { NTableContent } from "./NTableContent";
import { NTableCards } from "./NTableCards";
import { NTablePagination } from "./NTablePagination";
import { NTableHeader } from "./NTableHeader";
import { NTableJson } from "./NTableJson";
import { NTableImport } from "./NTableImport";
import { downloadTable, printTable, tableDataSnapshot } from "./dataActions";
import type { Table } from "@tanstack/react-table";
import { NTableCardsLoadingSkeleton, NTableLoadingSkeleton } from "./NTableLoadingSkeleton";
import { cn } from "../../lib/cn";
import { NErrorState } from "../feedback/NErrorState";
import { NEmptyState } from "../feedback/NEmptyState";
import { Button } from "../Button";
import { useTableStore } from "./TableContext";
import type { ComponentType } from "react";
import type { ViewMode, CustomModeRenderers, NTableClassNames as NTableClassNamesAlias } from "./store";
import { useNajmComponentStyle } from "../../theme/design-provider";
import type { NTableColumnDef } from "./responsiveColumns";
import type {
  NTableCardPagination,
  NTablePaginationLabels,
  NTablePaginationVariant,
} from "./paginationContract";
import type { NTableToolbarLabels } from "./toolbarContract";
export type { NTableClassNames } from "./store";
export type { TableHeaderColor } from "./tableColors";
export type { NTableColumnDef, NTableColumnMeta, NTableColumnBreakpoint, NTableEditorType, NTableEditorOption } from "./responsiveColumns";
export type { NTableCardPagination, NTableLoadMorePagination, NTableInfinitePagination, NTablePaginationVariant, NTablePaginationLabels } from "./paginationContract";
export type { NTableToolbarLabels } from "./toolbarContract";

export interface NTableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  globalFilter: string;
}

/**
 * Unified menu definition for NTable. The same items power the row right-click
 * menu AND the built-in ⋮ button; `background` powers right-click on whitespace.
 */
export interface NTableMenu<T = any> {
  /** Override the default export/import/print menu on the toolbar and column headers. */
  header?: () => ContextMenuItem[];
  /** Items for right-clicking a row/card and for the built-in ⋮ button. */
  row?: (row: T) => ContextMenuItem[];
  /** Items for right-clicking empty space (whitespace / between cards). */
  background?: () => ContextMenuItem[];
}

/** Object form, or a bare function treated as `{ row }`. */
export type NTableMenuProp<T = any> = NTableMenu<T> | ((row: T) => ContextMenuItem[]);

export interface NTableProps<T = any, M extends ViewMode = ViewMode> {
  data: T[];
  columns: ReadonlyArray<NTableColumnDef<T, any>>;
  loading?: boolean;
  error?: any;
  getRowId?: (row: T) => string;
  onCreate?: () => void;
  /** Enable default CSV export, CSV/JSON import, and printing. Inherits provider defaults; otherwise false. */
  dataActions?: boolean;
  /** Receive imported rows instead of replacing the table's local data. Can save them through an API. */
  onDataChange?: (rows: T[]) => void | Promise<unknown>;
  /** Override the default CSV export workflow. Also enables Export on its own. */
  onExport?: () => void;
  /** Override the default CSV/JSON import workflow. Also enables Import on its own. */
  onImport?: () => void;
  /** Override the default table print workflow. Also enables Print on its own. */
  onPrint?: () => void;
  /** Presentation of export/import/print actions. Defaults to "both". */
  toolbarActionDisplay?: "buttons" | "menu" | "both";
  onEdit?: (row: T) => void;
  onView?: (row: T) => void;
  onDelete?: (row: T) => void;
  renderCard?: ComponentType<{
    data: T;
    row: Row<T>;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    canExpand?: boolean;
    renderSubRow?: (row: T) => React.ReactNode;
    'data-row'?: string;
    'data-row-id'?: string;
  }>;
  /**
   * A placeholder shaped like `renderCard`.
   *
   * The card page size is measured from whatever is on screen, and during a
   * first load that is the skeleton. The built-in placeholder is an avatar row,
   * so a consumer whose cards are a different height — a media card, say — gets
   * a page size measured against a card it does not use, and the grid re-lays
   * out once real cards arrive. Supplying a placeholder with the real card's
   * geometry makes the first measurement the correct one.
   */
  renderCardSkeleton?: ComponentType<Record<string, never>>;
  /**
   * Emit both skeleton shapes and let a media query choose between them.
   *
   * A view mode derived from the viewport is unknowable on the server, so the
   * server renders the card shape and the client corrects it after hydration —
   * on a desktop table page that is a visible card skeleton followed by a table
   * skeleton. No client-side detection can fix it, because the first paint is
   * whatever the server sent. Rendering both and hiding one in CSS puts the
   * right shape in that first paint. The skeleton is `aria-hidden` decoration,
   * so the duplicate costs nothing to assistive technology.
   *
   * The breakpoint is `lg` (1024px), matching the point at which a table
   * becomes usable.
   */
  responsiveSkeleton?: boolean;
  renderToolbar?: (state: NTableState) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  renderError?: (error: any) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  className?: string;
  classNames?: NTableClassNamesAlias;
  /** Use a border instead of a shadow for the table container and cards. */
  bordered?: boolean;
  density?: "compact" | "comfortable" | "spacious";
  availableModes?: readonly M[];
  mode?: M;
  defaultMode?: M;
  onModeChange?: (mode: M) => void;
  jsonValue?: unknown;
  jsonColors?: any;
  renderJson?: () => React.ReactNode;
  renderCustomMode?: CustomModeRenderers;
  // Server-side pagination
  manualPagination?: boolean;
  pageCount?: number;
  rowCount?: number;
  /**
   * Whether another server page exists, for a list whose endpoint reports no
   * result total. Supply it *instead of* `pageCount`, never a `pageCount`
   * synthesized from it: the numbered bar then covers the pages known to exist
   * and carries a trailing `…` for the rest, and the last-page jump is dropped
   * because there is no known last page. Ignored when `pageCount` is given —
   * a real total already says everything this does.
   */
  hasNextPage?: boolean;
  pagination?: { pageIndex: number; pageSize: number };
  defaultPagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  /** Pagination presentation used whenever NTable is actually rendering cards. */
  cardPagination?: NTableCardPagination;
  /**
   * How the page controls present position. Defaults to `"numbered"`, which
   * falls back to `"compact"` on its own when the page count is not
   * trustworthy. Pass `"compact"` for the `Page X of Y` text everywhere.
   */
  paginationVariant?: NTablePaginationVariant;
  /** Accessible names and visible copy for the page controls. */
  paginationLabels?: NTablePaginationLabels;
  // Row selection
  rowSelection?: RowSelectionState;
  defaultRowSelection?: RowSelectionState;
  onRowSelectionChange?: (state: RowSelectionState) => void;
  // Sorting
  sorting?: SortingState;
  defaultSorting?: SortingState;
  onSortingChange?: (state: SortingState) => void;
  // Responsive cards
  responsiveCards?: boolean;
  // Empty states
  isEmpty?: boolean;
  isFilteredEmpty?: boolean;
  renderFilteredEmpty?: () => React.ReactNode;
  // Row expansion
  expanded?: ExpandedState;
  defaultExpanded?: ExpandedState;
  onExpandedChange?: (state: ExpandedState) => void;
  getRowCanExpand?: (row: T) => boolean;
  renderSubRow?: (row: T) => React.ReactNode;
  filters?: any[];
  showPagination?: boolean;
  showSorting?: boolean;
  showColumnVisibility?: boolean;
  showAddButton?: boolean;
  /** Show Export in the toolbar and default header menu. True enables the built-in workflow; false hides it even with a callback or dataActions. */
  showExportButton?: boolean;
  /** Show Import in the toolbar and default header menu. True enables the built-in workflow; false hides it even with a callback or dataActions. */
  showImportButton?: boolean;
  /** Show Print in the toolbar and default header menu. True enables the built-in workflow; false hides it even with a callback or dataActions. */
  showPrintButton?: boolean;
  showViewToggle?: boolean;
  /** Accessible names and visible copy for the toolbar and settings menu. */
  toolbarLabels?: NTableToolbarLabels;
  dynamicHeight?: boolean;
  headerClassName?: string;
  /** CSS color or Najm token name for the table header background. Defaults to primary. */
  headerColor?: string;
  /** CSS color or Najm token name for table header text. Defaults to primary foreground. */
  headerTextColor?: string;
  /** CSS color or Najm token name for table borders. Defaults to border. */
  borderColor?: string;
  showCheckbox?: boolean;
  onRowClick?: (row: T) => void;
  /**
   * Called when a data cell is clicked in table view. Cell clicks do not
   * propagate to `onRowClick`.
   */
  onCellClick?: (row: T, columnId: string, event: React.MouseEvent<HTMLTableCellElement>) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
  getRowClassName?: (row: T) => string | undefined | null | false;
  menu?: NTableMenuProp<T>;
  menuButton?: boolean;
  onCellEdit?: (row: T, columnId: string, value: any) => Promise<any> | any;
  onBulkDelete?: (ids: string[]) => void;
  pageSizeOptions?: number[];
  noResultsText?: string;
  noDataText?: string;
  loadingText?: string;
  addButtonText?: string;
  headerSlot?: React.ReactNode;
  selectedRowId?: string | null;
  onStateChange?: (state: NTableState) => void;
}

function TableStateSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-64 flex-1 items-center justify-center">
      {children}
    </div>
  );
}

function DefaultTableEmptyState({ title }: { title: string }) {
  const onAddClick = useTableStore.use.onAddClick();
  const showAddButton = useTableStore.use.showAddButton();
  const addButtonText = useTableStore.use.addButtonText();
  const bordered = useTableStore.use.bordered();
  const canAdd = Boolean(showAddButton && onAddClick);

  return (
    <NEmptyState
      icon={Inbox}
      title={title}
      description={canAdd ? "Add your first item to get started." : undefined}
      action={canAdd ? (
        <Button size="sm" bordered={bordered} onClick={() => onAddClick?.()}>
          <Plus className="h-4 w-4" />
          {addButtonText || "Add item"}
        </Button>
      ) : undefined}
    />
  );
}

function DefaultTableFilteredEmptyState() {
  return (
    <NEmptyState
      icon={SearchX}
      title="No results found"
      description="Try adjusting your filters."
    />
  );
}

function TableLayout<T>(props: { renderEmpty?: () => React.ReactNode; renderFilteredEmpty?: () => React.ReactNode; renderError?: (error: any) => React.ReactNode; renderLoading?: () => React.ReactNode; responsiveSkeleton?: boolean; contextMenuClose?: () => void; contextMenuOpen?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const classNames = useTableStore.use.classNames?.() as NTableClassNamesAlias | undefined;
  const className = useTableStore.use.className();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const isLoading = useTableStore.use.isLoading();
  const isRefreshing = useTableStore.use.isRefreshing();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const noDataText = useTableStore.use.noDataText();
  const isFilteredEmpty = useTableStore.use.isFilteredEmpty();
  const renderFilteredEmpty = useTableStore.use.renderFilteredEmpty();
  const viewMode = useTableStore.use.viewMode();
  const CardComponent = useTableStore.use.CardComponent();
  const responsiveCards = useTableStore.use.responsiveCards();
  const isCustomMode = useTableStore.use.isCustomMode();
  const renderCustomMode = useTableStore.use.renderCustomMode();

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  ));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Resolve effective mode: userMode=json always shows json; userMode=table+mobile+responsiveCards+CardComponent → cards
  const effectiveMode: ViewMode = (() => {
    if (viewMode === "json") return "json";
    if (isMobile && responsiveCards && CardComponent) return "cards";
    return viewMode;
  })();

  const syncWithProps = useTableStore.use.syncWithProps();
  useLayoutEffect(() => {
    syncWithProps({ isMobile, effectiveViewMode: effectiveMode });
  }, [effectiveMode, isMobile, syncWithProps]);

  useDynamicPageSize(containerRef, effectiveMode);
  useTable(effectiveMode);
  useTableKeyboard({
    scopeRef: containerRef,
    contextMenuClose: props.contextMenuClose,
    contextMenuOpen: props.contextMenuOpen,
  });

  // Resolution order: loading → error → filtered-empty → empty → content
  const showFilteredEmpty = isFilteredEmpty && !isLoading && !error;
  const showEmpty = hasNoData && !isLoading && !error && !showFilteredEmpty;

  const customRenderer = isCustomMode ? renderCustomMode?.[viewMode] : undefined;

  return (
    <div ref={containerRef} data-ntable-root className={cn("flex h-full min-h-0 flex-1 w-full flex-col gap-2 overflow-hidden", classNames?.root, className)}>
      <NTableHeader />
      <div
        data-ntable-body
        data-ntable-refreshing={isRefreshing ? "true" : undefined}
        aria-busy={isRefreshing ? "true" : undefined}
        className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
      >
        {isCustomMode ? (
          customRenderer ? customRenderer() : null
        ) : (
          <>
            {isLoading && !isRefreshing && (
              // Absolutely positioned, the way every grid that measures its own
              // page size does it: AG Grid paints its loading state as an
              // overlay, and MUI's DataGrid renders `GridOverlay` on top of the
              // rows rather than in place of them. A skeleton that occupies a
              // slot in the layout is a second layout — the one the container
              // gets measured in — and the page size derived from it is a page
              // size for a table that no longer exists once rows land. Taking
              // the skeleton out of flow leaves exactly one layout to measure.
              <div
                data-ntable-loading-overlay
                className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background"
              >
                {props.renderLoading
                  ? <TableStateSlot>{props.renderLoading()}</TableStateSlot>
                  : props.responsiveSkeleton
                    ? (
                      <>
                        <div data-ntable-skeleton-variant="table" className="hidden min-h-0 flex-1 flex-col lg:flex">
                          <NTableLoadingSkeleton />
                        </div>
                        <div data-ntable-skeleton-variant="cards" className="flex min-h-0 flex-1 flex-col lg:hidden">
                          <NTableCardsLoadingSkeleton />
                        </div>
                      </>
                    )
                    : effectiveMode === "cards"
                      ? <NTableCardsLoadingSkeleton />
                      : <NTableLoadingSkeleton />}
              </div>
            )}
            {error && !isLoading && (
              <TableStateSlot>
                {props.renderError ? props.renderError(error) : <NErrorState message={typeof error === "string" ? error : "An error occurred"} />}
              </TableStateSlot>
            )}
            {showFilteredEmpty && (
              <TableStateSlot>
                {props.renderFilteredEmpty ? props.renderFilteredEmpty() : renderFilteredEmpty ? renderFilteredEmpty() : props.renderEmpty ? props.renderEmpty() : <DefaultTableFilteredEmptyState />}
              </TableStateSlot>
            )}
            {showEmpty && (
              <TableStateSlot>
                {props.renderEmpty ? props.renderEmpty() : <DefaultTableEmptyState title={noDataText} />}
              </TableStateSlot>
            )}
            <NTableContent effectiveMode={effectiveMode} />
            <NTableCards effectiveMode={effectiveMode} />
            <NTableJson />
          </>
        )}
      </div>
      <div
        data-ntable-pagination
        // Occupies its height during a first load but shows nothing: the row
        // counts and page numbers are meaningless before any row exists, while
        // the space they take has to be accounted for or the skeleton measures
        // a body one bar too tall.
        aria-hidden={isLoading && !isRefreshing ? "true" : undefined}
        className={cn(
          "min-w-0 shrink-0 bg-background text-foreground",
          isLoading && !isRefreshing && "invisible",
        )}
      >
        <NTablePagination />
      </div>
    </div>
  );
}

type NTableColumnDefCompatibilityProps<T, M extends ViewMode> =
  Omit<NTableProps<NoInfer<T>, M>, "data" | "columns"> & {
    data: T[];
    columns: ReadonlyArray<ColumnDef<T, any>>;
  };

/**
 * Backward-compatible overload for callers whose reusable column arrays are
 * declared with TanStack's plain `ColumnDef<T>[]`.
 */
export function NTable<T = any, M extends ViewMode = ViewMode>(
  props: NTableColumnDefCompatibilityProps<T, M>,
): React.ReactElement;
/**
 * Najm-specific overload providing typed `meta.visible` and
 * `meta.hiddenBelow` metadata.
 */
export function NTable<T = any, M extends ViewMode = ViewMode>(
  props: NTableProps<T, M>,
): React.ReactElement;
export function NTable<T = any, M extends ViewMode = ViewMode>(
  props: NTableProps<T, M> | NTableColumnDefCompatibilityProps<T, M>,
) {
  const recipe = useNajmComponentStyle("table");
  const defaults = useNTableDefaults();
  const dataActions = props.dataActions ?? defaults.dataActions ?? false;
  const [importOpen, setImportOpen] = useState(false);
  const [importedData, setImportedData] = useState<{ source: T[]; rows: T[] } | null>(null);
  const hasImportedData = importedData?.source === props.data;
  const data = hasImportedData ? importedData.rows : props.data;
  // Parent-supplied data remains authoritative after a refetch or other update.
  useEffect(() => { setImportedData(null); }, [props.data]);
  const dataTable = useRef<Table<T> | null>(null);
  const defaultExport = useCallback(() => {
    if (dataTable.current) downloadTable(tableDataSnapshot(dataTable.current));
  }, []);
  const defaultPrint = useCallback(() => {
    if (dataTable.current) printTable(tableDataSnapshot(dataTable.current));
  }, []);
  const defaultImport = useCallback(() => { setImportOpen(true); }, []);
  const importedRowId = useCallback((_row: T, index: number) => String(index), []);
  const recipeBordered = Boolean(recipe?.borderColor || recipe?.borderWidth);
  const availableModes = props.availableModes ?? (["table", "cards", "json"] as const);
  const lastInvalidModeRef = useRef<M | undefined>(undefined);

  // Normalize mode if it's not in availableModes
  let mode = props.mode;
  let defaultMode = props.defaultMode;

  if (mode !== undefined && !availableModes.includes(mode as any)) {
    const fallback = (availableModes[0] ?? "table") as M;
    if (lastInvalidModeRef.current !== mode) {
      lastInvalidModeRef.current = mode;
      props.onModeChange?.(fallback);
    }
    mode = fallback;
  } else {
    lastInvalidModeRef.current = undefined;
  }

  if (defaultMode !== undefined && !availableModes.includes(defaultMode as any)) {
    defaultMode = (availableModes[0] ?? "table") as M;
  }

  useEffect(() => {
    if (!props.renderCustomMode || typeof console === "undefined") return;
    const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
    if (isProduction) return;
    const modeKeys = availableModes as readonly string[];
    const ignored = Object.keys(props.renderCustomMode).filter((key) => !modeKeys.includes(key));
    if (ignored.length > 0) {
      console.warn(`NTable ignored custom renderer(s) not listed in availableModes: ${ignored.join(", ")}`);
    }
  }, [props.renderCustomMode, availableModes]);

  // Right-click context menu. Action handlers and/or `menu` build one
  // declarative row menu for both right-click and the built-in row button.
  // A manual onRowContextMenu can observe or override row right-clicks: call
  // preventDefault() from that handler to suppress the declarative menu.
  const ctx = useContextMenu();
  const { onView, onEdit, onDelete, menu, menuButton: menuButtonProp, onRowContextMenu } = props;

  const normalizedMenu = typeof menu === "function" ? { row: menu } : (menu ?? {});
  const hasDefaultActions = Boolean(onView || onEdit || onDelete);

  // NTable renders the store provider, so it reads its labels from props.
  const resolvedToolbarLabels = useResolvedToolbarLabels(props.toolbarLabels);
  const rowCopy = useMemo(() => rowActionCopy(resolvedToolbarLabels), [resolvedToolbarLabels]);
  const showExportButton = props.showExportButton ?? Boolean(dataActions || props.onExport);
  const showImportButton = props.showImportButton ?? Boolean(dataActions || props.onImport);
  const showPrintButton = props.showPrintButton ?? Boolean(dataActions || props.onPrint);
  // An open menu contains a snapshot of its items. Drop it when visibility changes.
  useEffect(() => { ctx.close(); }, [showExportButton, showImportButton, showPrintButton, ctx.close]);
  const toolbarActions = useMemo(() => {
    const items: ContextMenuItem[] = [];
    if (showExportButton) items.push({ label: resolvedToolbarLabels.export ?? "Export", icon: Download, onSelect: props.onExport ?? defaultExport });
    if (showImportButton) items.push({ label: resolvedToolbarLabels.import ?? "Import", icon: Upload, onSelect: props.onImport ?? defaultImport });
    if (showPrintButton) items.push({ label: resolvedToolbarLabels.print ?? "Print", icon: Printer, onSelect: props.onPrint ?? defaultPrint });
    return items;
  }, [showExportButton, showImportButton, showPrintButton, props.onExport, props.onImport, props.onPrint, defaultExport, defaultImport, defaultPrint, resolvedToolbarLabels]);
  const toolbarActionDisplay = props.toolbarActionDisplay ?? "both";
  const hasHeaderMenu = toolbarActionDisplay !== "buttons" && Boolean(toolbarActions.length || normalizedMenu.header);

  const defaultActionRowMenu = useCallback(
    (row: T): ContextMenuItem[] => {
      const items: ContextMenuItem[] = [];
      if (onView) items.push({ label: rowCopy.rowView, icon: Eye, onSelect: () => onView(row) });
      if (onEdit) items.push({ label: rowCopy.rowEdit, icon: Pencil, onSelect: () => onEdit(row) });
      if (onDelete) {
        items.push({ label: rowCopy.rowDelete, icon: Trash2, danger: true, separatorBefore: items.length > 0, onSelect: () => onDelete(row) });
      }
      return items;
    },
    [onView, onEdit, onDelete, rowCopy],
  );

  const effectiveRowMenu = normalizedMenu.row ?? (hasDefaultActions ? defaultActionRowMenu : undefined);

  const openItems = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    if (!items.length) return;
    ctx.open(e, items);
  }, [ctx]);

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, row: T) => {
      onRowContextMenu?.(e, row);
      if (e.defaultPrevented || !effectiveRowMenu) return;
      openItems(e, effectiveRowMenu(row));
    },
    [onRowContextMenu, effectiveRowMenu, openItems],
  );

  const handleBackgroundContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!normalizedMenu.background) return;
      openItems(e, normalizedMenu.background());
    },
    [normalizedMenu.background, openItems],
  );

  const handleOpenRowMenu = useCallback(
    (e: React.MouseEvent, row: T) => {
      if (!effectiveRowMenu) return;
      openItems(e, effectiveRowMenu(row));
    },
    [effectiveRowMenu, openItems],
  );

  const handleHeaderContextMenu = useCallback((e: React.MouseEvent) => {
    if (!hasHeaderMenu || props.error || (props.loading && !data?.length)) return;
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
    const items = normalizedMenu.header?.() ?? toolbarActions;
    if (!items.length) return;
    e.stopPropagation();
    openItems(e, items);
  }, [hasHeaderMenu, props.error, props.loading, data, normalizedMenu.header, toolbarActions, openItems]);

  const handleOpenHeaderMenu = useCallback((e: React.MouseEvent) => {
    if (props.error || (props.loading && !data?.length)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.open({ clientX: rect.left, clientY: rect.bottom }, normalizedMenu.header?.() ?? toolbarActions);
  }, [props.error, props.loading, data, normalizedMenu.header, toolbarActions, ctx]);

  const handleManualRowMenu = useCallback(
    (e: React.MouseEvent, row: T) => {
      onRowContextMenu?.(e, row);
    },
    [onRowContextMenu],
  );

  const autoOpenRowMenu = effectiveRowMenu ? handleOpenRowMenu : (onRowContextMenu ? handleManualRowMenu : null);
  const effectiveMenuButton = Boolean(autoOpenRowMenu) && (menuButtonProp ?? true);

  const store = useStoreSync({
    data: data ?? [],
    columns: props.columns ?? [],
    filters: props.filters ?? [],
    isLoading: props.loading ?? false,
    error: props.error ?? null,
    viewMode: mode ?? defaultMode ?? "table",
    mode,
    onModeChange: props.onModeChange,
    CardComponent: props.renderCard ?? null,
    CardSkeletonComponent: props.renderCardSkeleton ?? null,
    className: props.className ?? "",
    classNames: props.classNames ?? {},
    bordered: props.bordered ?? (recipeBordered ? true : undefined),
    headerClassName: props.headerClassName ?? "bg-card",
    headerColor: props.headerColor ?? recipe?.headerColor,
    headerTextColor: props.headerTextColor ?? recipe?.headerTextColor,
    borderColor: props.borderColor ?? recipe?.borderColor,
    showCheckbox: props.showCheckbox ?? true,
    selectedRowId: props.selectedRowId ?? null,
    headerSlot: props.headerSlot ?? null,
    onAddClick: props.onCreate ?? null,
    toolbarActions,
    toolbarActionDisplay,
    hasHeaderMenu,
    onHeaderContextMenu: hasHeaderMenu ? handleHeaderContextMenu : null,
    openHeaderMenu: hasHeaderMenu ? handleOpenHeaderMenu : null,
    onView: props.onView ?? null,
    onEdit: props.onEdit ?? null,
    onDelete: props.onDelete ?? null,
    onRowClick: props.onRowClick ?? null,
    onCellClick: props.onCellClick ?? null,
    onRowContextMenu: (onRowContextMenu || effectiveRowMenu) ? handleRowContextMenu : null,
    onBackgroundContextMenu: normalizedMenu.background ? handleBackgroundContextMenu : null,
    openRowMenu: autoOpenRowMenu,
    getRowClassName: props.getRowClassName ?? null,
    menuButton: effectiveMenuButton,
    onCellEdit: props.onCellEdit ?? null,
    onBulkDelete: props.onBulkDelete ?? null,
    onStateChange: props.onStateChange ?? null,
    // Imported CSV may omit the app's IDs; local row identity uses row indices.
    getRowId: hasImportedData ? importedRowId : (props.getRowId ?? null),
    renderToolbar: props.renderToolbar ?? null,
    showSorting: props.showSorting ?? true,
    showPagination: props.showPagination ?? true,
    showColumnVisibility: props.showColumnVisibility ?? false,
    showAddButton: props.showAddButton ?? Boolean(props.onCreate),
    showViewToggle: props.showViewToggle ?? true,
    toolbarLabels: props.toolbarLabels ?? {},
    dynamicHeight: props.dynamicHeight ?? true,
    noResultsText: props.noResultsText ?? "No results.",
    noDataText: props.noDataText ?? "No data available",
    loadingText: props.loadingText ?? "Loading...",
    addButtonText: props.addButtonText ?? "",
    pageSizeOptions: props.pageSizeOptions ?? [10, 20, 30, 40, 50],
    // JSON mode
    jsonValue: props.jsonValue,
    jsonColors: props.jsonColors ?? null,
    renderJson: props.renderJson ?? null,
    renderCustomMode: props.renderCustomMode ?? null,
    // availableModes
    availableModes,
    // Server-side pagination
    manualPagination: hasImportedData ? false : (props.manualPagination ?? false),
    pageCount: hasImportedData ? undefined : props.pageCount,
    rowCount: hasImportedData ? undefined : props.rowCount,
    hasNextPage: hasImportedData ? undefined : props.hasNextPage,
    pagination: hasImportedData ? undefined : props.pagination,
    defaultPagination: props.defaultPagination,
    onPaginationChange: hasImportedData ? null : (props.onPaginationChange ?? null),
    cardPagination: hasImportedData ? { mode: "paged" } : (props.cardPagination ?? { mode: "paged" }),
    paginationVariant: props.paginationVariant ?? "numbered",
    paginationLabels: props.paginationLabels ?? {},
    // Row selection
    rowSelection: props.rowSelection,
    defaultRowSelection: props.defaultRowSelection,
    onRowSelectionChange: props.onRowSelectionChange ?? null,
    // Sorting
    sorting: props.sorting,
    defaultSorting: props.defaultSorting,
    onSortingChange: props.onSortingChange ?? null,
    // Responsive cards
    responsiveCards: props.responsiveCards ?? Boolean(props.renderCard),
    // Empty states
    isEmpty: hasImportedData ? undefined : props.isEmpty,
    isFilteredEmpty: hasImportedData ? false : (props.isFilteredEmpty ?? false),
    renderFilteredEmpty: props.renderFilteredEmpty ?? null,
    // Row expansion
    expanded: props.expanded,
    defaultExpanded: props.defaultExpanded,
    onExpandedChange: props.onExpandedChange ?? null,
    getRowCanExpand: props.getRowCanExpand ?? null,
    renderSubRow: props.renderSubRow ?? null,
  });

  useLayoutEffect(() => {
    dataTable.current = store.getState().table;
    return store.subscribe(state => { dataTable.current = state.table; });
  }, [store]);

  const applyImport = async (rows: Record<string, unknown>[]) => {
    if (props.onDataChange) await props.onDataChange(rows as T[]);
    else setImportedData({ source: props.data, rows: rows as T[] });
    const state = store.getState();
    state.setRowSelection({});
    state.setExpanded({});
    // A local import becomes a local dataset; do not request a remote page.
    if (props.onDataChange) state.setPagination({ ...state.pagination, pageIndex: 0 });
    else state.syncWithProps({ pagination: { ...state.pagination, pageIndex: 0 } });
  };

  return (
    <TableStoreContext.Provider value={store}>
      <TableLayout
        renderEmpty={props.renderEmpty}
        renderFilteredEmpty={props.renderFilteredEmpty}
        renderError={props.renderError}
        renderLoading={props.renderLoading}
        responsiveSkeleton={props.responsiveSkeleton}
        contextMenuClose={ctx.close}
        contextMenuOpen={ctx.isOpen}
      />
      {ctx.menu}
      {importOpen && <NTableImport open onClose={() => setImportOpen(false)} onApply={applyImport} labels={resolvedToolbarLabels} />}
    </TableStoreContext.Provider>
  );
}
