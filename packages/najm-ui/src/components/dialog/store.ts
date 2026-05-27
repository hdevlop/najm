import { create } from "zustand";
import type { PromiseDialogConfig, PushDialogOptions, ButtonConfig } from "./types";

export interface DialogStoreState {
  dialogs: PromiseDialogConfig[];
  pushDialog: (config: PushDialogOptions) => Promise<any>;
  popDialog: (result?: any) => void;
  closeDialog: (id: string, result?: any) => void;
  closeAllDialogs: () => void;
  setPrimaryLoading: (loading: boolean) => void;
  updatePrimaryButton: (config: Partial<ButtonConfig>, dialogId?: string) => void;
  updateSecondaryButton: (config: Partial<ButtonConfig>, dialogId?: string) => void;
  updateShowButtons: (show: boolean, dialogId?: string) => void;
  handlePrimaryClick: (dialogId: string, data?: any) => Promise<void>;
  handleSecondaryClick: (dialogId: string, data?: any) => Promise<void>;
  handleOpenChange: (dialogId: string, open: boolean) => void;
}

const generateId = () => `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const buildButtonConfig = (partial: Partial<ButtonConfig> | undefined, defaults: ButtonConfig): ButtonConfig => {
  return { ...defaults, ...partial };
};

export function createDialogStore() {
  return create<DialogStoreState>((set, get) => ({
    dialogs: [],

    pushDialog: (config) => {
      return new Promise((resolve, reject) => {
        const id = generateId();

        const primaryButtonConfig = buildButtonConfig(config.primaryButton, {
          text: "Confirm",
          variant: "default",
          loading: false,
          disabled: false,
          loadingText: "Processing...",
        });

        const secondaryButtonConfig = buildButtonConfig(config.secondaryButton, {
          text: "Cancel",
          variant: "outline",
          loading: false,
          disabled: false,
          loadingText: "Processing...",
        });

        const dialogConfig: PromiseDialogConfig = {
          id,
          title: config.title,
          description: config.description,
          children: config.children,
          primaryButton: primaryButtonConfig,
          secondaryButton: secondaryButtonConfig,
          showButtons: config.showButtons ?? true,
          size: config.size,
          width: config.width,
          height: config.height,
          className: config.className,
          resolve,
          reject,
        };

        set((state) => ({ dialogs: [...state.dialogs, dialogConfig] }));
      });
    },

    popDialog: (result) => {
      const { dialogs } = get();
      if (dialogs.length === 0) return;
      const dialog = dialogs[dialogs.length - 1];
      dialog.resolve?.(result);
      set((state) => ({ dialogs: state.dialogs.slice(0, -1) }));
    },

    closeDialog: (id, result) => {
      const { dialogs } = get();
      const dialog = dialogs.find((d) => d.id === id);
      if (!dialog) return;
      dialog.resolve?.(result);
      set((state) => ({ dialogs: state.dialogs.filter((d) => d.id !== id) }));
    },

    closeAllDialogs: () => {
      const { dialogs } = get();
      dialogs.forEach((d) => d.reject?.(new Error("All dialogs closed")));
      set({ dialogs: [] });
    },

    setPrimaryLoading: (loading) => {
      set((state) => {
        const newDialogs = [...state.dialogs];
        const idx = newDialogs.length - 1;
        if (idx < 0 || !newDialogs[idx].primaryButton) return state;
        newDialogs[idx] = {
          ...newDialogs[idx],
          primaryButton: { ...newDialogs[idx].primaryButton!, loading },
        };
        return { dialogs: newDialogs };
      });
    },

    updatePrimaryButton: (config, dialogId) => {
      set((state) => {
        const newDialogs = [...state.dialogs];
        const idx = dialogId ? newDialogs.findIndex((d) => d.id === dialogId) : newDialogs.length - 1;
        if (idx === -1 || !newDialogs[idx].primaryButton) return state;
        newDialogs[idx] = {
          ...newDialogs[idx],
          primaryButton: { ...newDialogs[idx].primaryButton!, ...config },
        };
        return { dialogs: newDialogs };
      });
    },

    updateSecondaryButton: (config, dialogId) => {
      set((state) => {
        const newDialogs = [...state.dialogs];
        const idx = dialogId ? newDialogs.findIndex((d) => d.id === dialogId) : newDialogs.length - 1;
        if (idx === -1 || !newDialogs[idx].secondaryButton) return state;
        newDialogs[idx] = {
          ...newDialogs[idx],
          secondaryButton: { ...newDialogs[idx].secondaryButton!, ...config },
        };
        return { dialogs: newDialogs };
      });
    },

    updateShowButtons: (show, dialogId) => {
      set((state) => {
        const newDialogs = [...state.dialogs];
        const idx = dialogId ? newDialogs.findIndex((d) => d.id === dialogId) : newDialogs.length - 1;
        if (idx === -1) return state;
        newDialogs[idx] = { ...newDialogs[idx], showButtons: show };
        return { dialogs: newDialogs };
      });
    },

    handlePrimaryClick: async (dialogId, data) => {
      const { dialogs, setPrimaryLoading, closeDialog } = get();
      const dialog = dialogs.find((d) => d.id === dialogId);
      if (!dialog?.primaryButton) return;

      const { onClick } = dialog.primaryButton;
      if (onClick) {
        setPrimaryLoading(true);
        try {
          await onClick(data);
          closeDialog(dialogId, data);
        } finally {
          setPrimaryLoading(false);
        }
      } else {
        closeDialog(dialogId, data);
      }
    },

    handleSecondaryClick: async (dialogId, data) => {
      const { dialogs, closeDialog } = get();
      const dialog = dialogs.find((d) => d.id === dialogId);

      if (!dialog?.secondaryButton) {
        closeDialog(dialogId, null);
        return;
      }

      const { onClick } = dialog.secondaryButton;
      if (onClick) {
        await onClick(data);
      }
      closeDialog(dialogId, null);
    },

    handleOpenChange: (dialogId, open) => {
      if (!open) {
        const { closeDialog } = get();
        closeDialog(dialogId, null);
      }
    },
  }));
}

export type DialogStore = ReturnType<typeof createDialogStore>;

// Default singleton store — used by useDialog() and NMultiDialog unless overridden.
const defaultStore = createDialogStore();

export function useDialogStore(): DialogStore {
  return defaultStore;
}
