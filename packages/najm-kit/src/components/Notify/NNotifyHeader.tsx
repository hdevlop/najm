import * as React from "react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import type { NNotifyErrorHandler } from "./types";

export interface NNotifyHeaderProps {
  title: string;
  markAllLabel?: string;
  markingAllLabel?: string;
  /** Application-owned pending state; the component also tracks its own. */
  markAllPending?: boolean;
  onMarkAllRead?: () => void | Promise<void>;
  onError?: NNotifyErrorHandler;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Title plus the mark-all action. A rejected command reports through
 * `onError` and leaves the menu open — the package emits no product copy of
 * its own for the failure.
 */
export function NNotifyHeader({
  title,
  markAllLabel,
  markingAllLabel,
  markAllPending = false,
  onMarkAllRead,
  onError,
  children,
  className,
}: NNotifyHeaderProps) {
  const [pending, setPending] = React.useState(false);
  const isPending = pending || markAllPending;

  async function handleMarkAll() {
    if (isPending || !onMarkAllRead) return;
    setPending(true);
    try {
      await onMarkAllRead();
    } catch (error) {
      onError?.(error, "markAll");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn("flex items-center justify-between px-2 pt-1", className)}
      data-slot="notify-header"
    >
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex items-center gap-1">
        {children}
        {onMarkAllRead && markAllLabel ? (
          <NButton
            autoLoading={false}
            disabled={isPending}
            onClick={() => void handleMarkAll()}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isPending ? markingAllLabel ?? markAllLabel : markAllLabel}
          </NButton>
        ) : null}
      </div>
    </div>
  );
}
NNotifyHeader.displayName = "NNotifyHeader";
