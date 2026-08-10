import * as React from "react";

import { NPageLayout } from "../layout/NPageLayout";
import { cn } from "../../lib/cn";

/**
 * Shared surface a feedback state renders into.
 *
 * - `inline` (default) keeps each component's existing padding and sizing. No
 *   landmark, no page gutter.
 * - `panel` is for table bodies, card bodies, dialogs, sheets, and nested
 *   surfaces. Centered with a minimum height, no landmark, no page gutter.
 * - `page` is for actual route-level states. Uses page spacing from the design
 *   config, but renders through `NPageLayout as="div"` so it never introduces
 *   another `<main>` inside an already-paged shell.
 */
export type NFeedbackSurface = "inline" | "panel" | "page";

/**
 * Internal layout contract shared by all five public feedback states.
 *
 * Variants let each component keep its legacy padding on `inline` (loading
 * uses `py-8`, empty uses `py-12`) without copying the same class strings
 * five times. `panel` and `page` get the new minimum-height + page-spacing
 * behavior; the consumer's `className` is still merged on top.
 */
export type NFeedbackSpacingVariant = "loading" | "error" | "empty";

interface NFeedbackStateFrameProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  surface?: NFeedbackSurface;
  spacing?: NFeedbackSpacingVariant;
  children: React.ReactNode;
}

const INLINE_PADDING: Record<NFeedbackSpacingVariant, string> = {
  loading: "py-8",
  error: "py-8",
  empty: "py-12",
};

const PANEL_BASE = "grid place-items-center min-h-64 w-full";
const PAGE_MIN = "min-h-[60vh]";

/**
 * Shared surface/layout resolver. Internal — public consumers reach the five
 * state components, not this frame. Lives in one place so `panel` cannot
 * regress to leaking a page gutter and `page` cannot regress to introducing a
 * second `<main>`.
 */
export function NFeedbackStateFrame({
  surface = "inline",
  spacing = "empty",
  className,
  children,
  ...rest
}: NFeedbackStateFrameProps) {
  if (surface === "page") {
    return (
      <NPageLayout
        as="div"
        className={cn(
          "items-center justify-center text-center",
          PAGE_MIN,
          className,
        )}
        {...rest}
      >
        {children}
      </NPageLayout>
    );
  }

  if (surface === "panel") {
    return (
      <div className={cn(PANEL_BASE, className)} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", INLINE_PADDING[spacing], className)} {...rest}>
      {children}
    </div>
  );
}
