import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Card } from "../ui/card";
import { NSkeleton } from "../feedback/NSkeletonPresets";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import { NajmScroll } from "../ui/scroll";
import { surfaceBorderClasses } from "../../theme/borders";

const DEFAULT_ROWS = 6;
const DEFAULT_CARD_COUNT = 16;

function NTableHeaderSkeleton() {
  const filters = useTableStore.use.filters() as any[];
  const showViewToggle = useTableStore.use.showViewToggle();
  const showColumnVisibility = useTableStore.use.showColumnVisibility();
  const showAddButton = useTableStore.use.showAddButton();
  const hasHeaderSlot = Boolean(useTableStore.use.headerSlot());
  const hasToolbar = Boolean(useTableStore.use.renderToolbar());
  const filterCount = Math.min(Math.max(filters?.length ?? 0, 1), 3);
  const hasActions = showViewToggle || showColumnVisibility || showAddButton || hasHeaderSlot || hasToolbar;
  const hasSettings = showViewToggle || showColumnVisibility || hasHeaderSlot || hasToolbar;

  if (!filters?.length && !hasActions) return null;

  return (
    <div
      data-ntable-loading-header
      className="flex shrink-0 flex-wrap items-center justify-between gap-2"
    >
      {filters?.length ? (
        <div
          data-ntable-loading-desktop-filters
          className="hidden min-w-0 flex-1 flex-wrap gap-2 md:flex"
        >
          {Array.from({ length: filterCount }).map((_, index) => (
            <NSkeleton
              key={index}
              className={cn("h-10 w-full rounded-lg", index < 2 ? "max-w-64" : "max-w-48")}
            />
          ))}
        </div>
      ) : (
        <span className="hidden min-w-0 flex-1 md:block" />
      )}

      <div
        data-ntable-loading-mobile-toolbar
        className="flex w-full min-w-0 items-center gap-2 md:hidden"
      >
        {filters?.length ? (
          <NSkeleton
            data-ntable-loading-mobile-primary
            className="h-10 min-w-0 flex-1 rounded-lg"
          />
        ) : null}
        {filters?.length > 1 ? (
          <NSkeleton
            data-ntable-loading-mobile-filter-button
            className="h-10 w-10 shrink-0 rounded-lg"
          />
        ) : null}
        {showAddButton ? (
          <NSkeleton
            data-ntable-loading-mobile-add-button
            className="h-10 w-10 shrink-0 rounded-lg"
          />
        ) : null}
      </div>

      {hasActions && (
        <div className="hidden shrink-0 gap-2 md:flex">
          {hasSettings && (
            <NSkeleton className="h-10 w-10 rounded-lg" />
          )}
          {showAddButton && <NSkeleton className="h-10 w-10 rounded-lg" />}
        </div>
      )}
    </div>
  );
}

export function NTableLoadingSkeleton({ rows = DEFAULT_ROWS }: { rows?: number }) {
  const columns = useTableStore.use.columns() as any[];
  const showCheckbox = useTableStore.use.showCheckbox();
  const headerClassName = useTableStore.use.headerClassName();
  const classNames = useTableStore.use.classNames();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const renderSubRow = useTableStore.use.renderSubRow();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();
  const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);
  const loadingText = useTableStore.use.loadingText() as string;

  const renderHeaderLabel = (header: unknown) =>
    typeof header === "string" ? header : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <NTableHeaderSkeleton />
      <Card
        data-testid="ntable-loading-skeleton"
        aria-busy="true"
        aria-label={loadingText}
        className={cn("rounded-md p-0 border", dynamicHeight ? "overflow-hidden" : "najm-overlay-scroll", classNames?.content)}
      >
        <span className="sr-only">{loadingText}</span>
        <div className={dynamicHeight ? "najm-overlay-scroll" : undefined}>
          <Table>
            <TableHeader className={cn(headerClassName, dynamicHeight && "sticky top-0 z-10", classNames?.tableHeader)}>
              <TableRow className="hover:bg-muted/30">
                {showCheckbox && <TableHead aria-label="Select column" className="w-10 text-foreground h-12" />}
                {hasExpansion && <TableHead aria-label="Expand column" className="w-10 text-foreground h-12" />}
                {columns.map((col, i) => (
                  <TableHead
                    key={col?.id ?? col?.accessorKey ?? i}
                    className="text-foreground h-12"
                    style={col?.size ? { width: col.size } : undefined}
                  >
                    {renderHeaderLabel(col?.header)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, r) => (
                <TableRow key={`skeleton-${r}`}>
                  {showCheckbox && (
                    <TableCell className="h-14 w-10">
                      <NSkeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {hasExpansion && (
                    <TableCell className="h-14 w-10">
                      <NSkeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((col, c) => (
                    <TableCell
                      key={`skeleton-${r}-${col?.id ?? col?.accessorKey ?? c}`}
                      className="h-14"
                      style={col?.size ? { width: col.size } : undefined}
                    >
                      <NSkeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export function NTableCardsLoadingSkeleton({ rows }: { rows?: number }) {
  const filters = useTableStore.use.filters() as any[];
  const showViewToggle = useTableStore.use.showViewToggle();
  const showColumnVisibility = useTableStore.use.showColumnVisibility();
  const showAddButton = useTableStore.use.showAddButton();
  const hasHeaderSlot = Boolean(useTableStore.use.headerSlot());
  const hasToolbar = Boolean(useTableStore.use.renderToolbar());
  const hasHeaderSkeleton = Boolean(
    filters?.length || showViewToggle || showColumnVisibility || showAddButton || hasHeaderSlot || hasToolbar
  );
  const classNames = useTableStore.use.classNames();
  const bordered = useTableStore.use.bordered();
  const calculatedPageSize = useTableStore.use.calculatedPageSize();
  const pagination = useTableStore.use.pagination();
  const cardCount = rows ?? Math.max(1, calculatedPageSize || pagination?.pageSize || DEFAULT_CARD_COUNT);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {hasHeaderSkeleton && <NTableHeaderSkeleton />}
      <NajmScroll axis="y" className="min-h-0 flex-1 overflow-hidden">
        <div
          data-testid="ntable-cards-loading-skeleton"
          aria-busy="true"
          className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", classNames?.cards)}
        >
          {Array.from({ length: cardCount }).map((_, index) => (
            <Card
              key={index}
              className={cn("rounded-lg bg-card p-3 shadow-none sm:p-4", surfaceBorderClasses(bordered))}
            >
              <div
                data-ntable-loading-card-layout="responsive-avatar"
                className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 sm:grid-cols-[72px_minmax(0,1fr)]"
              >
                <div className="col-start-1 row-start-1 flex items-start justify-center sm:justify-start">
                  <NSkeleton
                    data-ntable-loading-card-avatar
                    className="size-20 shrink-0 rounded-full sm:size-16"
                  />
                </div>

                <div className="col-start-2 row-start-1 flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <NSkeleton className="h-5 w-36 max-w-full" />
                    <NSkeleton className="hidden h-3 w-16 sm:block" />
                  </div>
                  <NSkeleton
                    data-ntable-loading-card-status
                    className="hidden h-6 w-14 shrink-0 rounded-full sm:block"
                  />
                </div>

                <div
                  data-ntable-loading-card-details
                  className="col-start-2 row-start-2 space-y-1 sm:col-span-full sm:col-start-1 sm:space-y-2 sm:rounded-lg sm:bg-muted/50 sm:p-3"
                >
                  {Array.from({ length: 3 }).map((_, detailIndex) => (
                    <div key={detailIndex} className="flex items-center gap-1.5 sm:gap-2">
                      <NSkeleton className="size-3.5 shrink-0 rounded-sm sm:size-4" />
                      <NSkeleton
                        className={cn(
                          "h-3 max-w-full sm:h-4",
                          detailIndex === 0 ? "w-full" : detailIndex === 1 ? "w-4/5" : "w-3/4",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </NajmScroll>
    </div>
  );
}
