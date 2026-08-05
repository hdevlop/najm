import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { Button } from "../Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useTableStore } from "./TableContext";
import { cn } from "../../lib/cn";
import type { NTableClassNames } from "./store";
import type { NTableLoadMorePagination as NTableLoadMorePaginationContract } from "./paginationContract";

function CardLoadMorePagination({
  config,
  rowCount,
  bordered,
  className,
}: {
  config: NTableLoadMorePaginationContract;
  rowCount: number;
  bordered?: boolean;
  className?: string;
}) {
  const [internalPending, setInternalPending] = React.useState(false);
  const [internalError, setInternalError] = React.useState<React.ReactNode>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const pendingRef = React.useRef(false);
  const restoreFocusRef = React.useRef(false);
  const previousRowCountRef = React.useRef(rowCount);
  const errorId = React.useId();
  const pending = Boolean(config.loadingMore || internalPending);
  const error = config.loadMoreError ?? internalError;

  React.useEffect(() => {
    const previous = previousRowCountRef.current;
    if (rowCount > previous) {
      const appended = rowCount - previous;
      setAnnouncement(
        config.itemsLoadedLabel?.(appended)
          ?? `${appended} more ${appended === 1 ? "item" : "items"} loaded.`,
      );
    }
    previousRowCountRef.current = rowCount;
  }, [config.itemsLoadedLabel, rowCount]);

  React.useEffect(() => {
    if (pending || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const frame = requestAnimationFrame(() => buttonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pending]);

  const loadMore = async () => {
    if (pendingRef.current || pending || (!config.hasNextPage && !error)) return;
    pendingRef.current = true;
    restoreFocusRef.current = document.activeElement === buttonRef.current;
    setInternalPending(true);
    setInternalError(null);
    const loadingAnnouncement = config.loadingMoreLabel ?? "Loading more items...";
    setAnnouncement(loadingAnnouncement);
    try {
      await config.onLoadMore();
    } catch {
      setInternalError(config.loadMoreErrorLabel ?? "Couldn't load more items.");
      setAnnouncement("");
    } finally {
      pendingRef.current = false;
      setInternalPending(false);
      setAnnouncement((current) => current === loadingAnnouncement ? "" : current);
    }
  };

  if (!config.hasNextPage && !pending && !error) {
    return (
      <div
        data-ntable-load-more-end
        role="status"
        aria-live="polite"
        className={cn("py-2 text-center text-sm text-muted-foreground", className)}
      >
        {config.endLabel ?? "No more items."}
      </div>
    );
  }

  return (
    <div
      data-ntable-load-more
      className={cn("flex min-w-0 flex-col items-center gap-2 py-2", className)}
    >
      {error ? (
        <div id={errorId} role="alert" className="text-center text-sm text-destructive">
          {error === true ? config.loadMoreErrorLabel ?? "Couldn't load more items." : error}
        </div>
      ) : null}
      <Button
        ref={buttonRef}
        type="button"
        bordered={bordered}
        variant="outline"
        autoLoading={false}
        disabled={pending}
        aria-describedby={error ? errorId : undefined}
        aria-busy={pending ? "true" : undefined}
        onClick={loadMore}
      >
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
        {pending
          ? config.loadingMoreLabel ?? "Loading more..."
          : error
            ? config.retryLabel ?? "Retry"
            : config.loadMoreLabel ?? "Load more"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

export function NTablePagination() {
  const table = useTableStore.use.table();
  const showPagination = useTableStore.use.showPagination();
  const showContent = useTableStore.use.showContent();
  const pageSizeOptions = useTableStore.use.pageSizeOptions();
  const classNames = useTableStore.use.classNames() as NTableClassNames | undefined;
  const effectiveViewMode = useTableStore.use.effectiveViewMode();
  const cardPagination = useTableStore.use.cardPagination();
  const data = useTableStore.use.data();
  const pagination = useTableStore.use.pagination();
  const manualPagination = useTableStore.use.manualPagination();
  const pageCount = useTableStore.use.pageCount();
  const rowCount = useTableStore.use.rowCount();
  const setPagination = useTableStore.use.setPagination();
  const isPaginationControlled = useTableStore.use.isPaginationControlled();
  const bordered = useTableStore.use.bordered();

  if (!table || !showContent || !showPagination || effectiveViewMode === "json" || effectiveViewMode === "files") return null;

  // `all` renders the whole supplied set in either view mode, so there is
  // nothing left to page through.
  if (cardPagination.mode === "all") return null;

  // Infinite continuation is owned by NTableCards, inside the scroll viewport.
  if (effectiveViewMode === "cards" && cardPagination.mode === "infinite") return null;

  if (effectiveViewMode === "cards" && cardPagination.mode === "load-more") {
    return (
      <CardLoadMorePagination
        config={cardPagination}
        rowCount={data.length}
        bordered={bordered}
        className={classNames?.pagination}
      />
    );
  }

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
