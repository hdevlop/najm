import { useState, useMemo, useLayoutEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, getExpandedRowModel, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState, ExpandedState } from "@tanstack/react-table";
import { createTableStore, type TableState } from "./store";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useTableStore } from "./TableContext";

const ROW_HEIGHT = 56;
const MIN_ROWS = 5;

export function useStoreSync(props: any) {
  const storeRef = useRef<ReturnType<typeof createTableStore> | null>(null);
  const isControlled = props.mode !== undefined;
  const isPaginationControlled = props.pagination !== undefined;
  const isRowSelectionControlled = props.rowSelection !== undefined;
  const isExpandedControlled = props.expanded !== undefined;
  const isSortingControlled = props.sorting !== undefined;

  if (!storeRef.current) {
    storeRef.current = createTableStore();
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
    storeRef.current.getState().syncWithProps(syncSnapshot);
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

export function useDynamicPageSize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const viewMode = useTableStore.use.viewMode();
  const manualPagination = useTableStore.use.manualPagination();
  const syncWithProps = useTableStore.use.syncWithProps();

  useLayoutEffect(() => {
    // Skip dynamic page sizing when manualPagination is enabled (parent owns page size)
    if (!dynamicHeight || !containerRef.current || viewMode !== "table" || manualPagination) return;
    const calculatePageSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const tableHeaderHeight = 40;
      const tableContentHeaderHeight = 48;
      const paginationHeight = 36;
      const gap = 8;
      const parentHeight = container.parentElement?.clientHeight || container.clientHeight;
      const availableHeight = parentHeight - tableHeaderHeight - tableContentHeaderHeight - paginationHeight - gap;
      const calculatedRows = Math.floor(availableHeight / ROW_HEIGHT);
      const newPageSize = Math.max(calculatedRows, MIN_ROWS);
      const calculatedMaxHeight = tableContentHeaderHeight + newPageSize * ROW_HEIGHT;
      syncWithProps({ calculatedPageSize: newPageSize, maxHeight: calculatedMaxHeight });
    };
    calculatePageSize();
    const resizeObserver = new ResizeObserver(calculatePageSize);
    resizeObserver.observe(containerRef.current);
    if (containerRef.current.parentElement) resizeObserver.observe(containerRef.current.parentElement);
    return () => resizeObserver.disconnect();
  }, [dynamicHeight, viewMode, containerRef, syncWithProps, manualPagination]);
}

export function useTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const data = useTableStore.use.data();
  const columns = useTableStore.use.columns();
  const hasActions = useTableStore.use.hasActions();
  const CardComponent = useTableStore.use.CardComponent();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const viewMode = useTableStore.use.viewMode();
  const calculatedPageSize = useTableStore.use.calculatedPageSize();
  const syncWithProps = useTableStore.use.syncWithProps();
  const onStateChange = useTableStore.use.onStateChange();
  const getRowId = useTableStore.use.getRowId();
  // Server-side pagination
  const manualPagination = useTableStore.use.manualPagination();
  const pageCount = useTableStore.use.pageCount();
  const rowCount = useTableStore.use.rowCount();
  const storePagination = useTableStore.use.pagination();
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
    const effectiveColumns = columns.length === 0 && CardComponent ? [{ id: "id", accessorKey: "id", header: "ID" }] : columns;
    if (hasActions) {
      return [
        ...effectiveColumns,
        {
          id: "actions",
          header: "",
          cell: ({ row }: any) => null,
          enableSorting: false,
          enableHiding: false,
        },
      ];
    }
    return effectiveColumns;
  }, [columns, CardComponent, hasActions]);

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
    manualPagination,
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

// Sync table reference to store in useLayoutEffect (not during render) so
  // TablePagination and other consumers can access the table in the same render pass.
  useLayoutEffect(() => {
    syncWithProps({ table });
  }, [table]); // table is stable; syncWithProps reference is stable

  useLayoutEffect(() => {
    // Do not auto-change page size when manualPagination is enabled (parent owns page size)
    if (manualPagination) return;
    if (dynamicHeight && viewMode === "table") table.setPageSize(calculatedPageSize);
    if (viewMode === "cards") table.setPageSize(data.length || 9999);
  }, [calculatedPageSize, dynamicHeight, viewMode, table, data.length, manualPagination]); // table stable, calculatedPageSize/dynamicHeight/viewMode/data drive re-runs

  return { table, finalColumns, sorting, setSorting, columnFilters, setColumnFilters, columnVisibility, setColumnVisibility, globalFilter, setGlobalFilter };
}

export function useTableKeyboard() {
  const table = useTableStore.use.table();
  const onBulkDelete = useTableStore.use.onBulkDelete();
  useKeyboard("ctrl+a", () => { if (table?.getRowModel) table.getRowModel().rows.forEach((row: any) => row.toggleSelected(true)); }, { preventDefault: true });
  useKeyboard("escape", () => { if (table?.toggleAllRowsSelected) table.toggleAllRowsSelected(false); });
  useKeyboard("delete", () => {
    if (!table?.getSelectedRowModel) return;
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length > 0 && onBulkDelete) onBulkDelete(selectedRows.map((row: any) => row.original?.id));
  });
}
