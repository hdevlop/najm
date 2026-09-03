import { cn } from "../../lib/cn";
import { Button } from "../Button";
import { NIcon, type NIconSource } from "../Icon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";

export interface NDeleteDialogContentProps {
  itemName: string;
  itemType?: string;
  icon?: NIconSource;
  warningText?: string;
  className?: string;
}

export interface NDeleteDialogProps extends Omit<NDeleteDialogContentProps, "className"> {
  open?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  zIndex?: number;
  className?: string;
  contentClassName?: string;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

export function NDeleteDialogContent({
  itemName,
  itemType,
  icon: Icon = "trash-2",
  warningText = "Are you sure you want to delete?",
  className,
}: NDeleteDialogContentProps) {
  return (
    <form id="najm-delete-form" onSubmit={(e) => e.preventDefault()}>
      <div className={cn("flex flex-col items-center text-center", className)}>
        <div className="mb-6 flex size-16 items-center justify-center rounded-[20px] bg-destructive/10 text-destructive dark:bg-[#5a1822] dark:text-white">
          <NIcon icon={Icon} className="size-7" />
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold leading-none text-card-foreground dark:text-white">Delete</h2>
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-5 text-muted-foreground dark:text-[#aab4c2]">{warningText}</p>
            <p className="max-w-[280px] truncate text-sm font-bold leading-5 text-card-foreground dark:text-white">
              "{itemName}"
              {itemType ? <> ({itemType})</> : null}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

export function NDeleteDialog({
  open = true,
  title = "Delete",
  description,
  itemName,
  itemType,
  icon,
  warningText,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading,
  zIndex,
  className,
  contentClassName,
  onOpenChange,
  onConfirm,
  onCancel,
}: NDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "h-auto max-w-[380px] gap-0 rounded-[18px] border border-border bg-card p-6 pt-8 shadow-2xl dark:border-0 dark:bg-[#222b38]",
          "[&>button]:end-4 [&>button]:top-4 [&>button]:flex [&>button]:size-6 [&>button]:items-center [&>button]:justify-center",
          "[&>button]:rounded-full [&>button]:bg-muted [&>button]:text-muted-foreground [&>button]:opacity-100 [&>button]:ring-offset-0",
          "[&>button]:hover:bg-secondary [&>button]:hover:text-foreground dark:[&>button]:bg-[#4d5a6d] dark:[&>button]:text-white dark:[&>button]:hover:bg-[#647186] dark:[&>button]:hover:text-white",
          className
        )}
        style={{ zIndex }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <NDeleteDialogContent
          itemName={itemName}
          itemType={itemType}
          icon={icon}
          warningText={warningText}
          className={contentClassName}
        />

        <DialogFooter className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            data-button-type="secondary"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="h-10 w-full rounded-[10px] border border-border bg-secondary text-sm font-bold text-secondary-foreground shadow-none hover:bg-secondary/80 hover:text-secondary-foreground dark:border-0 dark:bg-[#3e4a5d] dark:text-white dark:hover:bg-[#4b586c] dark:hover:text-white"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            data-button-type="primary"
            variant="destructive"
            onClick={onConfirm}
            loading={loading}
            className="h-10 w-full rounded-[10px] bg-destructive text-sm font-bold text-destructive-foreground shadow-none hover:bg-destructive/90 focus-visible:ring-destructive/40 dark:bg-[#dc4d61] dark:text-white dark:hover:bg-[#e15f70] dark:focus-visible:ring-[#dc4d61]/40"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
