import React, { useCallback } from "react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import { NDataCardShell } from "./NDataCardShell";
import { NajmScroll } from "../ui/scroll";
import { MoreVertical } from "lucide-react";

const ROW_CONTEXT_HANDLED = "__ntableRowContextHandled";

function markRowContextHandled(e: React.MouseEvent) {
  (e.nativeEvent as any)[ROW_CONTEXT_HANDLED] = true;
}

function isRowContextHandled(e: React.MouseEvent): boolean {
  return Boolean((e.nativeEvent as any)[ROW_CONTEXT_HANDLED]);
}

export function NTableCards({ effectiveMode }: { effectiveMode?: string }) {
  const table = useTableStore.use.table();
  const onRowClick = useTableStore.use.onRowClick();
  const onRowContextMenu = useTableStore.use.onRowContextMenu();
  const onBackgroundContextMenu = useTableStore.use.onBackgroundContextMenu();
  const openRowMenu = useTableStore.use.openRowMenu();
  const menuButton = useTableStore.use.menuButton();
  const onView = useTableStore.use.onView();
  const onEdit = useTableStore.use.onEdit();
  const onDelete = useTableStore.use.onDelete();
  const showCheckbox = useTableStore.use.showCheckbox();
  const selectedRowId = useTableStore.use.selectedRowId();
  const CardComponent = useTableStore.use.CardComponent();
  const storeIsCardView = useTableStore.use.isCardView();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const showContent = useTableStore.use.showContent();
  const classNames = useTableStore.use.classNames();
  const bordered = useTableStore.use.bordered();
  const renderSubRow = useTableStore.use.renderSubRow();
  const userGetRowCanExpand = useTableStore.use.getRowCanExpand();

  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    if (isRowContextHandled(e)) return;
    const gridContainer = (e.currentTarget as HTMLElement);
    let el = e.target as HTMLElement;
    let gridChild: HTMLElement | null = null;
    while (el && el.parentElement && el.parentElement !== gridContainer) {
      el = el.parentElement;
    }
    gridChild = el.parentElement === gridContainer ? el : null;

    if (gridChild) {
      const rows = table?.getRowModel()?.rows;
      if (!rows) return;
      const children = Array.from(gridContainer.children);
      const idx = children.indexOf(gridChild);
      if (idx >= 0 && idx < rows.length) {
        const row = rows[idx];
        if (onRowContextMenu) {
          markRowContextHandled(e);
          onRowContextMenu(e, row.original);
        }
        return;
      }
    }
    if (onBackgroundContextMenu) {
      onBackgroundContextMenu(e);
    }
  }, [table, onRowContextMenu, onBackgroundContextMenu]);

  if (isLoading || error || hasNoData || !showContent || !table) return null;
  const isCardView = effectiveMode ? effectiveMode === "cards" : storeIsCardView;
  if (!isCardView) return null;

  const rows = table.getRowModel().rows;
  if (!CardComponent) return <div className="text-center py-8 text-muted-foreground">No CardComponent provided.</div>;

  const defaultContainerClass = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3";
  const containerClass = classNames?.cards ?? defaultContainerClass;
  const actions = !menuButton && (onView || onEdit || onDelete) ? { onView, onEdit, onDelete } : undefined;

  return (
    <NajmScroll axis="y" className="min-h-0 flex-1 overflow-hidden">
    <div className={cn(containerClass)} onContextMenu={handleContainerContextMenu}>
      {rows.map((row) => {
        const noShell = Boolean((row.original as any)?.__smsNoShell);
        const hasExpansion = Boolean(renderSubRow || userGetRowCanExpand);
        const canExpand = hasExpansion && row.getCanExpand();
        const isExpanded = canExpand && row.getIsExpanded();
        const handleClick = onRowClick ? () => onRowClick(row.original) : undefined;

        const handleCardContextMenu = onRowContextMenu
          ? (e: React.MouseEvent) => {
              if (isRowContextHandled(e)) return;
              markRowContextHandled(e);
              onRowContextMenu(e, row.original);
            }
          : undefined;

        if (noShell) {
          return (
            <div
              key={row.id}
              onContextMenu={handleCardContextMenu}
              data-row="true"
              data-row-id={row.id}
              className="group relative"
            >
              {menuButton && openRowMenu && (
                <button
                  type="button"
                  aria-label="Row actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRowMenu(e, row.original);
                  }}
                  className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md p-0 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-muted/50 hover:text-foreground group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
              <CardComponent
                data={row.original}
                row={row}
                onClick={handleClick}
                onContextMenu={handleCardContextMenu}
                isExpanded={isExpanded}
                onToggleExpanded={() => row.toggleExpanded()}
                canExpand={canExpand}
                renderSubRow={canExpand && isExpanded ? renderSubRow : undefined}
                data-row="true"
                data-row-id={row.id}
              />
            </div>
          );
        }

        return (
          <NDataCardShell
            key={row.id}
            row={row}
            onClick={handleClick}
            onContextMenu={handleCardContextMenu}
            actions={actions}
            showCheckbox={showCheckbox}
            selectedRowId={selectedRowId}
            openRowMenu={openRowMenu}
            menuButton={menuButton}
            bordered={bordered}
          >
            <CardComponent
              data={row.original}
              row={row}
              isExpanded={isExpanded}
              onToggleExpanded={() => row.toggleExpanded()}
              canExpand={canExpand}
              renderSubRow={canExpand && isExpanded ? renderSubRow : undefined}
            />
          </NDataCardShell>
        );
      })}
    </div>
    </NajmScroll>
  );
}
