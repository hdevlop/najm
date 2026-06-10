import React from "react";
import { Button } from "../Button";
import { NIcon, type NIconSource } from "../Icon";
import { cn } from "../../lib/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

export interface NConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  loading?: boolean;
  children?: React.ReactNode;
  icon?: NIconSource;
}

export function NConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
  loading = false,
  children,
  icon,
}: NConfirmDialogProps) {
  const isDestructive = variant === "destructive";
  const resolvedIcon = icon ?? (isDestructive ? "alert-triangle" : "circle-help");

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value && loading) return;
      onOpenChange(value);
    }}>
      <DialogContent>
        <div className="flex flex-col items-center gap-3 text-center pt-1">
          <div
            className={cn(
              "flex size-16 items-center justify-center rounded-full",
              isDestructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}
          >
            <NIcon icon={resolvedIcon} className="size-8" />
          </div>
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className={isDestructive ? "text-destructive" : ""}>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        </div>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
          <Button variant={isDestructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>{loading ? "Processing..." : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
