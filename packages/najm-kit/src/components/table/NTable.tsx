import React, { useRef, useEffect, useState, useCallback } from "react";
import { Eye, Inbox, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import type { ColumnDef, Row, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState, ExpandedState } from "@tanstack/react-table";
import { TableStoreContext } from "./TableContext";
import { useContextMenu, type ContextMenuItem } from "../data-display/useContextMenu";
import { useStoreSync, useDynamicPageSize, useTable, useTableKeyboard } from "./hooks";
import { NTableContent } from "./NTableContent";
import { NTableCards } from "./NTableCards";
import { NTablePagination } from "./NTablePagination";
import { NTableHeader } from "./NTableHeader";
import { NTableJson } from "./NTableJson";
import { NTableLoadingSkeleton } from "./NTableLoadingSkeleton";
import { cn } from "../../lib/cn";
import { NLoadingState } from "../feedback/NLoadingState";
import { NErrorState } from "../feedback/NErrorState";
import { NEmptyState } from "../feedback/NEmptyState";
import { Button } from "../Button";
import { useTableStore } from "./TableContext";
import type { ComponentType } from "react";
import type { ViewMode, CustomModeRenderers, NTableClassNames as NTableClassNamesAlias } from "./store";
import type { TableHeaderColor } from "./tableColors";
export type { NTableClassNames } from "./store";
export type { TableHeaderColor } from "./tableColors";

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
  /** Items for right-clicking a row/card and for the built-in ⋮ button. */
  row?: (row: T) => ContextMenuItem[];
  /** Items for right-clicking empty space (whitespace / between cards). */
  background?: () => ContextMenuItem[];
}

/** Object form, or a bare function treated as `{ row }`. */
export type NTableMenuProp<T = any> = NTableMenu<T> | ((row: T) => ContextMenuItem[]);

export interface NTableProps<T = any, M extends ViewMode = ViewMode> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  error?: any;
  getRowId?: (row: T) => string;
  onCreate?: () => void;
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
  pagination?: { pageIndex: number; pageSize: number };
  defaultPagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
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
  showViewToggle?: boolean;
  toolbarLabels?: boolean;
  dynamicHeight?: boolean;
  headerClassName?: string;
  headerColor?: TableHeaderColor;
  showCheckbox?: boolean;
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
  menu?: NTableMenuProp<T>;
  menuButton?: boolean;
  onCellEdit?: (row: T, columnId: string, value: any) => Promise<any>;
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

function TableLayout<T>(props: { renderEmpty?: () => React.ReactNode; renderFilteredEmpty?: () => React.ReactNode; renderError?: (error: any) => React.ReactNode; renderLoading?: () => React.ReactNode; contextMenuClose?: () => void; contextMenuOpen?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const classNames = useTableStore.use.classNames?.() as NTableClassNamesAlias | undefined;
  const className = useTableStore.use.className();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const loadingText = useTableStore.use.loadingText();
  const noDataText = useTableStore.use.noDataText();
  const isFilteredEmpty = useTableStore.use.isFilteredEmpty();
  const renderFilteredEmpty = useTableStore.use.renderFilteredEmpty();
  const viewMode = useTableStore.use.viewMode();
  const CardComponent = useTableStore.use.CardComponent();
  const responsiveCards = useTableStore.use.responsiveCards();
  const isCustomMode = useTableStore.use.isCustomMode();
  const renderCustomMode = useTableStore.use.renderCustomMode();

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useDynamicPageSize(containerRef);
  useTable();
  useTableKeyboard({
    scopeRef: containerRef,
    contextMenuClose: props.contextMenuClose,
    contextMenuOpen: props.contextMenuOpen,
  });

  // Resolve effective mode: userMode=json always shows json; userMode=table+mobile+responsiveCards+CardComponent → cards
  const effectiveMode = (() => {
    if (viewMode === "json") return "json";
    if (isMobile && responsiveCards && CardComponent) return "cards";
    return viewMode;
  })();

  // Resolution order: loading → error → filtered-empty → empty → content
  const showFilteredEmpty = isFilteredEmpty && !isLoading && !error;
  const showEmpty = hasNoData && !isLoading && !error && !showFilteredEmpty;

  const customRenderer = isCustomMode ? renderCustomMode?.[viewMode] : undefined;

  return (
    <div ref={containerRef} data-ntable-root className={cn("flex h-full min-h-0 flex-1 w-full flex-col gap-2 overflow-hidden", classNames?.root, className)}>
      <NTableHeader />
      <div data-ntable-body className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {isCustomMode ? (
          customRenderer ? customRenderer() : null
        ) : (
          <>
            {isLoading && (
              props.renderLoading
                ? <TableStateSlot>{props.renderLoading()}</TableStateSlot>
                : effectiveMode === "table"
                  ? <NTableLoadingSkeleton />
                  : <TableStateSlot><NLoadingState label={loadingText} /></TableStateSlot>
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
      <div data-ntable-pagination className="shrink-0">
        <NTablePagination />
      </div>
    </div>
  );
}

export function NTable<T = any, M extends ViewMode = ViewMode>(props: NTableProps<T, M>) {
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

  const defaultActionRowMenu = useCallback(
    (row: T): ContextMenuItem[] => {
      const items: ContextMenuItem[] = [];
      if (onView) items.push({ label: "View", icon: Eye, onSelect: () => onView(row) });
      if (onEdit) items.push({ label: "Edit", icon: Pencil, onSelect: () => onEdit(row) });
      if (onDelete) {
        items.push({ label: "Delete", icon: Trash2, danger: true, separatorBefore: items.length > 0, onSelect: () => onDelete(row) });
      }
      return items;
    },
    [onView, onEdit, onDelete],
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

  const handleManualRowMenu = useCallback(
    (e: React.MouseEvent, row: T) => {
      onRowContextMenu?.(e, row);
    },
    [onRowContextMenu],
  );

  const autoOpenRowMenu = effectiveRowMenu ? handleOpenRowMenu : (onRowContextMenu ? handleManualRowMenu : null);
  const effectiveMenuButton = Boolean(autoOpenRowMenu) && (menuButtonProp ?? true);

  const store = useStoreSync({
    data: props.data ?? [],
    columns: props.columns ?? [],
    filters: props.filters ?? [],
    isLoading: props.loading ?? false,
    error: props.error ?? null,
    viewMode: mode ?? defaultMode ?? "table",
    mode,
    onModeChange: props.onModeChange,
    CardComponent: props.renderCard ?? null,
    className: props.className ?? "",
    classNames: props.classNames ?? {},
    bordered: props.bordered,
    headerClassName: props.headerClassName ?? "bg-card",
    headerColor: props.headerColor ?? "primary",
    showCheckbox: props.showCheckbox ?? true,
    selectedRowId: props.selectedRowId ?? null,
    headerSlot: props.headerSlot ?? null,
    onAddClick: props.onCreate ?? null,
    onView: props.onView ?? null,
    onEdit: props.onEdit ?? null,
    onDelete: props.onDelete ?? null,
    onRowClick: props.onRowClick ?? null,
    onRowContextMenu: (onRowContextMenu || effectiveRowMenu) ? handleRowContextMenu : null,
    onBackgroundContextMenu: normalizedMenu.background ? handleBackgroundContextMenu : null,
    openRowMenu: autoOpenRowMenu,
    menuButton: effectiveMenuButton,
    onCellEdit: props.onCellEdit ?? null,
    onBulkDelete: props.onBulkDelete ?? null,
    onStateChange: props.onStateChange ?? null,
    getRowId: props.getRowId ?? null,
    renderToolbar: props.renderToolbar ?? null,
    showSorting: props.showSorting ?? true,
    showPagination: props.showPagination ?? true,
    showColumnVisibility: props.showColumnVisibility ?? false,
    showAddButton: props.showAddButton ?? Boolean(props.onCreate),
    showViewToggle: props.showViewToggle ?? true,
    toolbarLabels: props.toolbarLabels ?? true,
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
    manualPagination: props.manualPagination ?? false,
    pageCount: props.pageCount,
    rowCount: props.rowCount,
    pagination: props.pagination,
    defaultPagination: props.defaultPagination,
    onPaginationChange: props.onPaginationChange ?? null,
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
    isEmpty: props.isEmpty,
    isFilteredEmpty: props.isFilteredEmpty ?? false,
    renderFilteredEmpty: props.renderFilteredEmpty ?? null,
    // Row expansion
    expanded: props.expanded,
    defaultExpanded: props.defaultExpanded,
    onExpandedChange: props.onExpandedChange ?? null,
    getRowCanExpand: props.getRowCanExpand ?? null,
    renderSubRow: props.renderSubRow ?? null,
  });

  return (
    <TableStoreContext.Provider value={store}>
      <TableLayout
        renderEmpty={props.renderEmpty}
        renderFilteredEmpty={props.renderFilteredEmpty}
        renderError={props.renderError}
        renderLoading={props.renderLoading}
        contextMenuClose={ctx.close}
        contextMenuOpen={ctx.isOpen}
      />
      {ctx.menu}
    </TableStoreContext.Provider>
  );
}
