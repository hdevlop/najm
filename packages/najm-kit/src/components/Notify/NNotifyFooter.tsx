import * as React from "react";
import { cn } from "../../lib/cn";
import { NButton } from "../Button";
import type { NNotifyCommandResult, NNotifyErrorHandler } from "./types";
import { useNNotifyClose } from "./NNotifyContext";

export interface NNotifyFooterProps {
  label?: string;
  onViewAll?: () => NNotifyCommandResult;
  /** Render an application link instead of a button. */
  asChild?: boolean;
  children?: React.ReactNode;
  onError?: NNotifyErrorHandler;
  className?: string;
}

/**
 * The view-all action. The menu closes only once the supplied action is
 * accepted; what "view all" means — a route, a dialog, a tab — is the
 * application's decision.
 */
export function NNotifyFooter({
  label,
  onViewAll,
  asChild = false,
  children,
  onError,
  className,
}: NNotifyFooterProps) {
  const close = useNNotifyClose();

  async function handleViewAll() {
    try {
      await onViewAll?.();
      close?.();
    } catch (error) {
      onError?.(error, "viewAll");
    }
  }

  return (
    <div
      className={cn(
        "flex justify-end border-t border-border px-2 pt-2",
        className,
      )}
      data-slot="notify-footer"
    >
      <NButton
        asChild={asChild}
        autoLoading={false}
        onClick={() => void handleViewAll()}
        size="sm"
        type={asChild ? undefined : "button"}
        variant="link"
      >
        {asChild ? children : label}
      </NButton>
    </div>
  );
}
NNotifyFooter.displayName = "NNotifyFooter";
