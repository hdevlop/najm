import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "../Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useTableStore } from "./TableContext";
import { cn } from "../../lib/cn";
import type { NTableClassNames } from "./store";

export function NTablePagination() {
  const table = useTableStore.use.table();
  const showPagination = useTableStore.use.showPagination();
  const showContent = useTableStore.use.showContent();
  const pageSizeOptions = useTableStore.use.pageSizeOptions();
  const classNames = useTableStore.use.classNames() as NTableClassNames | undefined;
  const viewMode = useTableStore.use.viewMode();
  const pagination = useTableStore.use.pagination();
  const manualPagination = useTableStore.use.manualPagination();
  const pageCount = useTableStore.use.pageCount();
  const rowCount = useTableStore.use.rowCount();
  const setPagination = useTableStore.use.setPagination();
  const isPaginationControlled = useTableStore.use.isPaginationControlled();
  const bordered = useTableStore.use.bordered();

  if (!table || !showContent || !showPagination || viewMode === "json" || viewMode === "files") return null;

  const filteredRows = table.getFilteredRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;
  // For manual pagination, use server pageCount if provided; otherwise fall back to TanStack's count
  const effectivePageCount = manualPagination && pageCount !== undefined ? pageCount : table.getPageCount();

  const currentPagination = pagination ?? { pageIndex, pageSize };
  const currentPageSizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  const navigate = (direction: "first" | "prev" | "next" | "last") => {
    let next: { pageIndex: number; pageSize: number };
    switch (direction) {
      case "first":
        next = { ...currentPagination, pageIndex: 0 };
        break;
      case "prev":
        next = { ...currentPagination, pageIndex: currentPagination.pageIndex - 1 };
        break;
      case "next":
        next = { ...currentPagination, pageIndex: currentPagination.pageIndex + 1 };
        break;
      case "last":
        next = { ...currentPagination, pageIndex: effectivePageCount - 1 };
        break;
    }
    setPagination(next);
  };

  const handlePageSizeChange = (value: string) => {
    const newSize = Number(value);
    setPagination({ pageIndex: 0, pageSize: newSize });
  };

  return (
    <div className={cn("flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1 text-foreground", classNames?.pagination)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 lg:gap-6">
        {(!isPaginationControlled || manualPagination) && (
          <div className="flex items-center gap-2 text-foreground">
            <p className="text-sm font-medium text-foreground">Rows/page</p>
            <Select value={`${pageSize}`} onValueChange={handlePageSizeChange}>
              <SelectTrigger
                data-bordered={bordered ? "true" : undefined}
                className={cn("h-8 w-[80px] text-foreground", bordered && "najm-border border-border")}
              ><SelectValue placeholder={pageSize} /></SelectTrigger>
              <SelectContent side="top">{currentPageSizeOptions.map((size) => <SelectItem key={size} value={`${size}`}>{size}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="text-sm font-medium text-foreground">Page {pageIndex + 1} of {effectivePageCount}</div>
        <div className="flex items-center gap-2">
          <Button bordered={bordered} variant="outline" className="hidden h-8 w-8 p-0 text-foreground disabled:text-muted-foreground disabled:opacity-70 lg:flex" aria-label="First page" onClick={() => navigate("first")} disabled={!table.getCanPreviousPage?.() || pageIndex === 0}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button bordered={bordered} variant="outline" className="h-8 w-8 p-0 text-foreground disabled:text-muted-foreground disabled:opacity-70" aria-label="Previous" onClick={() => navigate("prev")} disabled={!table.getCanPreviousPage?.() || pageIndex === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <Button bordered={bordered} variant="outline" className="h-8 w-8 p-0 text-foreground disabled:text-muted-foreground disabled:opacity-70" aria-label="Next" onClick={() => navigate("next")} disabled={!table.getCanNextPage?.() || pageIndex >= effectivePageCount - 1}><ChevronRight className="h-4 w-4" /></Button>
          <Button bordered={bordered} variant="outline" className="hidden h-8 w-8 p-0 text-foreground disabled:text-muted-foreground disabled:opacity-70 lg:flex" aria-label="Last page" onClick={() => navigate("last")} disabled={!table.getCanNextPage?.() || pageIndex >= effectivePageCount - 1}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="min-w-0 flex-none whitespace-nowrap text-sm text-muted-foreground max-sm:hidden">
        {selectedRows.length} of {manualPagination && rowCount !== undefined ? rowCount : filteredRows.length} row(s) selected.
      </div>
    </div>
  );
}
