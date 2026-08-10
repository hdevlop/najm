import React from "react";
import { Compass } from "lucide-react";
import { NEmptyState } from "./NEmptyState";
import type { NEmptyStateProps } from "./NEmptyState";
import { renderFeedbackIcon } from "./feedbackIcon";
import { useResolvedFeedbackLabels } from "./feedbackDefaults";

/**
 * First-class "page not found" state.
 *
 * Thin preset over `NEmptyState`. Defaults to the page surface and a `Compass`
 * icon, with title and description resolved from the provider's not-found
 * defaults. None of the route-target, metadata, redirect, or framework-link
 * behavior lives here.
 */
export interface NNotFoundStateProps extends NEmptyStateProps {
  title?: string;
  description?: string;
}

export function NNotFoundState(props: NNotFoundStateProps) {
  const labels = useResolvedFeedbackLabels();
  const { icon, ...rest } = props;
  const resolvedTitle = props.title ?? labels.notFoundTitle;
  const resolvedDescription = props.description ?? labels.notFoundDescription;

  const size: "md" | "xl" = props.surface === "page" ? "xl" : "md";

  const resolvedIcon =
    renderFeedbackIcon(icon, { size, decorative: true }) ??
    renderFeedbackIcon(Compass, { size, decorative: true });

  return (
    <NEmptyState
      {...rest}
      title={resolvedTitle}
      description={resolvedDescription}
      icon={resolvedIcon ?? undefined}
    />
  );
}
