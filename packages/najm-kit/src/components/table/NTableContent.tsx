import React, { useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import { NajmScroll } from "../ui/scroll";
import { flexRender } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { surfaceBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
import { useTableStore } from "./TableContext";
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
  const recipe = useNajmComponentStyle("table");
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  const recipeStyle: React.CSSProperties | undefined =
    recipeRadius || recipe?.borderWidth
      ? {
          ...(recipeRadius ? { borderRadius: recipeRadius } : {}),
          ...(recipe?.borderWidth ? { borderWidth: recipe.borderWidth } : {}),
        }
      : undefined;
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
  const contentStyle: React.CSSProperties | undefined =
    recipeStyle || tableBorderColor
      ? {
          ...(recipeStyle ?? {}),
          ...(tableBorderColor ? { borderColor: resolvedBorderColor } : {}),
        }
      : undefined;
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
  const hasNoData = useTableStore.use.hasNoData();
  const showContent = useTableStore.use.showContent();
  const classNames = useTableStore.use.classNames();
  const bordered = useTableStore.use.bordered();
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

  if (isLoading || error || hasNoData || !showContent || !table) return null;
  const isTableView = effectiveMode ? effectiveMode === "table" : storeIsTableView;
  if (!isTableView) return null;

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
        "min-h-0 flex-1 overflow-hidden rounded-md bg-card",
        bordered === true ? surfaceBorderClasses(true) : "shadow-sm",
        classNames?.content
      )}
      style={contentStyle}
      onContextMenu={handleBackgroundContextMenu}
    >
      <Table>
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
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-foreground h-12"
                  style={headerCellStyle}
                >
                  {header.isPlaceholder ? null : (
                    <div className={cn("flex items-center gap-2", header.column.getCanSort() && showSorting && "cursor-pointer select-none")} onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && showSorting && <span>{getSortIcon(header.column)}</span>}
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
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
                      return (
                        <TableCell key={cell.id} className="h-14">
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
            <TableRow style={rowBorderStyle}><TableCell colSpan={columns.length + (showCheckbox ? 1 : 0) + (hasExpansion ? 1 : 0)} className="h-16 text-center">{noResultsText}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </NajmScroll>
  );
}
