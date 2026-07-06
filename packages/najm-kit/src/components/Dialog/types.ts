import type { ReactNode } from "react";
import type { DialogSize, DialogWidth, DialogHeight } from "../../lib/types";
import type { NIconSource } from "../Icon";
import type { NPageHeaderProps } from "../layout/NPageHeader";
import type { DialogPadding } from "./Dialog";

export type DialogActionMode = "auto" | "dialog" | "content";

export interface ButtonConfig {
  text: string;
  variant?: "default" | "destructive" | "secondary" | "outline" | "tertiary" | "ghost";
  icon?: NIconSource;
  loadingText?: string;
  onClick?: (data?: any) => void | Promise<void>;
  onConfirm?: (data?: any) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  form?: string;
}

export interface DialogRenderContext {
  dialog: DialogConfig;
  index: number;
  zIndex: number;
  close: (result?: any) => void;
  confirm: (data?: any) => Promise<void>;
  cancel: (data?: any) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export type DialogRenderer = (context: DialogRenderContext) => ReactNode;

export interface DialogConfig {
  id: string;
  title?: string;
  description?: string;
  /** Renders an NPageHeader as the dialog's header (icon, title, subtitle, actions). Replaces the plain title/description header; `title` is still used as the accessible label. */
  pageHeader?: NPageHeaderProps;
  /** Padding preset for the dialog surface. `none` is ideal for full-bleed content (custom headers, tables). Defaults to `md`. */
  padding?: DialogPadding;
  children?: ReactNode;
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
  showButtons: boolean;
  size?: DialogSize;
  width?: DialogWidth;
  height?: DialogHeight;
  className?: string;
  actionMode?: DialogActionMode;
  render?: DialogRenderer;
}

/** Internal store shape that adds promise handlers. */
export interface PromiseDialogConfig extends DialogConfig {
  resolve?: (value: any) => void;
  reject?: (reason?: any) => void;
}

export interface PushDialogOptions {
  title?: string;
  description?: string;
  /** Renders an NPageHeader as the dialog's header (icon, title, subtitle, actions). Replaces the plain title/description header; `title` is still used as the accessible label. */
  pageHeader?: NPageHeaderProps;
  /** Padding preset for the dialog surface. `none` is ideal for full-bleed content (custom headers, tables). Defaults to `md`. */
  padding?: DialogPadding;
  children?: ReactNode;
  primaryButton?: Partial<ButtonConfig>;
  secondaryButton?: Partial<ButtonConfig>;
  showButtons?: boolean;
  size?: DialogSize;
  width?: DialogWidth;
  height?: DialogHeight;
  className?: string;
  /**
   * Controls which layer owns action buttons.
   * - auto: hide dialog buttons when content declares its own actions
   * - dialog: always use the dialog footer
   * - content: never render the dialog footer buttons
   */
  actionMode?: DialogActionMode;
  render?: DialogRenderer;
}

export interface DeleteDialogOptions {
  title?: string;
  description?: string;
  itemName: string;
  itemType?: string;
  icon?: NIconSource;
  warningText?: string;
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
  pop: (result?: any) => Promise<void>;
}
