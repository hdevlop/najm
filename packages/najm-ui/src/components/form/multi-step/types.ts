import type { ReactNode } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  fields?: string[];
  schema?: any;
  render: (ctx: { form: UseFormReturn<any>; stepIndex: number }) => ReactNode;
}

export interface MultiStepClassNames {
  root?: string;
  header?: string;
  step?: string;
  footer?: string;
  indicator?: string;
  progressBar?: string;
}

export interface MultiStepFormProps {
  steps: StepConfig[];
  schema: any;
  defaultValues?: Record<string, any>;
  onSubmit: (data: any) => void | Promise<void>;
  currentStep?: number;
  onCurrentStepChange?: (step: number) => void;
  onStepComplete?: (stepIndex: number, data: Record<string, any>) => void;
  showHeader?: boolean;
  showFooter?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  submitLabel?: string;
  className?: string;
  classNames?: MultiStepClassNames;
  footerSlot?: ReactNode;
  children?: ReactNode;
}

export interface StepMeta {
  id: string;
  number: number;
  title: string;
}
