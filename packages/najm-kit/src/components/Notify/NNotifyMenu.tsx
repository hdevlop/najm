import * as React from "react";
import { NNotifyContent, type NNotifyContentProps } from "./NNotifyContent";
import { NNotifyFooter } from "./NNotifyFooter";
import { NNotifyHeader } from "./NNotifyHeader";
import { NNotifyList } from "./NNotifyList";
import { NNotifyRoot } from "./NNotifyRoot";
import { NNotifyTrigger, type NNotifyTriggerProps } from "./NNotifyTrigger";
import type {
  NNotifyCommandResult,
  NNotifyErrorHandler,
  NNotifyItemData,
  NNotifyLabels,
} from "./types";

export interface NNotifyMenuProps {
  items: readonly NNotifyItemData[];
  unreadCount: number;
  labels: NNotifyLabels;
  loading?: boolean;
  error?: string | boolean;
  markAllPending?: boolean;
  markReadPendingId?: string | null;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRetry?: () => NNotifyCommandResult;
  onMarkRead?: (id: string) => NNotifyCommandResult;
  onMarkAllRead?: () => NNotifyCommandResult;
  onOpenItem?: (item: NNotifyItemData) => NNotifyCommandResult;
  onViewAll?: () => NNotifyCommandResult;
  onError?: NNotifyErrorHandler;
  /** An application link rendered as the view-all action. */
  viewAllLink?: React.ReactNode;
  triggerProps?: Omit<NNotifyTriggerProps, "unreadCount" | "label" | "unreadLabel">;
  contentProps?: Omit<NNotifyContentProps, "children">;
  locale?: string;
  className?: string;
}

/**
 * The whole list-with-read-button workflow from normalized data, labels and
 * callbacks. Applications whose preview data must only load while the menu is
 * open compose the flat parts instead and put a connected child inside
 * `NNotifyContent`.
 */
export function NNotifyMenu({
  items,
  unreadCount,
  labels,
  loading,
  error,
  markAllPending,
  markReadPendingId,
  open,
  defaultOpen,
  onOpenChange,
  onRetry,
  onMarkRead,
  onMarkAllRead,
  onOpenItem,
  onViewAll,
  onError,
  viewAllLink,
  triggerProps,
  contentProps,
  locale,
  className,
}: NNotifyMenuProps) {
  return (
    <NNotifyRoot defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
      <NNotifyTrigger
        locale={locale}
        {...triggerProps}
        label={labels.open}
        unreadCount={unreadCount}
        unreadLabel={labels.unread}
      />
      <NNotifyContent {...contentProps} className={className}>
        <NNotifyHeader
          markAllLabel={labels.markAllRead}
          markAllPending={markAllPending}
          markingAllLabel={labels.markingAll}
          onError={onError}
          onMarkAllRead={onMarkAllRead}
          title={labels.title}
        />
        <NNotifyList
          error={error}
          items={items}
          labels={labels}
          loading={loading}
          locale={locale}
          markReadPendingId={markReadPendingId}
          onError={onError}
          onMarkRead={onMarkRead}
          onOpenItem={onOpenItem}
          onRetry={onRetry}
        />
        {viewAllLink ? (
          <NNotifyFooter asChild onError={onError}>
            {viewAllLink}
          </NNotifyFooter>
        ) : onViewAll ? (
          <NNotifyFooter
            label={labels.viewAll}
            onError={onError}
            onViewAll={onViewAll}
          />
        ) : null}
      </NNotifyContent>
    </NNotifyRoot>
  );
}
NNotifyMenu.displayName = "NNotifyMenu";
