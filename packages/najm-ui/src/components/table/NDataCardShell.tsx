import React from "react";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Eye, Edit, Trash2, MoreVertical, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
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
}

export function NDataCardShell({ row, onClick, onContextMenu, actions, children, className }: NDataCardShellProps) {
  const canExpand = row.getCanExpand();
  const isExpanded = canExpand && row.getIsExpanded();
  const isSelected = row.getIsSelected();

  return (
    <Card
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "relative p-4 h-auto transition-all duration-200 hover:shadow-md group w-full sm:w-[calc(50%-12px)] lg:w-[calc(33%-16px)] xl:w-[calc(25%-18px)]",
        isSelected && "ring-1 ring-primary",
        className
      )}
    >
      {/* Checkbox */}
      <div className={cn("absolute top-2 left-2 z-10 transition-opacity duration-200", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(value) => { row.toggleSelected(!!value); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4"
        />
      </div>

      {/* Actions dropdown */}
      {actions && (actions.onView || actions.onEdit || actions.onDelete) && (
        <div className="absolute top-2 right-2 h-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex h-8 w-8 p-0 rounded-full cursor-pointer justify-center items-center"
                aria-label="Card actions"
              >
                <MoreVertical className="h-5 w-5" />
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
      )}

      {/* Expand chevron */}
      {canExpand && (
        <button
          type="button"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} row ${row.id}`}
          aria-expanded={isExpanded}
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className="absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}

      {/* Card body */}
      {children}
    </Card>
  );
}