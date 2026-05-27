import React from "react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";

export function NTableCards({ effectiveMode }: { effectiveMode?: string }) {
  const table = useTableStore.use.table();
  const onRowClick = useTableStore.use.onRowClick();
  const onRowContextMenu = useTableStore.use.onRowContextMenu();
  const CardComponent = useTableStore.use.CardComponent();
  const storeIsCardView = useTableStore.use.isCardView();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const showContent = useTableStore.use.showContent();
  const classNames = useTableStore.use.classNames();
  const renderSubRow = useTableStore.use.renderSubRow();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();
  const selectedRowId = useTableStore.use.selectedRowId();

  if (isLoading || error || hasNoData || !showContent || !table) return null;
  const isCardView = effectiveMode ? effectiveMode === "cards" : storeIsCardView;
  if (!isCardView) return null;

  const rows = table.getRowModel().rows;
  if (!CardComponent) return <div className="text-center py-8 text-muted-foreground">No CardComponent provided.</div>;

  const defaultContainerClass = "flex flex-wrap gap-3 p-3 overflow-y-auto";
  const containerClass = classNames?.cards ?? defaultContainerClass;

  return (
    <div className={cn(containerClass)}>
      {rows.map((row) => {
        const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);
        const canExpand = hasExpansion && row.getCanExpand();
        const isExpanded = canExpand && row.getIsExpanded();
        const handleClick = () => onRowClick?.(row.original);
        const handleContextMenu = (e: React.MouseEvent) => onRowContextMenu?.(e, row.original);

        return (
          <CardComponent
            key={row.id}
            data={row.original}
            row={row}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            isExpanded={isExpanded}
            onToggleExpanded={() => row.toggleExpanded()}
            canExpand={canExpand}
            renderSubRow={canExpand && isExpanded ? renderSubRow : undefined}
            data-row="true"
          />
        );
      })}
    </div>
  );
}