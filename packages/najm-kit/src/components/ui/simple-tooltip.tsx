import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

export interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  disabled?: boolean;
  variant?: "filled" | "outlined";
}

export function SimpleTooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 300,
  disabled = false,
  variant = "outlined",
}: SimpleTooltipProps) {
  if (disabled || content == null || content === false) return <>{children}</>;
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} variant={variant}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}