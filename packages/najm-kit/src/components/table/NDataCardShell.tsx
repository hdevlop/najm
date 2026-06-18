import React from "react";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Eye, Edit, Trash2, MoreVertical, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { surfaceBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";
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
}

export function NDataCardShell({ row, onClick, onContextMenu, actions, children, className, showCheckbox = true, selectedRowId, openRowMenu, menuButton, bordered }: NDataCardShellProps) {
  const recipe = useNajmComponentStyle("table");
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  const recipeStyle: React.CSSProperties | undefined =
    recipeRadius || recipe?.borderWidth
      ? {
          ...(recipeRadius ? { borderRadius: recipeRadius } : {}),
          ...(recipe?.borderWidth ? { borderWidth: recipe.borderWidth } : {}),
        }
      : undefined;
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
      style={recipeStyle}
      className={cn(
        "relative group w-full rounded-lg bg-card",
        surfaceBorderClasses(bordered),
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
        <div className="absolute top-2 right-2 h-auto z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label="Row actions"
            onClick={(e) => {
              e.stopPropagation();
              openRowMenu!(e, row.original);
            }}
            className="flex h-7 w-7 p-0 rounded-md cursor-pointer justify-center items-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      ) : actions && (actions.onView || actions.onEdit || actions.onDelete) ? (
        <div className="absolute top-2 right-2 h-auto z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
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
