import React from "react";
import { NSpinner } from "./NSpinner";
import { cn } from "../../lib/cn";

export interface NLoadingStateProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
  spinnerVariant?: "default" | "circle" | "pinwheel" | "circle-filled" | "ellipsis" | "ring" | "bars";
  spinnerSize?: number;
}

export function NLoadingState({ label = "Loading...", className, fullScreen = false, spinnerVariant = "circle", spinnerSize = 32 }: NLoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-8", fullScreen && "fixed inset-0 z-50 bg-background/80", className)}>
      <NSpinner variant={spinnerVariant} size={spinnerSize} />
      {label && <p className="text-muted-foreground text-sm">{label}</p>}
    </div>
  );
}
