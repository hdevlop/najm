import * as React from "react";
import { useNajmDesign } from "../../theme/design-provider";
import { cn } from "../../lib/cn";

export type NGridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type NGridSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface NGridProps extends Omit<React.AllHTMLAttributes<HTMLElement>, "gap" | "cols"> {
  children: React.ReactNode;
  /** Columns at the base (mobile) size. Defaults to 1. */
  cols?: NGridCols;
  /** Columns at the `sm` breakpoint and above (≥640px). */
  smCols?: NGridCols;
  /** Columns at the `md` breakpoint and above (≥768px). */
  mdCols?: NGridCols;
  /** Columns at the `lg` breakpoint and above (≥1024px). */
  lgCols?: NGridCols;
  /** Columns at the `xl` breakpoint and above (≥1280px). */
  xlCols?: NGridCols;
  /** Gap between cells. Defaults to the theme's `sectionGap` token (`--section-gap`). */
  gap?: string;
  /** Render the grid as a different element (defaults to `div`). */
  as?: "div" | "section" | "ul";
  className?: string;
}

export interface NGridItemProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "span"> {
  children: React.ReactNode;
  /** Columns spanned at the base (mobile) size. Defaults to 1. */
  span?: NGridSpan;
  /** Columns spanned at the `sm` breakpoint and above (≥640px). */
  smSpan?: NGridSpan;
  /** Columns spanned at the `md` breakpoint and above (≥768px). */
  mdSpan?: NGridSpan;
  /** Columns spanned at the `lg` breakpoint and above (≥1024px). */
  lgSpan?: NGridSpan;
  /** Columns spanned at the `xl` breakpoint and above (≥1280px). */
  xlSpan?: NGridSpan;
  className?: string;
}

function colClass(cols: NGridCols | undefined, prefix: string): string {
  if (cols === undefined) return "";
  return `${prefix}grid-cols-${cols}`;
}

function spanClass(span: NGridSpan | undefined, prefix: string): string {
  if (span === undefined) return "";
  return `${prefix}col-span-${span}`;
}

export function NGrid({
  as: Comp = "div",
  children,
  cols,
  smCols,
  mdCols,
  lgCols,
  xlCols,
  gap,
  className,
  style,
  ...props
}: NGridProps) {
  const { layout } = useNajmDesign();
  const resolvedGap = gap ?? layout?.sectionGap ?? "var(--section-gap, 20px)";

  const gridClassName = cn(
    "grid",
    colClass(cols, ""),
    colClass(smCols, "sm:"),
    colClass(mdCols, "md:"),
    colClass(lgCols, "lg:"),
    colClass(xlCols, "xl:"),
    className,
  );

  return (
    <Comp
      className={gridClassName}
      style={{ gap: resolvedGap, ...style }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function NGridItem({
  children,
  span,
  smSpan,
  mdSpan,
  lgSpan,
  xlSpan,
  className,
  ...props
}: NGridItemProps) {
  const itemClassName = cn(
    spanClass(span, ""),
    spanClass(smSpan, "sm:"),
    spanClass(mdSpan, "md:"),
    spanClass(lgSpan, "lg:"),
    spanClass(xlSpan, "xl:"),
    className,
  );

  return (
    <div className={itemClassName} {...props}>
      {children}
    </div>
  );
}
