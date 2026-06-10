import React from "react";
import { cn } from "../../../lib/cn";
import { StepIndicator } from "./StepIndicator";
import { StepsProgress } from "./StepsProgress";
import type { StepMeta, WizardClassNames } from "./types";

export interface StepsHeaderProps {
  steps: StepMeta[];
  currentStep: number;
  completedSteps?: Set<number>;
  onStepClick?: (step: number) => void;
  className?: string;
  classNames?: WizardClassNames;
}

export function StepsHeader({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  className,
  classNames,
}: StepsHeaderProps) {
  return (
    <div className={cn("relative flex items-center", classNames?.header, className)}>
      <StepsProgress steps={steps} currentStep={currentStep} className={classNames?.progressBar} />
      {steps.map((step) => (
        <StepIndicator
          key={step.id}
          stepNumber={step.number}
          title={step.title}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onClick={onStepClick}
          className={classNames?.indicator}
        />
      ))}
    </div>
  );
}
