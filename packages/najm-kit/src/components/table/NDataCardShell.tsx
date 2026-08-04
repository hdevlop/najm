import React from "react";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Eye, Edit, Trash2, MoreVertical, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTableSurfaceAppearance } from "./tableSurface";
import type { Row } from "@tanstack/react-table";

export interface NDataCardShellActions {
  onView?: (row: unknown) => void;
  onEdit?: (row: unknown) => void;
  onDelete?: (row: unknown) => void;
}

export interface NDataCardShellProps {
  row: Row<unknown>;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  actions?: NDataCardShellActions;
  children?: React.ReactNode;
  className?: string;
  showCheckbox?: boolean;
  selectedRowId?: string | null;
  openRowMenu?: ((e: React.MouseEvent, row: any) => void) | null;
  menuButton?: boolean;
  bordered?: boolean;
  borderColor?: string;
}

export function NDataCardShell({ row, onClick, onContextMenu, actions, children, className, showCheckbox = true, selectedRowId, openRowMenu, menuButton, bordered, borderColor }: NDataCardShellProps) {
  const surface = useTableSurfaceAppearance(bordered, borderColor);
  const canExpand = row.getCanExpand();
  const isExpanded = canExpand && row.getIsExpanded();
  const isSelected = row.getIsSelected();
  const isHighlighted = selectedRowId != null && (row.original as any)?.id === selectedRowId;
  const isActive = isSelected || isHighlighted;
  const useMenuButton = menuButton && openRowMenu;

  return (
    <div
      data-row="true"
      data-row-id={row.id}
      data-bordered={bordered === false ? "false" : bordered ? "true" : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={surface.style}
      className={cn(
        "relative group w-full rounded-lg bg-card text-card-foreground overflow-hidden",
        surface.className,
        isActive && (bordered ? "border-primary" : "ring-2 ring-primary ring-offset-1 ring-offset-background"),
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Checkbox */}
      {showCheckbox && (
      <div className={cn("absolute top-2 left-2 z-10 transition-opacity duration-200", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(value) => { row.toggleSelected(!!value); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4"
        />
      </div>
      )}

      {/* Actions: MoreVertical menu button or legacy dropdown */}
      {useMenuButton ? (
        <div data-ntable-card-action className="ntable-card-action absolute end-2 top-2 z-10 h-auto transition-opacity duration-200">
          <button
            type="button"
            aria-label="Row actions"
            onClick={(e) => {
              e.stopPropagation();
              openRowMenu!(e, row.original);
            }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      ) : actions && (actions.onView || actions.onEdit || actions.onDelete) ? (
        <div data-ntable-card-action className="ntable-card-action absolute end-2 top-2 z-10 h-auto transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 p-0 rounded-md cursor-pointer justify-center items-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label="Card actions"
              >
                <MoreVertical className="h-4 w-4" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {actions.onView && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); actions.onView!(row.original); }}
                  className="cursor-pointer"
                >
                  <Eye className="h-4 w-4 mr-2" />View
                </DropdownMenuItem>
              )}
              {actions.onEdit && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); actions.onEdit!(row.original); }}
                  className="cursor-pointer"
                >
                  <Edit className="h-4 w-4 mr-2" />Edit
                </DropdownMenuItem>
              )}
              {actions.onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); actions.onDelete!(row.original); }}
                  className="cursor-pointer text-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {/* Expand chevron */}
      {canExpand && (
        <button
          type="button"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} row ${row.id}`}
          aria-expanded={isExpanded}
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className={cn(
            "absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded hover:bg-muted",
            bordered && "border border-border"
          )}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}

      {/* Card body */}
      {children}
    </div>
  );
}
