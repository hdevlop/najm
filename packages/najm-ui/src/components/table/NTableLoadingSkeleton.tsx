import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Card } from "../ui/card";
import { NSkeleton } from "../feedback/NSkeletonPresets";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";

const DEFAULT_ROWS = 6;

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
    <Card
      data-testid="ntable-loading-skeleton"
      aria-busy="true"
      aria-label={loadingText}
      className={cn("rounded-md p-0 border", dynamicHeight ? "overflow-hidden" : "overflow-auto", classNames?.content)}
    >
      <span className="sr-only">{loadingText}</span>
      <div className={dynamicHeight ? "overflow-auto" : undefined}>
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
  );
}
