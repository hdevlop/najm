import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, type RefObject } from "react";
import { TableActionCell } from "./TableActionCell";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, getExpandedRowModel, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState, ExpandedState } from "@tanstack/react-table";
import { createTableStore, type TableState } from "./store";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useTableStore } from "./TableContext";
import { filterResponsiveColumns } from "./responsiveColumns";

const ROW_HEIGHT = 56;
const DEFAULT_TABLE_HEADER_HEIGHT = 48;
const DEFAULT_CARD_HEIGHT = 176;
const DEFAULT_CARD_GAP = 12;
const ROOT_SECTION_GAP_COUNT = 2;
/**
 * Long enough to outlast a card growing as its image decodes. Reporting before
 * the content settles measures a short card, fits too many rows, and leaves the
 * grid overflowing its container.
 */
const DYNAMIC_PAGE_SIZE_DEBOUNCE_MS = 800;
/**
 * A very late image can still change the fit after the first report. Allow one
 * correction per container, then stop, so this can never become a loop.
 */
const MAX_PAGE_SIZE_REPORTS_PER_GEOMETRY = 2;
/** Container growth smaller than this is layout noise, not a resize. */
const GEOMETRY_BUCKET_PX = 32;

export function useStoreSync(props: any) {
  const storeRef = useRef<ReturnType<typeof createTableStore> | null>(null);
  const isControlled = props.mode !== undefined;
  const isPaginationControlled = props.pagination !== undefined;
  const isRowSelectionControlled = props.rowSelection !== undefined;
  const isExpandedControlled = props.expanded !== undefined;
  const isSortingControlled = props.sorting !== undefined;

  if (!storeRef.current) {
    // Seed pagination from props.pagination (controlled) or props.defaultPagination (uncontrolled)
    // before useTable reads it in the same render pass. Only include pagination in the initial
    // syncData when a value is actually provided, so hasSyncedPaginationFromProps is not falsely set.
    const syncSnapshot: any = { ...props, isModeControlled: isControlled, isPaginationControlled, isRowSelectionControlled, isExpandedControlled, isSortingControlled };
    delete syncSnapshot.pagination;
    delete syncSnapshot.defaultPagination;
    if (props.pagination !== undefined) syncSnapshot.pagination = props.pagination;
    else if (props.defaultPagination !== undefined) syncSnapshot.pagination = props.defaultPagination;
    // Seed row selection from props.rowSelection (controlled) or props.defaultRowSelection (uncontrolled)
    delete syncSnapshot.rowSelection;
    delete syncSnapshot.defaultRowSelection;
    if (props.rowSelection !== undefined) syncSnapshot.rowSelection = props.rowSelection;
    else if (props.defaultRowSelection !== undefined) syncSnapshot.rowSelection = props.defaultRowSelection;
    // Seed expanded from props.expanded (controlled) or props.defaultExpanded (uncontrolled).
    // Never sync `expanded: undefined` or `defaultExpanded: undefined` into the store.
    delete syncSnapshot.expanded;
    delete syncSnapshot.defaultExpanded;
    if (props.expanded !== undefined) syncSnapshot.expanded = props.expanded;
    else if (props.defaultExpanded !== undefined) syncSnapshot.expanded = props.defaultExpanded;
    // Seed sorting from props.sorting (controlled) or props.defaultSorting (uncontrolled).
    delete syncSnapshot.sorting;
    delete syncSnapshot.defaultSorting;
    if (props.sorting !== undefined) syncSnapshot.sorting = props.sorting;
    else if (props.defaultSorting !== undefined) syncSnapshot.sorting = props.defaultSorting;
    // Passed as initial state, not applied afterwards: zustand serves the
    // initial state as the server and hydration snapshot, so a post-creation
    // set() would leave the first paint reading raw defaults.
    storeRef.current = createTableStore(syncSnapshot);
  }

  useLayoutEffect(() => {
    const syncData: Partial<TableState> = { ...props };
    delete (syncData as any).pagination;
    delete (syncData as any).defaultPagination;
    delete (syncData as any).rowSelection;
    delete (syncData as any).defaultRowSelection;
    delete (syncData as any).expanded;
    delete (syncData as any).defaultExpanded;
    delete (syncData as any).sorting;
    delete (syncData as any).defaultSorting;
    // Sync mode only when controlled (mode prop provided); in uncontrolled mode, only seed on first sync
    const storeState = storeRef.current!.getState();
    if (isControlled) {
      syncData.viewMode = props.mode;
    } else if (!storeState.hasSyncedFromProps) {
      // Seed defaultMode only on first sync in uncontrolled mode
      syncData.viewMode = props.defaultMode ?? "table";
    }
    // Omit viewMode in uncontrolled mode after first sync to preserve user selection
    if (!isControlled && storeState.hasSyncedFromProps) {
      delete syncData.viewMode;
    }
    // Sync pagination only when controlled, or for the first uncontrolled seed.
    // Do NOT include pagination: undefined in syncData (would reset store pagination).
    if (isPaginationControlled) {
      syncData.pagination = props.pagination;
    } else if (!storeState.hasSyncedPaginationFromProps && props.defaultPagination !== undefined) {
      syncData.pagination = props.defaultPagination;
    }
    // Sync row selection only when controlled, or for the first uncontrolled seed.
    if (isRowSelectionControlled) {
      syncData.rowSelection = props.rowSelection;
    } else if (!storeState.hasSyncedRowSelectionFromProps && props.defaultRowSelection !== undefined) {
      syncData.rowSelection = props.defaultRowSelection;
    }
    // Sync expanded only when controlled, or for the first uncontrolled seed.
    if (isExpandedControlled) {
      syncData.expanded = props.expanded;
    } else if (!storeState.hasSyncedExpandedFromProps && props.defaultExpanded !== undefined) {
      syncData.expanded = props.defaultExpanded;
    }
    // Sync sorting only when controlled, or for the first uncontrolled seed.
    if (isSortingControlled) {
      syncData.sorting = props.sorting;
    } else if (!storeState.hasSyncedSortingFromProps && props.defaultSorting !== undefined) {
      syncData.sorting = props.defaultSorting;
    }
    (syncData as any).isExpandedControlled = isExpandedControlled;
    (syncData as any).isSortingControlled = isSortingControlled;
    // Don't pass hasSyncedPaginationFromProps in syncData; syncWithProps computes it
    storeRef.current!.getState().syncWithProps(syncData);
  }, [props, isControlled, isPaginationControlled, isRowSelectionControlled, isExpandedControlled, isSortingControlled]);

  return storeRef.current;
}

export interface CalculateDynamicPageSizeInput {
  bodyHeight: number;
  tableHeaderHeight: number;
  rowHeight?: number;
}

/**
 * Pure helper that converts a measured body area into a safe page size.
 * Exported for unit testing.
 */
export function calculateDynamicPageSize(input: CalculateDynamicPageSizeInput): number {
  const rowHeight = input.rowHeight ?? ROW_HEIGHT;
  const availableRowsHeight = input.bodyHeight - input.tableHeaderHeight;
  if (availableRowsHeight <= 0) return 1;
  return Math.max(1, Math.floor(availableRowsHeight / rowHeight));
}

export interface CalculateCardSkeletonCountInput {
  bodyHeight: number;
  columnCount: number;
  cardHeight?: number;
  gap?: number;
}

export function calculateCardSkeletonCount(input: CalculateCardSkeletonCountInput): number {
  const columns = Math.max(1, Math.floor(input.columnCount));
  const cardHeight = Math.max(1, input.cardHeight ?? DEFAULT_CARD_HEIGHT);
  const gap = Math.max(0, input.gap ?? DEFAULT_CARD_GAP);
  if (input.bodyHeight <= 0) return columns;
  const rows = Math.max(1, Math.ceil((input.bodyHeight + gap) / (cardHeight + gap)));
  return rows * columns;
}

/**
 * Page size for a card grid: whole card rows only.
 *
 * Deliberately floors, unlike `calculateCardSkeletonCount`, which ceils.
 * Overfilling is harmless for placeholders but a page sized past the container
 * pushes a partial row out of view and reintroduces an inner scrollbar.
 */
export function calculateCardPageSize(input: CalculateCardSkeletonCountInput): number {
  const columns = Math.max(1, input.columnCount || 1);
  const cardHeight = Math.max(1, input.cardHeight ?? DEFAULT_CARD_HEIGHT);
  const gap = Math.max(0, input.gap ?? DEFAULT_CARD_GAP);
  if (input.bodyHeight <= 0) return columns;
  const rows = Math.max(1, Math.floor((input.bodyHeight + gap) / (cardHeight + gap)));
  return rows * columns;
}

/**
 * Generic card placeholders cannot predict the height of a consumer card.
 * Wait for real rows so their first layout measurement owns the first page
 * size that can be painted. Table placeholders are safe because table rows
 * have a fixed shared geometry.
 */
export function shouldDeferCardPageSizeUntilRows(
  renderedMode: TableState["viewMode"],
  hasDataRows: boolean,
): boolean {
  return renderedMode === "cards" && !hasDataRows;
}

export function shouldCommitDynamicPageSizeImmediately(
  reportedMode: TableState["viewMode"] | null,
  renderedMode: TableState["viewMode"],
): boolean {
  return reportedMode === null || reportedMode !== renderedMode;
}

function fallbackCardColumns(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function useDynamicPageSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  effectiveViewMode?: TableState["viewMode"],
) {
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const viewMode = useTableStore.use.effectiveViewMode();
  const manualPagination = useTableStore.use.manualPagination();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const hasDataRows = useTableStore.use.hasData();
  const isFilteredEmpty = useTableStore.use.isFilteredEmpty();
  const syncWithProps = useTableStore.use.syncWithProps();
  const lastMeasurementRef = useRef("");

  useLayoutEffect(() => {
    if (!dynamicHeight || !containerRef.current) return;

    const calculatePageSize = () => {
      const container = containerRef.current;
      if (!container) return;

      // The empty and error states deliberately hide the toolbar and the
      // pagination bar, so the body measures taller then than it ever will with
      // rows in it. Measuring in that state produces a page size for a layout
      // the table is only passing through — and that page size is still in
      // force when rows arrive, which is exactly what makes the first page
      // correct itself a moment after it renders. A list that empties and
      // refills passes through here every time. Loading is not one of these
      // states: the skeleton is an overlay and the chrome stays put, so a first
      // load measures the same geometry the rows will land in.
      if (error || (hasNoData && !isFilteredEmpty && !isLoading)) return;

      const bodyEl = container.querySelector<HTMLElement>("[data-ntable-body]");
      const tableHeaderEl = container.querySelector<HTMLElement>("[data-ntable-table-header]");
      // `responsiveSkeleton` emits both shapes and hides one in CSS, so take
      // the grid that is actually laid out. A `display: none` grid reports zero
      // for every box measurement and would poison the card height.
      const cardsGridEl = Array.from(
        container.querySelectorAll<HTMLElement>(
          "[data-ntable-loading-cards-grid], [data-ntable-cards-grid]",
        ),
      ).find((el) => el.clientHeight > 0 || el.clientWidth > 0) ?? null;

      let bodyHeight = bodyEl?.clientHeight ?? 0;
      const bodyWidth = bodyEl?.clientWidth ?? container.clientWidth ?? 0;

      // Fallback: subtract measured header/pagination from root if body slot is
      // not yet measurable (e.g. before the first layout pass).
      if (!bodyHeight) {
        const rootHeight = container.clientHeight;
        const headerHeight = container.querySelector<HTMLElement>("[data-ntable-header]")?.offsetHeight ?? 0;
        const paginationHeight = container.querySelector<HTMLElement>("[data-ntable-pagination]")?.offsetHeight ?? 0;
        const rootStyles = window.getComputedStyle(container);
        const gap = Number.parseFloat(rootStyles.rowGap || (rootStyles as any).gap || "0") || 0;
        bodyHeight = rootHeight - headerHeight - paginationHeight - gap * ROOT_SECTION_GAP_COUNT;
      }

      // Nothing is subtracted for the loading state: the skeleton is an overlay
      // and takes no space, so the body measured during a load is the body the
      // rows will occupy.
      const tableHeaderHeight = tableHeaderEl?.offsetHeight ?? DEFAULT_TABLE_HEADER_HEIGHT;
      const newPageSize = calculateDynamicPageSize({ bodyHeight, tableHeaderHeight });
      const calculatedMaxHeight = tableHeaderHeight + newPageSize * ROW_HEIGHT;
      const gridStyles = cardsGridEl ? window.getComputedStyle(cardsGridEl) : null;
      const gridTemplateColumns = gridStyles?.gridTemplateColumns;
      const gridColumns = gridTemplateColumns && gridTemplateColumns !== "none"
        ? gridTemplateColumns.split(" ").filter(Boolean).length
        : 0;
      const cardColumnCount = gridColumns || fallbackCardColumns(bodyWidth);
      const cardGap = Number.parseFloat(gridStyles?.rowGap || gridStyles?.gap || "") || DEFAULT_CARD_GAP;
      const firstCard = cardsGridEl?.querySelector<HTMLElement>("[data-ntable-loading-card], [data-row]");
      const cardRowHeight = firstCard?.offsetHeight || firstCard?.getBoundingClientRect().height || DEFAULT_CARD_HEIGHT;
      const measuredMode = effectiveViewMode ?? viewMode;
      const cardPageSize = shouldDeferCardPageSizeUntilRows(measuredMode, hasDataRows)
        ? 0
        : calculateCardPageSize({
            bodyHeight,
            columnCount: cardColumnCount,
            cardHeight: cardRowHeight,
            gap: cardGap,
          });
      const updates = {
        // Measured page sizes are published in both pagination modes. Manual
        // pagination consumes them through onPaginationChange rather than by
        // mutating the table directly, so the consumer still owns fetching.
        calculatedPageSize: newPageSize,
        calculatedCardPageSize: cardPageSize,
        // Distinguishes a real measurement from the seeded defaults, so a page
        // size is never reported before the container has been measured.
        hasMeasuredLayout: bodyHeight > 0,
        ...(!manualPagination ? { maxHeight: calculatedMaxHeight } : {}),
        skeletonRowCount: newPageSize,
        bodyWidth,
        bodyHeight,
        tableHeaderHeight,
        cardColumnCount,
        cardRowHeight,
        cardGap,
      };
      const fingerprint = JSON.stringify(updates);
      if (fingerprint !== lastMeasurementRef.current) {
        lastMeasurementRef.current = fingerprint;
        syncWithProps(updates);
      }
    };

    calculatePageSize();

    const resizeObserver = new ResizeObserver(calculatePageSize);
    const container = containerRef.current;
    resizeObserver.observe(container);
    container.querySelectorAll<HTMLElement>(
      "[data-ntable-header], [data-ntable-body], [data-ntable-pagination], [data-ntable-table-header]"
    ).forEach((el) => resizeObserver.observe(el));
    container.querySelectorAll<HTMLElement>(
      "[data-ntable-loading-cards-grid], [data-ntable-loading-card], [data-ntable-cards-grid]"
    ).forEach((el) => resizeObserver.observe(el));
    if (container.parentElement) resizeObserver.observe(container.parentElement);

    return () => resizeObserver.disconnect();
  }, [dynamicHeight, effectiveViewMode, viewMode, containerRef, syncWithProps, manualPagination, isLoading, error, hasNoData, hasDataRows, isFilteredEmpty]);
}

export function useTable(effectiveViewModeOverride?: TableState["viewMode"]) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const data = useTableStore.use.data();
  const columns = useTableStore.use.columns();
  const hasActions = useTableStore.use.hasActions();
  const onView = useTableStore.use.onView();
  const onEdit = useTableStore.use.onEdit();
  const onDelete = useTableStore.use.onDelete();
  const openRowMenu = useTableStore.use.openRowMenu();
  const menuButton = useTableStore.use.menuButton();
  const bordered = useTableStore.use.bordered();
  const CardComponent = useTableStore.use.CardComponent();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const viewMode = useTableStore.use.viewMode();
  const effectiveViewMode = useTableStore.use.effectiveViewMode();
  const cardPagination = useTableStore.use.cardPagination();
  const calculatedPageSize = useTableStore.use.calculatedPageSize();
  const calculatedCardPageSize = useTableStore.use.calculatedCardPageSize();
  const measuredBodyHeight = useTableStore.use.bodyHeight();
  const measuredBodyWidth = useTableStore.use.bodyWidth();
  const hasMeasuredLayout = useTableStore.use.hasMeasuredLayout();
  const syncWithProps = useTableStore.use.syncWithProps();
  const onStateChange = useTableStore.use.onStateChange();
  const getRowId = useTableStore.use.getRowId();
  // Server-side pagination
  const manualPagination = useTableStore.use.manualPagination();
  /** Rows on screen. Distinguishes a first load from a resize. */
  const hasDataRows = useTableStore.use.hasData();
  const pageCount = useTableStore.use.pageCount();
  const rowCount = useTableStore.use.rowCount();
  const storePagination = useTableStore.use.pagination();
  const isPaginationControlled = useTableStore.use.isPaginationControlled();
  const isPageSizeUserSelected = useTableStore.use.isPageSizeUserSelected();
  const setPagination = useTableStore.use.setPagination();
  // Row selection - store-driven
  const storeRowSelection = useTableStore.use.rowSelection();
  const setRowSelection = useTableStore.use.setRowSelection();
  // Sorting - store-driven when controlled, internal useState when uncontrolled
  const storeSorting = useTableStore.use.sorting();
  const storeSetSorting = useTableStore.use.setSorting();
  const isSortingControlled = useTableStore.use.isSortingControlled();
  // Expansion - store-driven
  const storeExpanded = useTableStore.use.expanded();
  const setExpanded = useTableStore.use.setExpanded();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();
  const renderSubRow = useTableStore.use.renderSubRow();

  const finalColumns = useMemo(() => {
    const responsiveColumns = filterResponsiveColumns(columns);
    // Only fall back to a synthetic ID column when the caller supplied NO columns.
    // All-supplied columns gated by `meta.visible: false` must NOT produce an
    // unintended ID column.
    const callerProvidedColumns = columns.length > 0;
    const effectiveColumns =
      responsiveColumns.length === 0 && !callerProvidedColumns && CardComponent
        ? [{ id: "id", accessorKey: "id", header: "ID" }]
        : responsiveColumns;
    if (hasActions) {
      const isMenuActions = Boolean(menuButton && openRowMenu);
      return [
        ...effectiveColumns,
        {
          id: "actions",
          header: () => isMenuActions
            ? null
            : React.createElement("div", { className: "flex w-full justify-start text-left" }, "Actions"),
          cell: ({ row }: any) => React.createElement(TableActionCell, { row, onView, onEdit, onDelete, openRowMenu, menuButton, bordered }),
          enableSorting: false,
          enableHiding: false,
        },
      ];
    }
    return effectiveColumns;
  }, [columns, CardComponent, hasActions, onView, onEdit, onDelete, openRowMenu, menuButton, bordered]);

  const notifyStateChange = useCallback((state: { sorting: SortingState; columnFilters: ColumnFiltersState; columnVisibility: VisibilityState; rowSelection: RowSelectionState; globalFilter: string }) => {
    onStateChange?.(state);
  }, [onStateChange]);

const handleSortingChange = useCallback((updaterOrValue: any) => {
    // TanStack passes an updater function; resolve against the current store sorting when controlled
    const base = isSortingControlled ? storeSorting : sorting;
    const next = typeof updaterOrValue === "function" ? updaterOrValue(base) : updaterOrValue;
    if (isSortingControlled) {
      storeSetSorting(next);
    } else {
      setSorting(next);
    }
    notifyStateChange({ sorting: next, columnFilters, columnVisibility, rowSelection: storeRowSelection, globalFilter });
  }, [sorting, storeSorting, isSortingControlled, storeSetSorting, columnFilters, columnVisibility, storeRowSelection, globalFilter, notifyStateChange]);

  // Seed local sorting from store when uncontrolled and store has defaultSorting.
  // Without this, TanStack would always start with sorting=[] (empty) ignoring defaultSorting.
  const hasSeededSortingFromDefault = useRef(false);
  useLayoutEffect(() => {
    if (!isSortingControlled && !hasSeededSortingFromDefault.current) {
      if (storeSorting.length > 0) {
        setSorting(storeSorting);
      }
      hasSeededSortingFromDefault.current = true;
    }
  }, [isSortingControlled, storeSorting]);

  const handleColumnFiltersChange = useCallback((updater: any) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater;
    setColumnFilters(next);
    notifyStateChange({ sorting, columnFilters: next, columnVisibility, rowSelection: storeRowSelection, globalFilter });
  }, [sorting, columnFilters, columnVisibility, storeRowSelection, globalFilter, notifyStateChange]);

  const handleColumnVisibilityChange = useCallback((updater: any) => {
    const next = typeof updater === "function" ? updater(columnVisibility) : updater;
    setColumnVisibility(next);
    notifyStateChange({ sorting, columnFilters, columnVisibility: next, rowSelection: storeRowSelection, globalFilter });
  }, [sorting, columnFilters, columnVisibility, storeRowSelection, globalFilter, notifyStateChange]);

  const handleRowSelectionChange = useCallback((updaterOrValue: any) => {
    const base = storeRowSelection;
    const next = typeof updaterOrValue === "function" ? updaterOrValue(base) : updaterOrValue;
    setRowSelection(next);
    notifyStateChange({ sorting, columnFilters, columnVisibility, rowSelection: next, globalFilter });
  }, [storeRowSelection, setRowSelection, sorting, columnFilters, columnVisibility, globalFilter, notifyStateChange]);

  const handleGlobalFilterChange = useCallback((updater: any) => {
    const next = typeof updater === "function" ? updater(globalFilter) : updater;
    setGlobalFilter(next);
    notifyStateChange({ sorting, columnFilters, columnVisibility, rowSelection: storeRowSelection, globalFilter: next });
  }, [sorting, columnFilters, columnVisibility, storeRowSelection, globalFilter, notifyStateChange]);

  const handleExpandedChange = useCallback((updaterOrValue: any) => {
    const next = typeof updaterOrValue === "function" ? updaterOrValue(storeExpanded) : updaterOrValue;
    setExpanded(next);
  }, [storeExpanded, setExpanded]);

  const handlePaginationChange = useCallback((updaterOrValue: any) => {
    // Apply TanStack updater function against the current store pagination.
    // TanStack updater: old => ({ ...newPage }) where newPage = old.pageIndex + 1
    const next = typeof updaterOrValue === "function"
      ? updaterOrValue(storePagination)
      : updaterOrValue;
    // setPagination is the single user-intent API; it handles controlled vs uncontrolled internally.
    setPagination(next);
    notifyStateChange({ sorting, columnFilters, columnVisibility, rowSelection: storeRowSelection, globalFilter });
  }, [storePagination, storeRowSelection, setPagination, sorting, columnFilters, columnVisibility, globalFilter, notifyStateChange]);

  // TanStack receives store pagination as controlled state via state.pagination.
  // Store default is always { pageIndex: 0, pageSize: 10 }, so this is never undefined.
  const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);
  const renderedMode = effectiveViewModeOverride ?? effectiveViewMode ?? viewMode;
  // `all` renders the supplied set whole in either view mode; the continuation
  // modes only apply while cards are rendered.
  const renderAllSuppliedRows = cardPagination.mode === "all"
    || (renderedMode === "cards" && cardPagination.mode !== "paged");
  const tableConfig: any = {
    data, columns: finalColumns,
    state: { sorting: isSortingControlled ? storeSorting : sorting, columnFilters, columnVisibility, rowSelection: storeRowSelection ?? {}, globalFilter, pagination: storePagination, expanded: storeExpanded ?? {} },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: handleRowSelectionChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: handlePaginationChange,
    onExpandedChange: handleExpandedChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: manualPagination || renderAllSuppliedRows,
    pageCount,
    rowCount,
  };

  if (getRowId) tableConfig.getRowId = getRowId;
  if (hasExpansion) {
    // Public callback takes the user-facing row data; TanStack passes the internal Row.
    tableConfig.getRowCanExpand = userGetRowCanExpand
      ? (row: any) => userGetRowCanExpand(row.original)
      : () => true;
  }

  const table = useReactTable(tableConfig);

  // The table instance is published on the first render, not from an effect.
  //
  // Half the shell is gated on it: `NTablePagination` returns null without a
  // table, the real `<thead>` lives in `NTableContent`, and every column filter
  // resolves through it. Publishing it from a layout effect means the first
  // commit — the one `useDynamicPageSize` measures — has no pagination bar and
  // no header row, so the body measures tall by exactly that chrome and the
  // page size lands one row over. Seeding during render is safe here: the
  // subscribers are children of this component and have not rendered yet, so
  // the write lands before they first read.
  const hasSeededTableRef = useRef(false);
  if (!hasSeededTableRef.current) {
    hasSeededTableRef.current = true;
    syncWithProps({ table });
  }
  useLayoutEffect(() => {
    syncWithProps({ table });
  }, [table]); // table is stable; syncWithProps reference is stable

  useLayoutEffect(() => {
    // Never mutate pagination the caller owns. `manualPagination` alone is not
    // enough: it can still read false on an early pass while the store settles,
    // and mutating the table here calls straight through to the consumer's
    // onPaginationChange, overriding the pageSize they passed in. A controlled
    // `pagination` prop is the durable signal. The measured size is reported
    // below instead.
    if (manualPagination || isPaginationControlled || isPageSizeUserSelected) return;
    if (dynamicHeight && renderedMode === "table") table.setPageSize(calculatedPageSize);
    if (viewMode === "cards" && cardPagination.mode === "paged") {
      table.setPageSize(data.length || 9999);
    }
  }, [calculatedPageSize, dynamicHeight, renderedMode, viewMode, cardPagination.mode, table, data.length, manualPagination, isPaginationControlled, isPageSizeUserSelected]); // table stable, layout/data drive re-runs

  // Server-paginated tables still fill their container: report the measured
  // page size through the ordinary pagination callback, debounced so a window
  // resize cannot issue a request per animation frame.
  const dynamicPageSizeTarget = renderedMode === "cards" ? calculatedCardPageSize : calculatedPageSize;
  /*
   * Reporting a measured page size to a server-paginated consumer refetches, so
   * every extra report is a wasted request and a visible skeleton. Three things
   * made this fire repeatedly on one mount:
   *
   * 1. `calculatedPageSize` has a non-zero store default, so a report could be
   *    sent before anything had actually been measured. `hasMeasuredLayout`
   *    gates on a real measurement instead of on a plausible-looking default.
   * 2. The view mode settles after the first paint. Keying on it meant a report
   *    in table mode, then a second one once cards resolved. The key ignores the
   *    mode; the debounce below outlives the transition, and the target is read
   *    at fire time, so the settled mode wins.
   * 3. Card height is measured from rendered cards and grows as images decode,
   *    which nudges the container by a pixel or two. Geometry is bucketed so
   *    only a real resize re-arms a report.
   *
   * The timer restarts on every dependency change, so a report is sent once the
   * measurement has been quiet for the debounce window rather than on the first
   * value seen.
   */
  const geometryKey = `${Math.round(measuredBodyWidth / GEOMETRY_BUCKET_PX)}x`
    + `${Math.round(measuredBodyHeight / GEOMETRY_BUCKET_PX)}`;
  const reportedGeometryRef = useRef<{
    key: string;
    count: number;
    target: number;
    mode: TableState["viewMode"];
  } | null>(null);
  useLayoutEffect(() => {
    if (!manualPagination || !dynamicHeight || isPageSizeUserSelected) return;
    if (cardPagination.mode !== "paged") return;
    if (!hasMeasuredLayout || measuredBodyHeight <= 0) return;
    if (!dynamicPageSizeTarget || dynamicPageSizeTarget < 1) return;
    if (dynamicPageSizeTarget === storePagination.pageSize) return;
    if (shouldDeferCardPageSizeUntilRows(renderedMode, hasDataRows)) return;
    const reported = reportedGeometryRef.current;
    // Saying the same thing twice is not a second report. The effect re-runs
    // many times over one load, and while the caller has not applied the size
    // yet the target still differs from the store on every one of them — so
    // without this, repeated identical commits burn the whole budget below and
    // the report that matters is refused.
    if (reported?.key === geometryKey
      && reported.mode === renderedMode
      && reported.target === dynamicPageSizeTarget) return;
    if (reported?.key === geometryKey
      && reported.mode === renderedMode
      && reported.count >= MAX_PAGE_SIZE_REPORTS_PER_GEOMETRY) return;
    const commit = () => {
      const current = reportedGeometryRef.current;
      reportedGeometryRef.current = current?.key === geometryKey && current.mode === renderedMode
        ? { key: geometryKey, count: current.count + 1, target: dynamicPageSizeTarget, mode: renderedMode }
        : { key: geometryKey, count: 1, target: dynamicPageSizeTarget, mode: renderedMode };
      setPagination({ pageIndex: storePagination.pageIndex, pageSize: dynamicPageSizeTarget });
    };

    // The first report and every discrete view-mode change are committed
    // synchronously, before the browser paints. Card placeholders return above
    // until real rows exist, so their generic height can never become a report.
    // Measurement already runs in a layout effect, but deferring the report by
    // even one task lets a frame paint at the seeded page size — a skeleton or
    // a cached list rendering 25 rows, clipped to whatever fits, then snapping
    // to the 12 that belong there. Committing here means the only page size
    // ever painted is the measured one.
    if (shouldCommitDynamicPageSizeImmediately(reported?.mode ?? null, renderedMode)) {
      commit();
      return;
    }

    // Later reports are resizes. The debounce is what keeps a window drag from
    // reporting a new page size every animation frame.
    const timer = setTimeout(commit, DYNAMIC_PAGE_SIZE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    manualPagination,
    dynamicHeight,
    isPageSizeUserSelected,
    cardPagination.mode,
    hasMeasuredLayout,
    measuredBodyHeight,
    geometryKey,
    dynamicPageSizeTarget,
    storePagination.pageIndex,
    storePagination.pageSize,
    renderedMode,
    hasDataRows,
    setPagination,
  ]);

  return { table, finalColumns, sorting, setSorting, columnFilters, setColumnFilters, columnVisibility, setColumnVisibility, globalFilter, setGlobalFilter };
}

export interface UseTableKeyboardOptions {
  /**
   * When provided, only fire shortcuts while the keydown target is inside
   * this element. Without it, shortcuts are global and would conflict between
   * multiple NTable instances on the same page.
   */
  scopeRef?: RefObject<HTMLElement | null>;
  /** Close the NTable right-click context menu (if any). */
  contextMenuClose?: () => void;
  /** True while the NTable context menu is open. */
  contextMenuOpen?: boolean;
}

export function useTableKeyboard(options: UseTableKeyboardOptions = {}) {
  const { scopeRef, contextMenuClose, contextMenuOpen } = options;
  const table = useTableStore.use.table();
  const onBulkDelete = useTableStore.use.onBulkDelete();

  useKeyboard(
    "ctrl+a",
    () => {
      // Use the page-level helper so behavior matches the header
      // "Select all rows" checkbox: only rows visible on the current page
      // are marked (respecting both filtering and pagination).
      table?.toggleAllPageRowsSelected?.(true);
    },
    { preventDefault: true, scopeRef }
  );

  useKeyboard(
    "escape",
    () => {
      if (contextMenuOpen && contextMenuClose) contextMenuClose();
      const hasSelection = table?.getIsSomeRowsSelected?.() || table?.getIsAllRowsSelected?.();
      if (hasSelection) table?.toggleAllRowsSelected?.(false);
    },
    { scopeRef }
  );

  const fireBulkDelete = () => {
    if (!table?.getSelectedRowModel) return;
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length > 0 && onBulkDelete) {
      onBulkDelete(selectedRows.map((row: any) => row.original?.id));
    }
  };

  useKeyboard("delete", fireBulkDelete, { scopeRef, preventDefault: true });
  useKeyboard("backspace", fireBulkDelete, { scopeRef, preventDefault: true });
}
