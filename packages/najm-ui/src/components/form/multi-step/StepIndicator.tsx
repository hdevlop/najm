import React from "react";
import { cva } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn } from "../../../lib/cn";

const stepCircleVariants = cva(
  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 mb-3",
  {
    variants: {
      state: {
        completed: "bg-primary border-primary text-primary-foreground shadow-lg",
        active: "bg-primary border-primary text-primary-foreground shadow-md",
        inactive: "bg-background text-foreground border border-border",
      },
    },
    defaultVariants: { state: "inactive" },
  }
);

const stepTitleVariants = cva(
  "text-sm font-medium mb-1 transition-all duration-300",
  {
    variants: {
      state: {
        completed: "text-primary",
        active: "text-primary font-semibold",
        inactive: "text-muted-foreground",
      },
    },
    defaultVariants: { state: "inactive" },
  }
);

function getStepState(stepNumber: number, currentStep: number, completedSteps?: Set<number>) {
  if (completedSteps?.has(stepNumber - 1) || stepNumber < currentStep) return "completed" as const;
  if (stepNumber === currentStep) return "active" as const;
  return "inactive" as const;
}

export interface StepIndicatorProps {
  stepNumber: number;
  title: string;
  currentStep: number;
  completedSteps?: Set<number>;
  onClick?: (step: number) => void;
  className?: string;
}

export function StepIndicator({
  stepNumber,
  title,
  currentStep,
  completedSteps,
  onClick,
  className,
}: StepIndicatorProps) {
  const state = getStepState(stepNumber, currentStep, completedSteps);
  const isCompleted = state === "completed";
  const isClickable = onClick && (stepNumber === 1 || completedSteps?.has(stepNumber - 1));

  return (
    <div
      className={cn("flex flex-col items-center text-center flex-1 z-20", isClickable && "cursor-pointer", className)}
      onClick={isClickable ? () => onClick(stepNumber) : undefined}
    >
      <div className={stepCircleVariants({ state })}>
        {isCompleted ? <Check className="w-5 h-5" /> : <span>{stepNumber}</span>}
      </div>
      <div className={stepTitleVariants({ state })}>{title}</div>
    </div>
  );
}
