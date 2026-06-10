import React from "react";
import { Eye, Pencil, Trash2, MoreVertical } from "lucide-react";
import { cn } from "../../lib/cn";
import { borderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import type { NajmBorderDegree } from "../../theme/types";

interface TableActionCellProps {
  row: any;
  onView?: ((row: any) => void) | null;
  onEdit?: ((row: any) => void) | null;
  onDelete?: ((row: any) => void) | null;
  openRowMenu?: ((e: React.MouseEvent, row: any) => void) | null;
  menuButton?: boolean;
  bordered?: boolean;
  borderDegree?: NajmBorderDegree;
}

const actionButtonClass = (bordered?: boolean, danger?: boolean, borderClass?: string) => cn(
  "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
  danger ? "hover:bg-red-500/10 hover:text-red-400" : "hover:bg-muted hover:text-foreground",
  bordered && `border ${borderClass ?? "border-muted-foreground"}`
);

export function TableActionCell({ row, onView, onEdit, onDelete, openRowMenu, menuButton, bordered, borderDegree }: TableActionCellProps) {
  const resolvedBorderDegree = useResolvedBorderDegree({
    borderDegree,
    bordered,
    fallback: "default",
  });
  const borderClass = borderColorClassForDegree(resolvedBorderDegree);

  if (menuButton && openRowMenu) {
    return (
      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Row actions"
          onClick={(e) => {
            e.stopPropagation();
            openRowMenu(e, row.original);
          }}
          className={actionButtonClass(false)}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start gap-1" onClick={(e) => e.stopPropagation()}>
      {onView && (
        <button
          type="button"
          aria-label="View"
          onClick={() => onView(row.original)}
          className={actionButtonClass(bordered, false, borderClass)}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          aria-label="Edit"
          onClick={() => onEdit(row.original)}
          className={actionButtonClass(bordered, false, borderClass)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label="Delete"
          onClick={() => onDelete(row.original)}
          className={actionButtonClass(bordered, true, borderClass)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
