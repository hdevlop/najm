import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { NSkeleton } from "../feedback/NSkeletonPresets";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import { NajmScroll } from "../ui/scroll";
import { filterResponsiveColumns, resolveHiddenBelowClass } from "./responsiveColumns";
import { calculateCardSkeletonCount } from "./hooks";
import { useTableSurfaceAppearance } from "./tableSurface";

const DEFAULT_ROWS = 6;
/**
 * Rows drawn before the container has been measured.
 *
 * Must be a constant. Deriving it from `window.innerHeight` gets the count
 * right but breaks hydration: the server has no viewport, so it renders one
 * number and the client renders another, and React discards and re-renders the
 * whole tree. A wrong-but-stable count is cheaper than a right-but-mismatched
 * one, and the layout effect corrects it before paint.
 */
const UNMEASURED_DYNAMIC_ROWS = 12;
/**
 * Used until the container has been measured, which cannot happen during server
 * rendering. Deliberately generous: the skeleton scrolls inside an
 * `overflow-hidden` viewport, so extra placeholders are clipped and cost
 * nothing, whereas too few leave an obviously short skeleton that visibly
 * grows once the first measurement lands.
 */
const DEFAULT_CARD_COUNT = 48;

/**
 * Visually hidden, without depending on the consumer's CSS.
 *
 * `sr-only` is a Tailwind utility, and najm-kit's stylesheet does not ship one:
 * a consumer whose build does not scan this package renders the class as a
 * no-op and the loading text becomes a visible line above the table — which
 * makes the skeleton exactly one line taller than the content that replaces it.
 * Announcement text is not worth a layout dependency, so it carries its own.
 */
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

export interface NTableCardSkeletonSurface {
  bordered?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One card-shaped placeholder. Shared by the full-list loading skeleton and by
 * the infinite continuation tail, so an appended page is shaped like the cards
 * it becomes rather than like a generic spinner.
 */
export function NTableCardSkeleton({ surface }: { surface: NTableCardSkeletonSurface }) {
  return (
    <div
      data-ntable-loading-card
      data-bordered={surface.bordered === false ? "false" : surface.bordered ? "true" : undefined}
      style={surface.style}
      className={cn("rounded-lg p-3 sm:p-4", surface.className)}
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
    </div>
  );
}

/*
 * There is deliberately no header skeleton here.
 *
 * The real `NTableHeader` renders throughout a load, so a placeholder header
 * would either double it up or — worse — stand in for it at a different height.
 * The toolbar is the one piece of chrome whose height the body is measured
 * against, so it has to be the same element before and after the rows arrive,
 * not a look-alike matched to it pixel by pixel.
 */

export function NTableLoadingSkeleton({ rows }: { rows?: number }) {
  const rawColumns = useTableStore.use.columns() as any[];
  const responsiveColumns = React.useMemo(() => filterResponsiveColumns(rawColumns), [rawColumns]);
  const columns = responsiveColumns as any[];
  const showCheckbox = useTableStore.use.showCheckbox();
  const headerClassName = useTableStore.use.headerClassName();
  const classNames = useTableStore.use.classNames();
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const bordered = useTableStore.use.bordered();
  const borderColor = useTableStore.use.borderColor();
  const surface = useTableSurfaceAppearance(bordered, borderColor);
  const bodyHeight = useTableStore.use.bodyHeight();
  const skeletonRowCount = useTableStore.use.skeletonRowCount();
  const renderSubRow = useTableStore.use.renderSubRow();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();
  const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);
  const loadingText = useTableStore.use.loadingText() as string;
  const rowCount = rows ?? (
    dynamicHeight
      ? (bodyHeight > 0 ? skeletonRowCount : UNMEASURED_DYNAMIC_ROWS)
      : DEFAULT_ROWS
  );

  const renderHeaderLabel = (header: unknown) =>
    typeof header === "string" ? header : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* The real NTableHeader renders during loading; a second, differently
          sized header here would double it up and move the body again. */}
      <div
        data-testid="ntable-loading-skeleton"
        data-ntable-loading-row-count={rowCount}
        data-bordered={surface.bordered === false ? "false" : surface.bordered ? "true" : undefined}
        aria-busy="true"
        aria-label={loadingText}
        role="status"
        style={surface.style}
        className={cn(
          "min-h-0 rounded-md p-0",
          surface.className,
          // Sizes to its rows for the same reason `NTableContent` does, and it
          // has to match: the skeleton draws exactly the row count the real
          // table will render, so a box that fills its container here and hugs
          // its rows there would visibly resize the instant the rows arrive —
          // the one thing this whole layout is meant to avoid.
          dynamicHeight ? "max-h-full shrink overflow-hidden" : "flex-1 najm-overlay-scroll",
          classNames?.content,
        )}
      >
        <span style={VISUALLY_HIDDEN}>{loadingText}</span>
        <div aria-hidden="true" className={dynamicHeight ? "najm-overlay-scroll" : undefined}>
          {/* Matches `NTableContent`: same layout algorithm, same widths, so
              the columns do not shift when the rows replace the placeholders. */}
          <Table className="table-fixed">
            <TableHeader data-ntable-table-header className={cn(headerClassName, "sticky top-0 z-10", classNames?.tableHeader)}>
              <TableRow className="hover:bg-muted/30">
                {showCheckbox && <TableHead aria-label="Select column" className="w-10 text-foreground h-12" />}
                {hasExpansion && <TableHead aria-label="Expand column" className="w-10 text-foreground h-12" />}
                {columns.map((col, i) => (
                  <TableHead
                    key={col?.id ?? col?.accessorKey ?? i}
                    className={cn("text-foreground h-12", resolveHiddenBelowClass(col?.meta?.hiddenBelow))}
                    style={col?.size ? { width: col.size } : undefined}
                  >
                    {renderHeaderLabel(col?.header)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rowCount }).map((_, r) => (
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
                      className={cn("h-14", resolveHiddenBelowClass(col?.meta?.hiddenBelow))}
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
      </div>
    </div>
  );
}

export function NTableCardsLoadingSkeleton({ rows }: { rows?: number }) {
  const classNames = useTableStore.use.classNames();
  const bordered = useTableStore.use.bordered();
  const borderColor = useTableStore.use.borderColor();
  const surface = useTableSurfaceAppearance(bordered, borderColor);
  const dynamicHeight = useTableStore.use.dynamicHeight();
  const bodyHeight = useTableStore.use.bodyHeight();
  const cardColumnCount = useTableStore.use.cardColumnCount();
  const cardRowHeight = useTableStore.use.cardRowHeight();
  const cardGap = useTableStore.use.cardGap();
  const loadingText = useTableStore.use.loadingText() as string;
  const CardSkeletonComponent = useTableStore.use.CardSkeletonComponent();
  const cardCount = rows ?? (
    dynamicHeight && bodyHeight > 0
      ? calculateCardSkeletonCount({
          bodyHeight,
          columnCount: cardColumnCount,
          cardHeight: cardRowHeight,
          gap: cardGap,
        })
      : DEFAULT_CARD_COUNT
  );
  const defaultContainerClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  const containerClass = classNames?.cards ?? defaultContainerClass;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <NajmScroll
        axis="y"
        aria-busy="true"
        aria-label={loadingText}
        role="status"
        className="min-h-0 flex-1 overflow-hidden"
      >
        <span style={VISUALLY_HIDDEN}>{loadingText}</span>
        <div
          data-testid="ntable-cards-loading-skeleton"
          data-ntable-loading-cards-grid
          data-ntable-loading-card-count={cardCount}
          aria-hidden="true"
          className={cn(containerClass)}
        >
          {Array.from({ length: cardCount }).map((_, index) => (
            CardSkeletonComponent
              // Wrapped so the consumer's placeholder does not have to know
              // about the attribute the card-height measurement looks for.
              ? <div key={index} data-ntable-loading-card><CardSkeletonComponent /></div>
              : <NTableCardSkeleton key={index} surface={surface} />
          ))}
        </div>
      </NajmScroll>
    </div>
  );
}
