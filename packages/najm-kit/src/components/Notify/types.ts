import type { ComponentType, ReactNode } from "react";

/**
 * Presentation-only notification row.
 *
 * The package never sees a topic, a raw payload, an aggregate, a recipient or
 * an API response shape: applications map their own records to this before
 * rendering. `href` is data — Najm Kit never imports or calls a router, it
 * hands the item back through `onOpenItem` and the application navigates.
 */
export interface NNotifyItemData {
  id: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt?: string | Date;
  icon?: ComponentType<{ className?: string }> | ReactNode;
  tone?: NNotifyTone;
}

export type NNotifyTone = "default" | "success" | "warning" | "destructive";

/** Every user-visible string. Applications own their translation catalogs. */
export interface NNotifyLabels {
  open: string;
  unread: (count: number) => string;
  title: string;
  loading: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  retry: string;
  markRead: string;
  markingRead?: string;
  markAllRead: string;
  markingAll?: string;
  view: string;
  viewAll: string;
  unreadState?: string;
  justNow?: string;
}

export type NNotifyAction = "markRead" | "markAll" | "open" | "viewAll";

/**
 * What a command callback may return.
 *
 * Deliberately not `Promise<void>`: React Query's `mutateAsync` resolves with
 * the mutation's result, and a `Promise<T>` is not assignable to a
 * `Promise<void>`. Narrowing it would make every application wrap every
 * command in an async arrow that throws the value away. The package only ever
 * awaits these.
 */
export type NNotifyCommandResult = void | Promise<unknown>;

export type NNotifyErrorHandler = (error: unknown, action: NNotifyAction) => void;
