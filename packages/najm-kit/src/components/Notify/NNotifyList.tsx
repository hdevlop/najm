import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "../../lib/cn";
import { NEmptyState } from "../feedback/NEmptyState";
import { NErrorState } from "../feedback/NErrorState";
import { NLoadingState } from "../feedback/NLoadingState";
import { NNotifyItem, type NNotifyItemProps } from "./NNotifyItem";
import type {
  NNotifyErrorHandler,
  NNotifyItemData,
  NNotifyLabels,
} from "./types";

export interface NNotifyRenderItemHelpers {
  pending: boolean;
  onMarkRead?: (id: string) => void | Promise<void>;
  onOpenItem?: (item: NNotifyItemData) => void | Promise<void>;
  onError?: NNotifyErrorHandler;
}

export interface NNotifyListProps {
  items: readonly NNotifyItemData[];
  labels: NNotifyLabels;
  loading?: boolean;
  /** `true` uses `labels.errorTitle`; a string replaces it. */
  error?: string | boolean;
  onRetry?: () => void | Promise<void>;
  markReadPendingId?: string | null;
  onMarkRead?: (id: string) => void | Promise<void>;
  onOpenItem?: (item: NNotifyItemData) => void | Promise<void>;
  onError?: NNotifyErrorHandler;
  /** Escape hatch. The default row covers the common workflow already. */
  renderItem?: (
    item: NNotifyItemData,
    helpers: NNotifyRenderItemHelpers,
  ) => React.ReactNode;
  itemProps?: Partial<Omit<NNotifyItemProps, "item" | "labels">>;
  emptyIcon?: React.ReactNode;
  locale?: string;
  className?: string;
}

/** Loading, error, empty and populated states inside one bounded scroll area. */
export function NNotifyList({
  items,
  labels,
  loading = false,
  error,
  onRetry,
  markReadPendingId,
  onMarkRead,
  onOpenItem,
  onError,
  renderItem,
  itemProps,
  emptyIcon,
  locale,
  className,
}: NNotifyListProps) {
  const body = loading ? (
    <NLoadingState label={labels.loading} />
  ) : error ? (
    <NErrorState
      onRetry={onRetry ? () => void onRetry() : undefined}
      retryLabel={labels.retry}
      title={typeof error === "string" ? error : labels.errorTitle}
    />
  ) : items.length === 0 ? (
    <NEmptyState
      description={labels.emptyDescription}
      icon={emptyIcon ?? Bell}
      title={labels.emptyTitle}
    />
  ) : (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const pending = markReadPendingId === item.id;
        return (
          <React.Fragment key={item.id}>
            {renderItem ? (
              renderItem(item, { pending, onMarkRead, onOpenItem, onError })
            ) : (
              <NNotifyItem
                {...itemProps}
                item={item}
                labels={labels}
                locale={locale}
                onError={onError}
                onMarkRead={onMarkRead}
                onOpenItem={onOpenItem}
                pending={pending}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      data-slot="notify-list"
    >
      {body}
    </div>
  );
}
NNotifyList.displayName = "NNotifyList";
