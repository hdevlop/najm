import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { type ComponentType, type ReactNode } from "react";
import type { ExpandedState, SortingState } from "@tanstack/react-table";

export interface NTableClassNames {
  root?: string;
  header?: string;
  tableHeader?: string;
  content?: string;
  pagination?: string;
  cards?: string;
  row?: string;
}

export type ViewMode = "table" | "cards" | "json" | "files";

export type BuiltInViewMode = "table" | "cards" | "json";
export type CustomModeRenderers = Partial<Record<string, () => ReactNode>>;

export interface TableState {
  table: any;
  data: any[];
  columns: any[];
  filters: any[];
  isLoading: boolean;
  error: any;
  viewMode: ViewMode;
  showSorting: boolean;
  showPagination: boolean;
  showColumnVisibility: boolean;
  showAddButton: boolean;
  showViewToggle: boolean;
  showContent: boolean;
  isTableView: boolean;
  isCardView: boolean;
  isJsonView: boolean;
  isFilesView: boolean;
  isCustomMode: boolean;
  hasActions: boolean;
  hasData: boolean;
  hasControls: boolean;
  hasNoData: boolean;
  dynamicHeight: boolean;
  CardComponent: ComponentType<any> | null;
  className: string;
  classNames: NTableClassNames;
  headerClassName: string;
  showCheckbox: boolean;
  selectedRowId: string | null;
  headerSlot: ReactNode | null;
  onAddClick: any;
  onView: any;
  onEdit: any;
  onDelete: any;
  onRowClick: any;
  onRowContextMenu: any;
  onCellClick: any;
  onBulkDelete: any;
  onRetry: any;
  onCellEdit: any;
  onStateChange: ((state: any) => void) | null;
  getRowId: ((row: any) => string) | null;
  renderToolbar: ((state: any) => ReactNode) | null;
  noResultsText: string;
  filterPlaceholder: string;
  loadingText: string;
  noDataText: string;
  addButtonText: string;
  pageSizeOptions: number[];
  calculatedPageSize: number;
  maxHeight: number | null;
  syncWithProps: (updates: Partial<TableState>) => void;
  // JSON mode
  jsonValue: unknown;
  jsonColors: any;
  renderJson: (() => ReactNode) | null;
  // Custom mode
  renderCustomMode: CustomModeRenderers | null;
  // Controlled mode
  isModeControlled: boolean;
  onModeChange: ((mode: ViewMode) => void) | null;
  // availableModes
  availableModes: readonly ViewMode[];
  // User-intent setter
  setViewMode: (mode: ViewMode) => void;
  // Track if we've ever synced viewMode from props (to avoid resetting user-selected mode)
  hasSyncedFromProps: boolean;
  // Server-side pagination
  manualPagination: boolean;
  pageCount: number | undefined;
  rowCount: number | undefined;
  pagination: { pageIndex: number; pageSize: number };
  isPaginationControlled: boolean;
  onPaginationChange: ((pagination: { pageIndex: number; pageSize: number }) => void) | null;
  // User-intent setter for pagination
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void;
  // Track if we've ever synced pagination from props
  hasSyncedPaginationFromProps: boolean;
  // Row selection
  rowSelection: Record<string, boolean>;
  isRowSelectionControlled: boolean;
  onRowSelectionChange: ((state: Record<string, boolean>) => void) | null;
  // User-intent setter for row selection
  setRowSelection: (state: Record<string, boolean>) => void;
  // Track if we've ever synced rowSelection from props
  hasSyncedRowSelectionFromProps: boolean;
  // Sorting
  sorting: SortingState;
  isSortingControlled: boolean;
  onSortingChange: ((state: SortingState) => void) | null;
  // User-intent setter for sorting
  setSorting: (state: SortingState) => void;
  // Track if we've ever synced sorting from props
  hasSyncedSortingFromProps: boolean;
  // Responsive cards
  responsiveCards: boolean;
  isMobile: boolean;
  // Empty states
  isEmpty: boolean | undefined;
  isFilteredEmpty: boolean;
  renderFilteredEmpty: (() => React.ReactNode) | null;
  // Row expansion
  expanded: ExpandedState;
  isExpandedControlled: boolean;
  onExpandedChange: ((state: ExpandedState) => void) | null;
  getRowCanExpand: ((row: any) => boolean) | null;
  renderSubRow: ((row: any) => React.ReactNode) | null;
  setExpanded: (state: ExpandedState) => void;
  hasSyncedExpandedFromProps: boolean;
}

export type TableStore = ReturnType<typeof createTableStore>;

const computeFlags = (state: Partial<TableState>): Partial<TableState> => {
  const hasData = Array.isArray(state.data) && state.data.length > 0;
  const hasNoData = state.isEmpty ?? !hasData;
  const isFilteredEmpty = Boolean(state.isFilteredEmpty);
  const isTableView = state.viewMode === "table";
  const isCardView = state.viewMode === "cards";
  const isJsonView = state.viewMode === "json";
  const isFilesView = state.viewMode === "files";
  const isCustomMode = !(["table", "cards", "json"] as string[]).includes(state.viewMode ?? "");
  const hasActions = Boolean(state.onView || state.onEdit || state.onDelete);
  const hasControls = Boolean(state.showColumnVisibility || state.showAddButton || state.showViewToggle);
  const showContent = !state.isLoading && !state.error && !hasNoData && !isFilteredEmpty;
  return { hasData, hasNoData, isTableView, isCardView, isJsonView, isFilesView, isCustomMode, hasActions, hasControls, showContent, showPagination: state.showPagination && isTableView && showContent };
};

type WithSelectors<S> = S extends { getState: () => infer T } ? S & { use: { [K in keyof T]: () => T[K] } } : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {} as any;
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }
  return store;
};

export const createTableStore = () => {
  const store = create<TableState>((set, get) => ({
    table: null, data: [], columns: [], filters: [], isLoading: false, error: null, viewMode: "table" as ViewMode,
    showSorting: true, showPagination: true, showColumnVisibility: false, showAddButton: true, showViewToggle: true, dynamicHeight: true,
    showContent: false, isTableView: true, isCardView: false, isJsonView: false, isFilesView: false, isCustomMode: false, hasActions: false, hasData: false, hasControls: true, hasNoData: true,
    onView: null, onEdit: null, onDelete: null, onAddClick: null, onRowClick: null, onRowContextMenu: null, onCellClick: null, onBulkDelete: null, onRetry: null, onCellEdit: null, onStateChange: null, getRowId: null, renderToolbar: null,
    CardComponent: null, className: "", classNames: {}, headerClassName: "bg-card", showCheckbox: true, selectedRowId: null, headerSlot: null,
    noResultsText: "No results.", filterPlaceholder: "", loadingText: "Loading...", noDataText: "No data available", addButtonText: "",
    pageSizeOptions: [10, 20, 30, 40, 50], calculatedPageSize: 10, maxHeight: null,
    // JSON mode
    jsonValue: undefined,
    jsonColors: null,
    renderJson: null,
    // Custom mode
    renderCustomMode: null,
    // Controlled mode
    isModeControlled: false,
    onModeChange: null,
    // availableModes
    availableModes: ["table", "cards", "json"] as const,
    // User-intent setter
    setViewMode: (mode: ViewMode) => {
      const { isModeControlled, onModeChange } = get();
      onModeChange?.(mode);
      if (!isModeControlled) {
        const updates = { viewMode: mode };
        const currentState = get();
        const mergedState = { ...currentState, ...updates };
        const flags = computeFlags(mergedState);
        set({ ...updates, ...flags });
      }
    },
    // Track if we've ever synced viewMode from props
    hasSyncedFromProps: false,
    // Server-side pagination
    manualPagination: false,
    pageCount: undefined,
    rowCount: undefined,
    pagination: { pageIndex: 0, pageSize: 10 },
    isPaginationControlled: false,
    onPaginationChange: null,
    // User-intent setter for pagination
    setPagination: (pagination: { pageIndex: number; pageSize: number }) => {
      const { isPaginationControlled, onPaginationChange } = get();
      onPaginationChange?.(pagination);
      if (!isPaginationControlled) {
        set({ pagination });
      }
    },
    // Track if we've ever synced pagination from props
    hasSyncedPaginationFromProps: false,
    // Row selection
    rowSelection: {},
    isRowSelectionControlled: false,
    onRowSelectionChange: null,
    setRowSelection: (state: Record<string, boolean>) => {
      const { isRowSelectionControlled, onRowSelectionChange } = get();
      onRowSelectionChange?.(state);
      if (!isRowSelectionControlled) {
        set({ rowSelection: state });
      }
    },
    hasSyncedRowSelectionFromProps: false,
    // Sorting
    sorting: [] as SortingState,
    isSortingControlled: false,
    onSortingChange: null,
    setSorting: (state: SortingState) => {
      const { isSortingControlled, onSortingChange } = get();
      onSortingChange?.(state);
      if (!isSortingControlled) {
        set({ sorting: state });
      }
    },
    hasSyncedSortingFromProps: false,
    // Responsive cards
    responsiveCards: true,
    isMobile: false,
    // Empty states
    isEmpty: undefined,
    isFilteredEmpty: false,
    renderFilteredEmpty: null,
    // Row expansion
    expanded: {} as ExpandedState,
    isExpandedControlled: false,
    onExpandedChange: null,
    getRowCanExpand: null,
    renderSubRow: null,
    setExpanded: (next: ExpandedState) => {
      const { isExpandedControlled, onExpandedChange } = get();
      onExpandedChange?.(next);
      if (!isExpandedControlled) {
        set({ expanded: next });
      }
    },
    hasSyncedExpandedFromProps: false,
    syncWithProps: (updates) => {
      const currentState = get();
      // Mark that we've synced from props if viewMode or pagination is in updates
      const hasSyncedFromProps = currentState.hasSyncedFromProps || "viewMode" in updates;
      const hasSyncedPaginationFromProps = currentState.hasSyncedPaginationFromProps || "pagination" in updates;
      const hasSyncedRowSelectionFromProps = currentState.hasSyncedRowSelectionFromProps || "rowSelection" in updates;
      const hasSyncedExpandedFromProps = currentState.hasSyncedExpandedFromProps || "expanded" in updates;
      const hasSyncedSortingFromProps = currentState.hasSyncedSortingFromProps || "sorting" in updates;
      const mergedState = { ...currentState, ...updates, hasSyncedFromProps, hasSyncedPaginationFromProps, hasSyncedRowSelectionFromProps, hasSyncedExpandedFromProps, hasSyncedSortingFromProps };
      const flags = computeFlags(mergedState);
      set({ ...updates, ...flags, hasSyncedFromProps, hasSyncedPaginationFromProps, hasSyncedRowSelectionFromProps, hasSyncedExpandedFromProps, hasSyncedSortingFromProps });
    },
  }));
  return createSelectors(store);
};
