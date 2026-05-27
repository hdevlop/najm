import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";
import type { DialogStore } from "./store";
import { useDialogStore } from "./store";
import type { DialogConfig } from "./types";

export const dialogVariants = cva(
  "flex flex-col w-full max-w-[95vw] h-full max-h-screen",
  {
    variants: {
      size: {
        sm: "lg:max-w-md",
        md: "lg:max-w-lg",
        lg: "lg:max-w-xl",
        xl: "lg:max-w-2xl",
        xxl: "lg:max-w-3xl",
        full: "lg:max-w-4xl",
      },
      width: {
        sm: "lg:max-w-sm",
        md: "lg:max-w-md",
        lg: "lg:max-w-lg",
        xl: "lg:max-w-xl",
        xxl: "lg:max-w-2xl",
        "3xl": "lg:max-w-3xl",
        "4xl": "lg:max-w-4xl",
        "5xl": "lg:max-w-5xl",
        "6xl": "lg:max-w-6xl",
        "7xl": "lg:max-w-7xl",
        full: "lg:max-w-5/6",
        auto: "lg:w-auto",
      },
      height: {
        auto: "lg:h-auto lg:max-h-[95vh]",
        sm: "lg:h-[40vh]",
        md: "lg:h-[60vh]",
        lg: "lg:h-[70vh]",
        xl: "lg:h-[80vh]",
        xxl: "lg:h-[95vh]",
        full: "lg:h-[95vh]",
      },
    },
    defaultVariants: {
      size: "xl",
      width: "3xl",
      height: "auto",
    },
  }
);

interface DialogItemProps {
  dialog: DialogConfig;
  index: number;
  store: DialogStore;
}

function DialogItem({ dialog, index, store }: DialogItemProps) {
  const {
    id,
    title,
    description,
    children,
    primaryButton,
    secondaryButton,
    showButtons,
    size,
    width,
    height,
    className,
  } = dialog;

  const noTitle = !title || title.trim() === "";
  const noDescription = !description || description.trim() === "";
  const noHeader = noTitle && noDescription;

  const handlePrimary = async (e?: React.FormEvent) => {
    const hasForm = !!primaryButton?.form;
    if (!hasForm && e) e.preventDefault();
    await store.getState().handlePrimaryClick(id);
  };

  const handleSecondary = async (e?: React.FormEvent) => {
    const hasForm = !!secondaryButton?.form;
    if (!hasForm && e) e.preventDefault();
    await store.getState().handleSecondaryClick(id);
  };

  return (
    <Dialog key={id} open={true} onOpenChange={(open) => store.getState().handleOpenChange(id, open)}>
      <DialogContent
        data-dialog-id={id}
        className={cn(dialogVariants({ size, width, height }), className)}
        style={{ zIndex: 9990 + index }}
      >
        <DialogHeader className={cn(noHeader && "sr-only")}>
          <DialogTitle className={cn(noTitle && "sr-only")}>{title}</DialogTitle>
          <DialogDescription className={cn(noDescription && "sr-only")}>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 -mx-1">
          {children}
        </div>

        <DialogFooter className={cn(!showButtons && "sr-only")}>
          {secondaryButton && (
            <Button
              type={secondaryButton.form ? "submit" : "button"}
              data-button-type="secondary"
              onClick={secondaryButton.form ? undefined : handleSecondary}
              disabled={secondaryButton.disabled || secondaryButton.loading || false}
              variant={secondaryButton.variant || "outline"}
              form={secondaryButton.form}
              className="w-auto"
            >
              {secondaryButton.loading ? (secondaryButton.loadingText || "Processing...") : secondaryButton.text}
            </Button>
          )}
          {primaryButton && (
            <Button
              type={primaryButton.form ? "submit" : "button"}
              data-button-type="primary"
              onClick={primaryButton.form ? undefined : handlePrimary}
              disabled={primaryButton.disabled || primaryButton.loading || false}
              variant={primaryButton.variant || "default"}
              form={primaryButton.form}
              className="w-auto"
            >
              {primaryButton.loading ? (primaryButton.loadingText || "Processing...") : primaryButton.text}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface NMultiDialogProps {
  store?: DialogStore;
}

export function NMultiDialog({ store: storeProp }: NMultiDialogProps) {
  const defaultStore = useDialogStore();
  const store = storeProp ?? defaultStore;
  const dialogs = store((s) => s.dialogs);

  return (
    <>
      {dialogs.map((dialog, index) => (
        <DialogItem key={dialog.id} dialog={dialog} index={index} store={store} />
      ))}
    </>
  );
}
