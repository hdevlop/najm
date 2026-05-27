import type { ReactNode, ComponentType } from "react";
import type { DialogSize, DialogWidth, DialogHeight } from "../../lib/types";

export interface ButtonConfig {
  text: string;
  variant?: "default" | "destructive" | "secondary" | "outline" | "tertiary" | "ghost";
  icon?: string | ComponentType<{ className?: string }>;
  loadingText?: string;
  onClick?: (data?: any) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  form?: string;
}

export interface DialogConfig {
  id: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
  showButtons: boolean;
  size?: DialogSize;
  width?: DialogWidth;
  height?: DialogHeight;
  className?: string;
}

/** Internal store shape that adds promise handlers. */
export interface PromiseDialogConfig extends DialogConfig {
  resolve?: (value: any) => void;
  reject?: (reason?: any) => void;
}

export interface PushDialogOptions {
  title?: string;
  description?: string;
  children?: ReactNode;
  primaryButton?: Partial<ButtonConfig>;
  secondaryButton?: Partial<ButtonConfig>;
  showButtons?: boolean;
  size?: DialogSize;
  width?: DialogWidth;
  height?: DialogHeight;
  className?: string;
}

export interface DeleteDialogOptions {
  title?: string;
  description?: string;
  itemName: string;
  itemType?: string;
  confirmText?: string;
  cancelText?: string;
  size?: DialogSize;
  className?: string;
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
}

export interface DialogApi {
  custom: (options: PushDialogOptions) => Promise<any>;
  openDialog: (options: PushDialogOptions) => Promise<any>;
  confirmDelete: (options: DeleteDialogOptions) => Promise<any>;
  closeAll: () => void;
  push: (options: PushDialogOptions) => Promise<any>;
  pop: (result?: any) => void;
}
