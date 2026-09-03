import { create } from "zustand";
import { StoreApi, UseBoundStore } from "zustand";
import { type ComponentType, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import type { ExpandedState, SortingState } from "@tanstack/react-table";
import type {
  NTableCardPagination,
  NTablePaginationLabels,
  NTablePaginationVariant,
} from "./paginationContract";
import type { NTableToolbarLabels } from "./toolbarContract";

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
  toolbarLabels: NTableToolbarLabels;
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
  /** Loading while rows are already on screen: a refresh, not a first load. */
  isRefreshing: boolean;
  dynamicHeight: boolean;
  CardComponent: ComponentType<any> | null;
  /** Placeholder shaped like `CardComponent`; see `renderCardSkeleton`. */
  CardSkeletonComponent: ComponentType<any> | null;
  className: string;
  classNames: NTableClassNames;
  bordered?: boolean;
  headerClassName: string;
  headerColor: string | undefined;
  headerTextColor: string | undefined;
  borderColor: string | undefined;
  showCheckbox: boolean;
  selectedRowId: string | null;
  headerSlot: ReactNode | null;
  onAddClick: any;
  onView: any;
  onEdit: any;
  onDelete: any;
  onRowClick: any;
  onRowContextMenu: any;
  onBackgroundContextMenu: ((e: ReactMouseEvent) => void) | null;
  openRowMenu: ((e: ReactMouseEvent, row: any) => void) | null;
  getRowClassName: ((row: any) => string | undefined | null | false) | null;
  menuButton: boolean;
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
  /** Whole card rows that fit the measured body, multiplied by the column count. */
  calculatedCardPageSize: number;
  /** True once a real layout measurement has replaced the seeded defaults. */
  hasMeasuredLayout: boolean;
  skeletonRowCount: number;
  maxHeight: number | null;
  bodyWidth: number;
  bodyHeight: number;
  tableHeaderHeight: number;
  cardColumnCount: number;
  cardRowHeight: number;
  cardGap: number;
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
  // Pagination presentation
  paginationVariant: NTablePaginationVariant;
  paginationLabels: NTablePaginationLabels;
  // Server-side pagination
  manualPagination: boolean;
  pageCount: number | undefined;
  rowCount: number | undefined;
  /** Another server page exists, for a result whose total is unknown. */
  hasNextPage: boolean | undefined;
  pagination: { pageIndex: number; pageSize: number };
  isPaginationControlled: boolean;
  onPaginationChange: ((pagination: { pageIndex: number; pageSize: number }) => void) | null;
  /** True after the reader explicitly chooses a Rows/page value. */
  isPageSizeUserSelected: boolean;
  // Pagination navigation and automatic sizing.
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void;
  // Explicit Rows/page selection. Disables automatic fit sizing for this table instance.
  setPageSizeFromUser: (pageSize: number) => void;
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
  effectiveViewMode: ViewMode;
  cardPagination: NTableCardPagination;
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
  const hasActions = Boolean(
    (state.menuButton && state.openRowMenu) ||
    state.onView || state.onEdit || state.onDelete
  );
  const hasControls = Boolean(state.showColumnVisibility || state.showAddButton || state.showViewToggle);
  // A reload that already has rows on screen is a refresh, not a first load.
  // Tearing the rows down for a skeleton makes a background refetch — a page
  // size correction, a filter change, a poll — look like a full navigation.
  // Keep the rows and mark the region busy; the skeleton is for an empty table.
  const isRefreshing = Boolean(state.isLoading) && hasData;
  const showContent = !state.error && !hasNoData && !isFilteredEmpty && (!state.isLoading || hasData);
  return { hasData, hasNoData, isTableView, isCardView, isJsonView, isFilesView, isCustomMode, hasActions, hasControls, isRefreshing, showContent,
    // Rendered during a first load too, so the bar occupies its height while
    // the skeleton is up. Without it the body is one bar taller than it will be
    // once rows arrive, the measured page size is one row too many, and that
    // row is visibly removed the moment the table loads.
    showPagination: state.showPagination && (showContent || Boolean(state.isLoading)) };
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

/**
 * `seed` becomes part of the store's *initial* state rather than a `set()` call
 * made after creation. Zustand serves `getInitialState()` as the snapshot for
 * server rendering and for the hydration render, so anything applied after
 * creation is invisible on the first paint: `isLoading` would read false while
 * the caller passed true (rendering the empty state instead of the skeleton),
 * and `manualPagination` would read false long enough for layout effects to
 * push a default page size back to a consumer that owns pagination.
 */
export const createTableStore = (seed?: Partial<TableState>) => {
  const store = create<TableState>((set, get) => {
    const defaults = ({
    table: null, data: [], columns: [], filters: [], isLoading: false, error: null, viewMode: "table" as ViewMode,
    showSorting: true, showPagination: true, showColumnVisibility: false, showAddButton: true, showViewToggle: true, toolbarLabels: {}, dynamicHeight: true,
    showContent: false, isTableView: true, isCardView: false, isJsonView: false, isFilesView: false, isCustomMode: false, hasActions: false, hasData: false, hasControls: true, hasNoData: true, isRefreshing: false,
    onView: null, onEdit: null, onDelete: null, onAddClick: null, onRowClick: null, onRowContextMenu: null, onBackgroundContextMenu: null, openRowMenu: null, getRowClassName: null, menuButton: false, onCellClick: null, onBulkDelete: null, onRetry: null, onCellEdit: null, onStateChange: null, getRowId: null, renderToolbar: null,
    CardComponent: null, CardSkeletonComponent: null, className: "", classNames: {}, bordered: undefined, headerClassName: "bg-card", headerColor: undefined, headerTextColor: undefined, borderColor: undefined, showCheckbox: true, selectedRowId: null, headerSlot: null,
    noResultsText: "No results.", filterPlaceholder: "", loadingText: "Loading...", noDataText: "No data available", addButtonText: "",
    pageSizeOptions: [10, 20, 30, 40, 50], calculatedPageSize: 10, calculatedCardPageSize: 0, hasMeasuredLayout: false, skeletonRowCount: 6, maxHeight: null,
    paginationVariant: "numbered" as NTablePaginationVariant, paginationLabels: {},
    bodyWidth: 0, bodyHeight: 0, tableHeaderHeight: 48, cardColumnCount: 1, cardRowHeight: 0, cardGap: 12,
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
    hasNextPage: undefined,
    pagination: { pageIndex: 0, pageSize: 10 },
    isPaginationControlled: false,
    onPaginationChange: null,
    isPageSizeUserSelected: false,
    // Pagination navigation and automatic sizing.
    setPagination: (pagination: { pageIndex: number; pageSize: number }) => {
      const { isPaginationControlled, onPaginationChange } = get();
      onPaginationChange?.(pagination);
      if (!isPaginationControlled) {
        set({ pagination });
      }
    },
    // Rows/page is an explicit request to render that many rows. Keep the
    // bounded NTable body as the scroll viewport instead of letting the
    // dynamic fit measurement replace the reader's choice.
    setPageSizeFromUser: (pageSize: number) => {
      const { isPaginationControlled, onPaginationChange } = get();
      const next = { pageIndex: 0, pageSize };
      set({
        isPageSizeUserSelected: true,
        ...(!isPaginationControlled ? { pagination: next } : {}),
      });
      onPaginationChange?.(next);
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
    effectiveViewMode: "table" as ViewMode,
    cardPagination: { mode: "paged" },
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
    } as unknown) as TableState;

    if (!seed) return defaults;
    const merged = {
      ...defaults,
      ...seed,
      hasSyncedFromProps: "viewMode" in seed,
      hasSyncedPaginationFromProps: "pagination" in seed,
      hasSyncedRowSelectionFromProps: "rowSelection" in seed,
      hasSyncedExpandedFromProps: "expanded" in seed,
      hasSyncedSortingFromProps: "sorting" in seed,
    } as TableState;
    return { ...merged, ...computeFlags(merged) } as TableState;
  });
  return createSelectors(store);
};
