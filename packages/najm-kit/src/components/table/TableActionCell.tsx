import React from "react";
import { Eye, Pencil, Trash2, MoreVertical } from "lucide-react";
import { cn } from "../../lib/cn";
import { useRowActionCopy } from "./rowActionLabels";

interface TableActionCellProps {
  row: any;
  onView?: ((row: any) => void) | null;
  onEdit?: ((row: any) => void) | null;
  onDelete?: ((row: any) => void) | null;
  openRowMenu?: ((e: React.MouseEvent, row: any) => void) | null;
  menuButton?: boolean;
  bordered?: boolean;
}

const actionButtonClass = (bordered?: boolean, danger?: boolean) => cn(
  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
  danger ? "hover:border-red-200 hover:bg-red-50 hover:text-red-500" : "hover:border-border hover:bg-muted hover:text-foreground",
  bordered && "border border-muted-foreground"
);

/** The actions column's header, translated like the buttons below it. */
export function TableActionsHeader() {
  const copy = useRowActionCopy();
  return <div className="flex w-full justify-start text-left">{copy.actionsColumn}</div>;
}

export function TableActionCell({ row, onView, onEdit, onDelete, openRowMenu, menuButton, bordered }: TableActionCellProps) {
  const copy = useRowActionCopy();
  if (menuButton && openRowMenu) {
    return (
      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={copy.rowActions}
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
          aria-label={copy.rowView}
          onClick={() => onView(row.original)}
          className={actionButtonClass(bordered, false)}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          aria-label={copy.rowEdit}
          onClick={() => onEdit(row.original)}
          className={actionButtonClass(bordered, false)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label={copy.rowDelete}
          onClick={() => onDelete(row.original)}
          className={actionButtonClass(bordered, true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
