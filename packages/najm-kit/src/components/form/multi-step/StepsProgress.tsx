import React from "react";
import { cn } from "../../../lib/cn";
import type { StepMeta } from "./types";

export interface StepsProgressProps {
  steps: StepMeta[];
  currentStep: number;
  className?: string;
}

export function StepsProgress({ steps, currentStep, className }: StepsProgressProps) {
  const progressPercentage =
    steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0;

  const firstStepCenter = steps.length > 1 ? 100 / steps.length / 2 : 0;
  const lineWidth = steps.length > 1 ? 100 - 100 / steps.length : 0;

  return (
    <div
      className={cn("absolute h-0.5 mb-3 top-4", className)}
      style={{ left: `${firstStepCenter}%`, width: `${lineWidth}%` }}
    >
      <div className="absolute inset-0 bg-muted-foreground/30 rounded-full" />
      <div
        className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  );
}
