import React, { useRef, useEffect, useState } from "react";
import type { ColumnDef, Row, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState, ExpandedState } from "@tanstack/react-table";
import { TableStoreContext } from "./TableContext";
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
import { useTableStore } from "./TableContext";
import type { ComponentType } from "react";
import type { ViewMode, CustomModeRenderers, NTableClassNames as NTableClassNamesAlias } from "./store";
export type { NTableClassNames } from "./store";

export interface NTableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  globalFilter: string;
}

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
  }>;
  renderToolbar?: (state: NTableState) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  renderError?: (error: any) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  className?: string;
  classNames?: NTableClassNamesAlias;
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
  dynamicHeight?: boolean;
  headerClassName?: string;
  showCheckbox?: boolean;
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
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

function TableLayout<T>(props: { renderEmpty?: () => React.ReactNode; renderFilteredEmpty?: () => React.ReactNode; renderError?: (error: any) => React.ReactNode; renderLoading?: () => React.ReactNode }) {
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
  useTableKeyboard();

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
    <div ref={containerRef} className={cn("flex flex-col gap-2 w-full h-full px-4 py-2", !dynamicHeight && "overflow-auto", classNames?.root, className)}>
      <NTableHeader />
      {isCustomMode ? (
        customRenderer ? customRenderer() : null
      ) : (
        <>
          {isLoading && (
            props.renderLoading
              ? props.renderLoading()
              : effectiveMode === "table"
                ? <NTableLoadingSkeleton />
                : <NLoadingState label={loadingText} />
          )}
          {error && !isLoading && (props.renderError ? props.renderError(error) : <NErrorState message={typeof error === "string" ? error : "An error occurred"} />)}
          {showFilteredEmpty && (props.renderFilteredEmpty ? props.renderFilteredEmpty() : renderFilteredEmpty ? renderFilteredEmpty() : props.renderEmpty ? props.renderEmpty() : <NEmptyState title="No results found" />)}
          {showEmpty && (props.renderEmpty ? props.renderEmpty() : <NEmptyState title={noDataText} />)}
          <NTableContent effectiveMode={effectiveMode} />
          <NTableCards effectiveMode={effectiveMode} />
          <NTableJson />
          <NTablePagination />
        </>
      )}
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
    headerClassName: props.headerClassName ?? "bg-card",
    showCheckbox: props.showCheckbox ?? true,
    selectedRowId: props.selectedRowId ?? null,
    headerSlot: props.headerSlot ?? null,
    onAddClick: props.onCreate ?? null,
    onView: props.onView ?? null,
    onEdit: props.onEdit ?? null,
    onDelete: props.onDelete ?? null,
    onRowClick: props.onRowClick ?? null,
    onRowContextMenu: props.onRowContextMenu ?? null,
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
      />
    </TableStoreContext.Provider>
  );
}
