import React from "react";
import { useDialogStore, type DialogStore } from "./store";
import { NDeleteDialogContent } from "./NDeleteDialog";
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
        title: options.title || "Confirm Deletion",
        description: options.description,
        children: React.createElement(NDeleteDialogContent, {
          itemName: options.itemName,
          itemType: options.itemType,
        }),
        size: options.size || "sm",
        className: options.className,
        primaryButton: {
          text: options.confirmText || "Delete",
          variant: "destructive",
          form: "najm-delete-form",
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
