import React from "react";
import type { LucideIcon } from "lucide-react";
import { NFeedbackStateFrame } from "./NFeedbackStateFrame";
import type { NFeedbackSurface } from "./NFeedbackStateFrame";
import { renderFeedbackIcon } from "./feedbackIcon";
import { useResolvedFeedbackLabels } from "./feedbackDefaults";

export interface NEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode | LucideIcon;
  action?: React.ReactNode;
  className?: string;
  /** Layout surface. See `NLoadingStateProps.surface`. */
  surface?: NFeedbackSurface;
}

export function NEmptyState({
  title,
  description,
  icon,
  action,
  className,
  surface = "inline",
}: NEmptyStateProps) {
  const labels = useResolvedFeedbackLabels();
  const resolvedTitle = title ?? labels.emptyTitle;

  const iconNode = icon
    ? renderFeedbackIcon(icon, { size: "md", decorative: true })
    : null;

  return (
    <NFeedbackStateFrame
      surface={surface}
      spacing="empty"
      className={className}
    >
      {iconNode && <div className="text-muted-foreground/50">{iconNode}</div>}
      <div className="text-center">
        {resolvedTitle && <h3 className="font-semibold text-foreground">{resolvedTitle}</h3>}
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </NFeedbackStateFrame>
  );
}
