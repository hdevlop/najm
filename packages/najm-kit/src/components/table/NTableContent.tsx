import React, { useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import { NajmScroll } from "../ui/scroll";
import { flexRender } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import { useTableSurfaceAppearance } from "./tableSurface";
import { resolveHiddenBelowClass } from "./responsiveColumns";
import {
  DEFAULT_TABLE_BORDER_COLOR,
  DEFAULT_TABLE_HEADER_COLOR,
  DEFAULT_TABLE_HEADER_TEXT_COLOR,
  resolveTableColor,
} from "./tableColors";

const ROW_CONTEXT_HANDLED = "__ntableRowContextHandled";

function EditableCell({ cell, onCellEdit }: { cell: any; onCellEdit: (row: any, columnId: string, value: any) => Promise<any> | any }) {
  const columnDef = cell.column.columnDef as any;
  const meta = columnDef.meta || {};
  const row = cell.row.original;
  const columnId = cell.column.id;
  const editor: string = meta.editor || "text";
  const initial = cell.getValue();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState<any>(initial);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (!editing) setValue(initial); }, [initial, editing]);

  const commit = async (next: any) => {
    if (next === initial) { setEditing(false); return; }
    setSaving(true);
    try { await onCellEdit(row, columnId, next); setEditing(false); }
    catch { setValue(initial); setEditing(false); }
    finally { setSaving(false); }
  };

  if (!editing && editor !== "checkbox" && editor !== "select") {
    return (
      <div className={cn("min-h-8 -mx-2 px-2 py-1 rounded cursor-text", "hover:bg-muted/60 hover:ring-1 hover:ring-border")} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
        {flexRender(columnDef.cell, cell.getContext())}
        {saving && <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="invisible truncate">{flexRender(columnDef.cell, cell.getContext())}</div>
      <input autoFocus value={value ?? ""} onChange={(e) => setValue(e.target.value)} onBlur={() => commit(value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(value); } if (e.key === "Escape") { setValue(initial); setEditing(false); } }} className="absolute inset-0 h-full w-full px-2 text-sm" />
    </div>
  );
}

export function NTableContent({ effectiveMode }: { effectiveMode?: string }) {
  const table = useTableStore.use.table();
  const storeIsTableView = useTableStore.use.isTableView();
  const columns = useTableStore.use.columns();
  const showSorting = useTableStore.use.showSorting();
  const noResultsText = useTableStore.use.noResultsText();
  const headerClassName = useTableStore.use.headerClassName();
  const headerColor = useTableStore.use.headerColor();
  const headerTextColor = useTableStore.use.headerTextColor();
  const tableBorderColor = useTableStore.use.borderColor();
  const resolvedHeaderColor = resolveTableColor(headerColor, DEFAULT_TABLE_HEADER_COLOR);
  const resolvedHeaderTextColor = resolveTableColor(headerTextColor, DEFAULT_TABLE_HEADER_TEXT_COLOR);
  const resolvedBorderColor = resolveTableColor(tableBorderColor, DEFAULT_TABLE_BORDER_COLOR);
  const headerCellStyle: React.CSSProperties = {
    backgroundColor: resolvedHeaderColor,
    color: resolvedHeaderTextColor,
  };
  const rowBorderStyle: React.CSSProperties | undefined = tableBorderColor
    ? { borderColor: resolvedBorderColor }
    : undefined;
  const onRowClick = useTableStore.use.onRowClick();
  const onRowContextMenu = useTableStore.use.onRowContextMenu();
  const onBackgroundContextMenu = useTableStore.use.onBackgroundContextMenu();
  const getRowClassName = useTableStore.use.getRowClassName();
  const onCellEdit = useTableStore.use.onCellEdit();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const contentDynamicHeight = useTableStore.use.dynamicHeight();
  const contentManualPagination = useTableStore.use.manualPagination();
  const contentCardPagination = useTableStore.use.cardPagination();
  const contentCalculatedPageSize = useTableStore.use.calculatedPageSize();
  const contentHasMeasuredLayout = useTableStore.use.hasMeasuredLayout();
  const hasNoData = useTableStore.use.hasNoData();
  const showContent = useTableStore.use.showContent();
  const classNames = useTableStore.use.classNames();
  const bordered = useTableStore.use.bordered();
  const surface = useTableSurfaceAppearance(bordered, tableBorderColor);
  const showCheckbox = useTableStore.use.showCheckbox();
  const selectedRowId = useTableStore.use.selectedRowId();
  const renderSubRow = useTableStore.use.renderSubRow();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();
  const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    if ((e.nativeEvent as any)[ROW_CONTEXT_HANDLED]) return;
    const target = e.target as HTMLElement;
    if (target.closest("tr[data-row]")) return;
    if (onBackgroundContextMenu) {
      onBackgroundContextMenu(e);
    }
  }, [onBackgroundContextMenu]);

  // `showContent` already accounts for loading: it stays true through a reload
  // that has rows, so a refresh keeps the rows instead of blanking them.
  if (error || hasNoData || !showContent || !table) return null;
  const isTableView = effectiveMode ? effectiveMode === "table" : storeIsTableView;
  if (!isTableView) return null;

  /*
   * Never paint more rows than the container was measured to hold.
   *
   * A server-paginated caller cannot apply a measured page size in the same
   * render it is told about it: NTable reports, the caller re-fetches or
   * re-slices, and a render later the right number of rows arrives. Until then
   * the rows on hand are for the page size the caller started with — 25 of them
   * into a body that fits 12 — and the overflow is clipped mid-row, which is
   * the "13 rows for a moment, then 12" flash.
   *
   * Clipping is presentational, so the fix is too: render the rows that fit and
   * leave the rest for the page they belong to. When the caller catches up,
   * nothing moves, because it was already showing the right number.
   *
   * Only applies where a page size was actually measured and NTable is the one
   * that chose it. `all` and the card continuation modes deliberately render
   * everything they are given.
   */
  const allRows = table.getRowModel().rows ?? [];
  const clampRowsToMeasuredPage = contentDynamicHeight
    && contentManualPagination
    && contentCardPagination.mode === "paged"
    && contentHasMeasuredLayout
    && contentCalculatedPageSize > 0;
  const visibleRows = clampRowsToMeasuredPage
    ? allRows.slice(0, contentCalculatedPageSize)
    : allRows;

  const getSortIcon = (column: any) => {
    const dir = column.getIsSorted() as string;
    if (dir === "asc") return <ArrowUp className="h-4 w-4" />;
    if (dir === "desc") return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  return (
    <NajmScroll
      axis="both"
      data-bordered={bordered === false ? "false" : bordered ? "true" : undefined}
      className={cn(
        "min-h-0 overflow-hidden rounded-md",
        // Under `dynamicHeight` the page size is the largest row count that
        // fits, so the rows are always a little shorter than the space they
        // were measured against — up to one row's worth. Growing into that
        // remainder leaves the container's bottom edge floating below the last
        // row. Sizing to content instead ends the border on the last row; the
        // leftover belongs to the page, not to the table. Without
        // `dynamicHeight` the row count is the caller's, so the container has
        // to keep filling its height to stay a scroll viewport.
        contentDynamicHeight ? "max-h-full shrink" : "flex-1",
        surface.className,
        classNames?.content
      )}
      style={surface.style}
      onContextMenu={handleBackgroundContextMenu}
    >
      {/*
        Fixed layout, so a column's width comes from its definition rather than
        from whatever happens to be inside it.

        Under the browser's default auto layout the widths are a function of the
        cell contents, which means the skeleton — fixed-width placeholder bars —
        and the real rows — text of every length — lay out differently, and the
        columns visibly jump when the rows arrive. It also means the widths shift
        between pages as the longest value in each column changes. `size` on a
        column definition is honoured; the rest share what is left.
      */}
      <Table className="table-fixed">
        <TableHeader data-ntable-table-header className={cn("bg-card sticky top-0 z-10", headerClassName, bordered === true && "[&_tr]:border-border", classNames?.tableHeader)}>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} style={rowBorderStyle} className={cn("hover:bg-transparent", bordered === true && "border-border")}>
              {showCheckbox && (
                <TableHead
                  className="w-10 text-foreground h-12 text-center"
                  style={headerCellStyle}
                >
                  <Checkbox
                    aria-label="Select all rows"
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                  />
                </TableHead>
              )}
              {hasExpansion && (
                <TableHead
                  aria-label="Expand column"
                  className="w-10 text-foreground h-12"
                  style={headerCellStyle}
                />
              )}
              {hg.headers.map((header) => {
                const headerMeta = (header.column.columnDef as any).meta || {};
                const responsiveClass = resolveHiddenBelowClass(headerMeta.hiddenBelow);
                return (
                  <TableHead
                    key={header.id}
                    // A fixed column cannot grow to fit its label, so an
                    // over-long one is clipped rather than allowed to spill
                    // into its neighbour.
                    className={cn("text-foreground h-12 overflow-hidden text-ellipsis", responsiveClass)}
                    style={headerCellStyle}
                  >
                    {header.isPlaceholder ? null : (
                      <div className={cn("flex items-center gap-2", header.column.getCanSort() && showSorting && "cursor-pointer select-none")} onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && showSorting && <span>{getSortIcon(header.column)}</span>}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.length ? (
            visibleRows.map((row) => {
              const isSelectedByRowId = Boolean(selectedRowId && row.original?.id === selectedRowId);
              const canExpand = hasExpansion && row.getCanExpand();
              const isExpanded = canExpand && row.getIsExpanded();
              const totalCols = row.getVisibleCells().length + (showCheckbox ? 1 : 0) + (hasExpansion ? 1 : 0);
              const rowClassName = getRowClassName?.(row.original);
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-row="true"
                    data-row-id={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    data-selected-row={isSelectedByRowId ? "true" : undefined}
                    onClick={() => onRowClick?.(row.original)}
                    onContextMenu={onRowContextMenu ? (e) => {
                      (e.nativeEvent as any)[ROW_CONTEXT_HANDLED] = true;
                      onRowContextMenu(e, row.original);
                    } : undefined}
                    style={rowBorderStyle}
                    className={cn(classNames?.row, rowClassName, onRowClick && "cursor-pointer", isSelectedByRowId && "bg-primary/5 hover:bg-primary/5", bordered === true && "border-border")}
                  >
                    {showCheckbox && (
                      <TableCell className="h-14 w-10 text-center">
                        <Checkbox
                          aria-label={`Select row ${row.id}`}
                          checked={row.getIsSelected()}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(value) => row.toggleSelected(!!value)}
                        />
                      </TableCell>
                    )}
                    {hasExpansion && (
                      <TableCell className="h-14 w-10">
                        {canExpand ? (
                          <button
                            type="button"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} row ${row.id}`}
                            aria-expanded={isExpanded}
                            onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded hover:bg-muted",
                              bordered === true && "border border-border"
                            )}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const columnDef = cell.column.columnDef as any;
                      const meta = columnDef.meta || {};
                      const isEditable = Boolean(onCellEdit) && Boolean(meta.editable);
                      const responsiveClass = resolveHiddenBelowClass(meta.hiddenBelow);
                      return (
                        <TableCell key={cell.id} title={typeof cell.getValue?.() === "string" ? (cell.getValue() as string) : undefined} className={cn("h-14 overflow-hidden text-ellipsis", responsiveClass)}>
                          {isEditable ? <EditableCell cell={cell} onCellEdit={onCellEdit} /> : flexRender(columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {isExpanded && renderSubRow && (
                    <TableRow data-expanded-row="true" style={rowBorderStyle} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={totalCols} className="p-0">
                        {renderSubRow(row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <TableRow style={rowBorderStyle}><TableCell colSpan={(table.getVisibleLeafColumns?.()?.length ?? columns.length) + (showCheckbox ? 1 : 0) + (hasExpansion ? 1 : 0)} className="h-16 text-center">{noResultsText}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </NajmScroll>
  );
}
