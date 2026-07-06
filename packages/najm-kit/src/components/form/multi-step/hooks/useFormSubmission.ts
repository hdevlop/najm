import { useRef, useCallback } from "react";
import type { StepConfig } from "../types";

interface UseFormSubmissionOptions {
  steps: StepConfig[];
  schema: any;
  defaultValues?: Record<string, any>;
  onSubmit: (data: any) => void | Promise<void>;
  currentStep: number;
  isLastStep: boolean;
  handleNext: () => void;
  markStepCompleted: (stepIndex: number) => void;
  reset: () => void;
}

interface FormSubmissionState {
  formDataRef: React.MutableRefObject<Record<string, any>>;
  handleStepSubmit: (stepData: any) => Promise<StepSubmitResult>;
  getStepDefaultValues: (stepId: string) => Record<string, any>;
}

export type StepSubmitResult =
  | { ok: true }
  | { ok: false; error: any; data: Record<string, any> };

export function useFormSubmission({
  steps,
  schema,
  defaultValues,
  onSubmit,
  currentStep,
  isLastStep,
  handleNext,
  markStepCompleted,
  reset,
}: UseFormSubmissionOptions): FormSubmissionState {
  const formDataRef = useRef<Record<string, any>>(defaultValues ?? {});

  const getStepDefaultValues = useCallback(
    (stepId: string) => {
      const stepConfig = steps.find((s) => s.id === stepId);
      if (stepConfig?.fields) {
        const picked: Record<string, any> = {};
        for (const field of stepConfig.fields) {
          if (field in formDataRef.current) picked[field] = formDataRef.current[field];
        }
        if (Object.keys(picked).length > 0) return picked;
      }
      if (defaultValues && stepConfig?.fields) {
        const picked: Record<string, any> = {};
        for (const field of stepConfig.fields) {
          if (field in defaultValues) picked[field] = defaultValues[field];
        }
        if (Object.keys(picked).length > 0) return picked;
      }
      return {};
    },
    [defaultValues, steps]
  );

  const handleStepSubmit = useCallback(
    async (stepData: any): Promise<StepSubmitResult> => {
      const stepId = steps[currentStep - 1]?.id;
      if (stepId) {
        formDataRef.current = { ...formDataRef.current, ...stepData };
      }

      if (!isLastStep) {
        markStepCompleted(currentStep - 1);
        handleNext();
        return { ok: true };
      } else {
        const fullData = { ...formDataRef.current };
        let submitData = fullData;

        if (schema?.parse) {
          const result = schema.safeParse?.(fullData);

          if (result) {
            if (!result.success) {
              return { ok: false, error: result.error, data: fullData };
            }
            submitData = result.data;
          } else {
            submitData = schema.parse(fullData);
          }
        }

        await onSubmit(submitData);
        markStepCompleted(currentStep - 1);
        reset();
        formDataRef.current = defaultValues ?? {};
        return { ok: true };
      }
    },
    [steps, currentStep, isLastStep, schema, onSubmit, handleNext, markStepCompleted, reset, defaultValues]
  );

  return { formDataRef, handleStepSubmit, getStepDefaultValues };
}
