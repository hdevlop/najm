import React from "react";
import { NSpinner } from "./NSpinner";
import { NFeedbackStateFrame } from "./NFeedbackStateFrame";
import type { NFeedbackSurface } from "./NFeedbackStateFrame";
import { useResolvedFeedbackLabels } from "./feedbackDefaults";
import { cn } from "../../lib/cn";

export interface NLoadingStateProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
  spinnerVariant?: "default" | "circle" | "pinwheel" | "circle-filled" | "ellipsis" | "ring" | "bars";
  spinnerSize?: number;
  /**
   * Layout surface. `inline` is the default and preserves the legacy look;
   * `panel` is for table/dialog/sheet bodies; `page` uses page spacing
   * without introducing a `<main>`. `fullScreen` takes precedence and renders
   * the fixed viewport overlay regardless of surface.
   */
  surface?: NFeedbackSurface;
}

/**
 * Resolve the visible loading label.
 *
 * Resolution order: explicit prop wins; provider literal default beats the
 * provider catalog key beats packaged English. An explicit empty string still
 * hides the text — that is how an opt-out is expressed, not how a missing
 * default is.
 */
function useLoadingLabel(explicit: string | undefined): string | undefined {
  const labels = useResolvedFeedbackLabels();
  if (explicit !== undefined) return explicit;
  return labels.loadingLabel;
}

export function NLoadingState({
  label,
  className,
  fullScreen = false,
  spinnerVariant = "circle",
  spinnerSize = 32,
  surface = "inline",
}: NLoadingStateProps) {
  const resolvedLabel = useLoadingLabel(label);

  if (fullScreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 py-8",
          className,
        )}
      >
        <NSpinner variant={spinnerVariant} size={spinnerSize} />
        {resolvedLabel && <p className="text-muted-foreground text-sm">{resolvedLabel}</p>}
      </div>
    );
  }

  return (
    <NFeedbackStateFrame
      surface={surface}
      spacing="loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={className}
    >
      <NSpinner variant={spinnerVariant} size={spinnerSize} />
      {resolvedLabel && <p className="text-muted-foreground text-sm">{resolvedLabel}</p>}
    </NFeedbackStateFrame>
  );
}
