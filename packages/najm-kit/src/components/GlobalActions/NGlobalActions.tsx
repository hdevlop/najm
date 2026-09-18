import * as React from "react";
import { cn } from "../../lib/cn";

export interface NGlobalActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The action group for a page header or navbar slot: spacing, alignment and
 * shrink behavior, nothing else. It fetches, translates, authorizes and
 * persists nothing.
 */
export function NGlobalActions({ children, className }: NGlobalActionsProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0 lg:gap-1 xl:gap-2",
        className,
      )}
      data-slot="global-actions"
    >
      {children}
    </div>
  );
}
NGlobalActions.displayName = "NGlobalActions";
