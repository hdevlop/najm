import React from "react";
import { ShieldOff } from "lucide-react";
import { NEmptyState } from "./NEmptyState";
import type { NEmptyStateProps } from "./NEmptyState";
import { renderFeedbackIcon } from "./feedbackIcon";
import { useResolvedFeedbackLabels } from "./feedbackDefaults";

/**
 * First-class "access denied" state.
 *
 * Thin preset over `NEmptyState`. Defaults to the page surface and a token-
 * backed `ShieldOff` icon, with title and description resolved from the
 * provider's forbidden defaults. None of the routing, authorization,
 * metadata, or framework-link behavior lives here — that is the
 * application's responsibility.
 */
export interface NForbiddenStateProps extends NEmptyStateProps {
  title?: string;
  description?: string;
}

export function NForbiddenState(props: NForbiddenStateProps) {
  const labels = useResolvedFeedbackLabels();
  const { icon, ...rest } = props;
  const resolvedTitle = props.title ?? labels.forbiddenTitle;
  const resolvedDescription = props.description ?? labels.forbiddenDescription;

  // Pick the icon size based on the surface so the default scales correctly
  // for inline vs page. Static classes only.
  const size: "md" | "xl" = props.surface === "page" ? "xl" : "md";

  const resolvedIcon =
    renderFeedbackIcon(icon, { size, decorative: true }) ??
    renderFeedbackIcon(ShieldOff, { size, decorative: true });

  return (
    <NEmptyState
      {...rest}
      title={resolvedTitle}
      description={resolvedDescription}
      icon={resolvedIcon ?? undefined}
    />
  );
}
