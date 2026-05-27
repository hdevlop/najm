import React from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

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
}

export function NConfirmDialog({ open, onOpenChange, title = "Are you sure?", description, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, variant = "default", loading = false, children }: NConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && loading) return; onOpenChange(v); }}>
      <DialogContent>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center rounded-full bg-destructive/10 p-4">
            <Trash2 className="size-10 text-destructive" />
          </div>
          <DialogHeader>
            <DialogTitle className={variant === "destructive" ? "text-destructive" : ""}>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        </div>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>{loading ? "Processing..." : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
