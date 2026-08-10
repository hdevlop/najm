import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../Button";
import { NFeedbackStateFrame } from "./NFeedbackStateFrame";
import type { NFeedbackSurface } from "./NFeedbackStateFrame";
import { renderFeedbackIcon } from "./feedbackIcon";
import { useResolvedFeedbackLabels } from "./feedbackDefaults";
import { cn } from "../../lib/cn";

export interface NErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  icon?: React.ReactNode;
  /** Layout surface. See `NLoadingStateProps.surface`. */
  surface?: NFeedbackSurface;
}

export function NErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  className,
  icon,
  surface = "inline",
}: NErrorStateProps) {
  const labels = useResolvedFeedbackLabels();

  const resolvedTitle = title ?? labels.errorTitle;
  const resolvedMessage = message ?? labels.errorMessage;
  const resolvedRetryLabel = retryLabel ?? labels.retryLabel;

  const iconNode = renderFeedbackIcon(icon, { size: "md", decorative: true }) ?? (
    <AlertTriangle className="h-10 w-10" aria-hidden="true" />
  );

  return (
    <NFeedbackStateFrame
      surface={surface}
      spacing="error"
      role="alert"
      className={className}
    >
      <div className="text-destructive">{iconNode}</div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{resolvedTitle}</h3>
        {resolvedMessage && (
          <p className="text-muted-foreground text-sm mt-1">{resolvedMessage}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className={cn("mt-1")}>
          {resolvedRetryLabel}
        </Button>
      )}
    </NFeedbackStateFrame>
  );
}
