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

  if (!filters?.length && !hasActions) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
      {filters?.length ? (
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {Array.from({ length: filterCount }).map((_, index) => (
            <NSkeleton
              key={index}
              className={cn("h-10 w-full rounded-lg", index < 2 ? "max-w-64" : "max-w-48")}
            />
          ))}
        </div>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {hasActions && (
        <div className="flex shrink-0 gap-2">
          {(showViewToggle || showColumnVisibility || hasHeaderSlot || hasToolbar) && (
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
              className={cn("rounded-lg bg-card p-4 shadow-none", surfaceBorderClasses(bordered))}
            >
              <div className="flex items-start gap-4">
                <NSkeleton className="h-12 w-12 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <NSkeleton className="h-5 w-36" />
                    <NSkeleton className="h-3 w-48 max-w-full" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <NSkeleton className="h-4 w-full" />
                    <NSkeleton className="h-4 w-4/5" />
                    <NSkeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </NajmScroll>
    </div>
  );
}
