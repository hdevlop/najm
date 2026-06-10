import React from "react";
import { useDialogStore, type DialogStore } from "./store";
import { NDeleteDialog } from "./NDeleteDialog";
import type { PushDialogOptions, DeleteDialogOptions, DialogApi } from "./types";

export function useDialog(store?: DialogStore): DialogApi {
  const resolvedStore = store ?? useDialogStore();

  const custom = async (options: PushDialogOptions) => {
    try {
      return await resolvedStore.getState().pushDialog(options);
    } catch (error) {
      console.error("[useDialog] Failed to push dialog:", error);
      return null;
    }
  };

  const confirmDelete = async (options: DeleteDialogOptions) => {
    try {
      return await resolvedStore.getState().pushDialog({
        title: options.title || "Delete",
        description: options.description,
        size: options.size || "sm",
        className: options.className,
        render: ({ dialog, zIndex, confirm, cancel, onOpenChange }) =>
          React.createElement(NDeleteDialog, {
            itemName: options.itemName,
            itemType: options.itemType,
            icon: options.icon,
            title: dialog.title,
            description: dialog.description,
            confirmText: dialog.primaryButton?.text,
            cancelText: dialog.secondaryButton?.text,
            loading: dialog.primaryButton?.loading,
            className: dialog.className,
            zIndex,
            onOpenChange,
            onConfirm: () => confirm(),
            onCancel: () => cancel(),
          }),
        primaryButton: {
          text: options.confirmText || "Confirm",
          variant: "destructive",
          loading: options.loading,
          onClick: options.onConfirm,
        },
        secondaryButton: {
          text: options.cancelText || "Cancel",
          variant: "outline",
        },
        showButtons: true,
      });
    } catch (error) {
      console.error("[useDialog] Failed to show confirmDelete:", error);
      return null;
    }
  };

  return {
    custom,
    openDialog: custom,
    confirmDelete,
    closeAll: () => resolvedStore.getState().closeAllDialogs(),
    push: (opts) => resolvedStore.getState().pushDialog(opts),
    pop: (result) => resolvedStore.getState().popDialog(result),
  };
}
