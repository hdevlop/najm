import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { Button } from "../Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useTableStore } from "./TableContext";
import { cn } from "../../lib/cn";
import type { NTableClassNames } from "./store";
import type {
  NTableLoadMorePagination as NTableLoadMorePaginationContract,
  NTablePaginationLabels,
} from "./paginationContract";
import { buildPageItems } from "./paginationPages";
import { useResolvedPaginationLabels } from "./TableDefaults";

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

const navButtonClass =
  "h-8 w-8 p-0 disabled:text-muted-foreground disabled:opacity-70";

/** Chevrons point along the reading direction, so they mirror under `dir="rtl"`. */
const chevronClass = "h-4 w-4 rtl:-scale-x-100";

/**
 * Warns once when a supplied `pageCount` is really a lower bound.
 *
 * A result total does not move because the reader turned a page. So a count
 * that rises by exactly the number of pages just advanced, under an unchanged
 * page size, is a cursor bound wearing a total's prop — the shape produced by
 * `pageIndex + (hasNextPage ? 2 : 1)`. Left alone it renders as a bar that
 * grows one number per click, which reads as a bug in the bar rather than a
 * missing total.
 *
 * Two conditions, not one: lockstep movement, *and* a count sitting no more
 * than a page past the reader. Filtering moves a real count but resets the page
 * index backwards, and a mutation that adds rows mid-turn moves it without
 * pinning it to the cursor — so a genuine total has to be both moving in step
 * and hugging the reader to be accused, which is what a bound does by
 * construction and a total essentially never does.
 */
function useLowerBoundPageCountWarning(
  manualPagination: boolean,
  pageCount: number | undefined,
  pagination: { pageIndex: number; pageSize: number } | undefined,
) {
  const previous = React.useRef<
    { pageIndex: number; pageSize: number; pageCount: number } | null
  >(null);
  const warned = React.useRef(false);

  React.useEffect(() => {
    if (typeof console === "undefined") return;
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
    if (!manualPagination || pageCount === undefined || !pagination) {
      previous.current = null;
      return;
    }

    const last = previous.current;
    previous.current = { ...pagination, pageCount };
    if (!last || warned.current) return;
    if (last.pageSize !== pagination.pageSize) return;

    const advanced = pagination.pageIndex - last.pageIndex;
    if (advanced <= 0 || pageCount - last.pageCount !== advanced) return;
    // `pageIndex + 1` and `pageIndex + 2` are the only bounds this shape
    // produces. A real total keeps its distance from the reader.
    if (pageCount - pagination.pageIndex > 2) return;

    warned.current = true;
    console.warn(
      "NTable received a pageCount that grew with the page index, so it is a "
      + "lower bound rather than a result total and the numbered bar would "
      + "gain a page button per click. For a list whose endpoint reports no "
      + "total, drop pageCount and pass hasNextPage instead.",
    );
  }, [manualPagination, pageCount, pagination]);
}

function PageNumbers({
  pageIndex,
  pageCount,
  unbounded,
  bordered,
  labels,
  onSelect,
}: {
  pageIndex: number;
  pageCount: number;
  /** `pageCount` covers the pages known to exist, not the whole result. */
  unbounded?: boolean;
  bordered?: boolean;
  labels: NTablePaginationLabels;
  onSelect: (pageIndex: number) => void;
}) {
  return (
    <>
      {buildPageItems(pageIndex, pageCount, 1, unbounded).map((item) => {
        if (item.type === "gap") {
          return (
            <span
              key={`gap-${item.key}`}
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
            >
              &hellip;
            </span>
          );
        }

        const page = item.pageIndex + 1;
        const isCurrent = item.pageIndex === pageIndex;
        return (
          <Button
            key={item.pageIndex}
            bordered={bordered}
            variant={isCurrent ? "default" : "outline"}
            className={cn(navButtonClass, "tabular-nums")}
            aria-label={isCurrent
              ? labels.currentPage?.(page) ?? `Page ${page}, current page`
              : labels.goToPage?.(page) ?? `Go to page ${page}`}
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => onSelect(item.pageIndex)}
          >
            {page}
          </Button>
        );
      })}
    </>
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
  const suppliedHasNextPage = useTableStore.use.hasNextPage();
  const setPagination = useTableStore.use.setPagination();
  const setPageSizeFromUser = useTableStore.use.setPageSizeFromUser();
  const isPaginationControlled = useTableStore.use.isPaginationControlled();
  const bordered = useTableStore.use.bordered();
  const paginationVariant = useTableStore.use.paginationVariant();
  const ownLabels = useTableStore.use.paginationLabels();
  const labels = useResolvedPaginationLabels(ownLabels);

  // Above the early returns: hooks do not get to be conditional, and a bar that
  // is hidden this render can still be handed a moving count.
  useLowerBoundPageCountWarning(manualPagination, pageCount, pagination);

  // Deliberately not gated on `table`.
  //
  // The bar is the last piece of chrome between the body and the bottom of the
  // container, so the body is measured against it — and the measurement runs in
  // a layout effect on the first commit, which is earlier than the table
  // instance can reach the store. Returning null there makes the body one bar
  // taller than it will ever be again, the page size lands a row over, and it
  // visibly corrects the moment the bar appears. Everything below falls back to
  // store state so the bar can render its real height with no table at all.
  //
  // `showPagination` already accounts for content and for a first load, where
  // the bar renders to reserve its height and NTable hides it.
  if (!showPagination || effectiveViewMode === "json" || effectiveViewMode === "files") return null;

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

  // Without a table there are no rows to count and no row model to ask; the
  // store's pagination is the same value the table would report anyway.
  const filteredRows = table ? table.getFilteredRowModel().rows : [];
  const selectedRows = table ? table.getFilteredSelectedRowModel().rows : [];
  const { pageIndex, pageSize } = table ? table.getState().pagination : pagination;

  // An endpoint that reports no total can still prove two things: the pages up
  // to the one being read exist, because they were read, and one more exists,
  // because it said so. That is the whole result as far as anyone knows, and it
  // is what the bar is allowed to draw — with a trailing gap for the rest.
  const unbounded = manualPagination
    && pageCount === undefined
    && suppliedHasNextPage !== undefined;

  // For manual pagination, use server pageCount if provided; otherwise fall back to TanStack's count
  const effectivePageCount = manualPagination && pageCount !== undefined
    ? pageCount
    : unbounded
      ? pageIndex + (suppliedHasNextPage ? 2 : 1)
      : (table ? table.getPageCount() : 1);

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
    setPageSizeFromUser(newSize);
  };

  // Numbered pages invite a click on any page they render, so every one of them
  // has to be a page that exists. A real total proves that outright; `unbounded`
  // proves it for the pages it draws and defers the rest to a gap. Under manual
  // pagination with neither, TanStack infers a count from the rows it happens to
  // hold, which is not a result total — fall back rather than render buttons for
  // pages that may not be there.
  const hasTrustworthyPageCount = manualPagination
    ? (pageCount !== undefined && pageCount > 0) || unbounded
    : effectivePageCount > 0;
  const showNumbers = paginationVariant === "numbered" && hasTrustworthyPageCount;

  const canPrevious = (table?.getCanPreviousPage?.() ?? pageIndex > 0) && pageIndex > 0;
  const canNext = unbounded
    ? Boolean(suppliedHasNextPage)
    : (table?.getCanNextPage?.() ?? true) && pageIndex < effectivePageCount - 1;
  // There is no last page to jump to when the end of the result is unknown, and
  // `effectivePageCount - 1` would land on the furthest page merely proven to
  // exist — one past where the reader already is.
  const canLast = canNext && !unbounded;
  const selectedTotal = manualPagination && rowCount !== undefined
    ? rowCount
    : filteredRows.length;

  return (
    <div className={cn("flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1 text-foreground", classNames?.pagination)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 lg:gap-6">
        {(!isPaginationControlled || manualPagination) && (
          <div className="flex items-center gap-2 text-foreground">
            <p className="text-sm font-medium text-foreground">{labels.rowsPerPage ?? "Rows/page"}</p>
            <Select value={`${pageSize}`} onValueChange={handlePageSizeChange}>
              <SelectTrigger
                data-bordered={bordered ? "true" : undefined}
                className={cn("h-8 w-[80px] text-foreground", bordered && "najm-border border-border")}
              ><SelectValue placeholder={pageSize} /></SelectTrigger>
              <SelectContent side="top">{currentPageSizeOptions.map((size) => <SelectItem key={size} value={`${size}`}>{size}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {/*
          The position text is the only control narrow viewports get: seven page
          buttons plus the size select do not fit a phone, and wrapping them
          costs a row of height the table needs more.
        */}
        <div className={cn("text-sm font-medium text-foreground", showNumbers && "sm:hidden")}>
          {unbounded
            ? labels.pageOfUnknown?.(pageIndex + 1) ?? `Page ${pageIndex + 1}`
            : labels.pageOf?.(pageIndex + 1, effectivePageCount)
              ?? `Page ${pageIndex + 1} of ${effectivePageCount}`}
        </div>
        <nav
          aria-label={labels.pagination ?? "Pagination"}
          className="flex items-center gap-2"
        >
          {/*
            First and last are reachable by their own numbered buttons, so the
            double chevrons would be a second way to press the same control.
          */}
          {!showNumbers && (
            <Button bordered={bordered} variant="outline" className={cn(navButtonClass, "hidden lg:flex")} aria-label={labels.firstPage ?? "First page"} onClick={() => navigate("first")} disabled={!canPrevious}><ChevronsLeft className={chevronClass} /></Button>
          )}
          <Button bordered={bordered} variant="outline" className={navButtonClass} aria-label={labels.previousPage ?? "Previous"} onClick={() => navigate("prev")} disabled={!canPrevious}><ChevronLeft className={chevronClass} /></Button>
          {showNumbers && (
            <div className="hidden items-center gap-2 sm:flex">
              <PageNumbers
                pageIndex={pageIndex}
                pageCount={effectivePageCount}
                unbounded={unbounded && Boolean(suppliedHasNextPage)}
                bordered={bordered}
                labels={labels}
                onSelect={(next) => setPagination({ ...currentPagination, pageIndex: next })}
              />
            </div>
          )}
          <Button bordered={bordered} variant="outline" className={navButtonClass} aria-label={labels.nextPage ?? "Next"} onClick={() => navigate("next")} disabled={!canNext}><ChevronRight className={chevronClass} /></Button>
          {!showNumbers && (
            <Button bordered={bordered} variant="outline" className={cn(navButtonClass, "hidden lg:flex")} aria-label={labels.lastPage ?? "Last page"} onClick={() => navigate("last")} disabled={!canLast}><ChevronsRight className={chevronClass} /></Button>
          )}
        </nav>
      </div>
      <div className="min-w-0 flex-none whitespace-nowrap text-sm text-muted-foreground max-sm:hidden">
        {labels.rowsSelected?.(selectedRows.length, selectedTotal)
          ?? `${selectedRows.length} of ${selectedTotal} row(s) selected.`}
      </div>
    </div>
  );
}
