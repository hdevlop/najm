import { useState, useCallback, useMemo } from "react";
import type { StepConfig, StepMeta } from "../types";

interface UseStepNavigationOptions {
  steps: StepConfig[];
  currentStep?: number;
  onCurrentStepChange?: (step: number) => void;
}

interface StepNavState {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentStepConfig: StepConfig;
  steps: StepMeta[];
  completedSteps: Set<number>;
  handleNext: () => void;
  handlePrevious: () => void;
  goToStep: (step: number) => void;
  markStepCompleted: (stepIndex: number) => void;
  reset: () => void;
}

export function useStepNavigation({
  steps,
  currentStep: controlledStep,
  onCurrentStepChange,
}: UseStepNavigationOptions): StepNavState {
  const [internalStep, setInternalStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const totalSteps = steps.length;
  const currentStep = controlledStep ?? internalStep;
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const setCurrentStep = useCallback(
    (step: number) => {
      if (onCurrentStepChange) {
        onCurrentStepChange(step);
      } else {
        setInternalStep(step);
      }
    },
    [onCurrentStepChange]
  );

  const markStepCompleted = useCallback(
    (stepIndex: number) => {
      setCompletedSteps((prev) => new Set([...prev, stepIndex]));
    },
    []
  );

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps) {
      markStepCompleted(currentStep - 1);
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, setCurrentStep, markStepCompleted]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 1 && step <= totalSteps) {
        if (step === 1 || completedSteps.has(step - 1)) {
          setCurrentStep(step);
        }
      }
    },
    [totalSteps, completedSteps, setCurrentStep]
  );

  const reset = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
  }, [setCurrentStep]);

  const currentStepConfig = steps[currentStep - 1];

  const stepMeta = useMemo<StepMeta[]>(
    () =>
      steps.map((step, index) => ({
        id: step.id,
        number: index + 1,
        title: step.title,
      })),
    [steps]
  );

  return {
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    currentStepConfig,
    steps: stepMeta,
    completedSteps,
    handleNext,
    handlePrevious,
    goToStep,
    markStepCompleted,
    reset,
  };
}
