import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "../../ui/form";
import { Button } from "../../Button";
import { cn } from "../../../lib/cn";
import { StepsHeader } from "./StepsHeader";
import { useStepNavigation } from "./hooks/useStepNavigation";
import { useFormSubmission } from "./hooks/useFormSubmission";
import { VariantProvider } from "../VariantContext";
import type { WizardFormProps } from "./types";

export function WizardForm({
  steps,
  schema,
  defaultValues,
  onSubmit,
  currentStep: controlledStep,
  onCurrentStepChange,
  onStepComplete,
  showHeader = true,
  showFooter = true,
  nextLabel = "Next",
  previousLabel = "Previous",
  submitLabel = "Submit",
  variant = "default",
  bordered,
  className,
  classNames,
  footerSlot,
}: WizardFormProps) {
  const nav = useStepNavigation({
    steps,
    currentStep: controlledStep,
    onCurrentStepChange,
  });

  const { formDataRef, handleStepSubmit, getStepDefaultValues } = useFormSubmission({
    steps,
    schema,
    defaultValues,
    onSubmit,
    currentStep: nav.currentStep,
    isLastStep: nav.isLastStep,
    handleNext: nav.handleNext,
    markStepCompleted: nav.markStepCompleted,
    reset: nav.reset,
  });

  const currentStepConfig = nav.currentStepConfig;
  const stepDefaults = getStepDefaultValues(currentStepConfig.id);

  const stepSchema = useMemo(() => {
    if (currentStepConfig.schema) return currentStepConfig.schema;
    if (currentStepConfig.fields && schema?.pick) {
      const shape = Object.fromEntries(currentStepConfig.fields.map((f: string) => [f, true]));
      return schema.pick(shape);
    }
    return undefined;
  }, [currentStepConfig, schema]);

  const form = useForm({
    resolver: stepSchema ? zodResolver(stepSchema as any) : undefined,
    defaultValues: stepDefaults as any,
  });

  useEffect(() => {
    const newDefaults = getStepDefaultValues(currentStepConfig.id);
    form.reset(newDefaults as any);
  }, [nav.currentStep, currentStepConfig.id]);

  const handleSubmit = async (data: any) => {
    onStepComplete?.(nav.currentStep - 1, data);
    await handleStepSubmit(data);
  };

  return (
    <div
      data-najm-wizard-form="true"
      data-najm-dialog-actions="content"
      className={cn("flex w-full flex-col gap-4", classNames?.root, className)}
    >
      {showHeader && (
        <StepsHeader
          steps={nav.steps}
          currentStep={nav.currentStep}
          completedSteps={nav.completedSteps}
          onStepClick={nav.goToStep}
          classNames={classNames}
        />
      )}

      <Form {...form}>
        <VariantProvider variant={variant} bordered={bordered}>
          <form
            id={`step-${currentStepConfig.id}`}
            onSubmit={form.handleSubmit(handleSubmit)}
            className={cn("flex flex-col gap-4", classNames?.step)}
            autoComplete="off"
          >
            {currentStepConfig.description && (
              <p className="text-sm text-muted-foreground">{currentStepConfig.description}</p>
            )}
            {currentStepConfig.render({ form, stepIndex: nav.currentStep - 1 })}
          </form>
        </VariantProvider>
      </Form>

      {showFooter && (
        <div className={cn("flex items-center justify-between", classNames?.footer)}>
          <div>
            {!nav.isFirstStep && (
              <Button type="button" variant="outline" onClick={nav.handlePrevious}>
                {previousLabel}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {footerSlot}
            {nav.isLastStep ? (
              <Button type="submit" form={`step-${currentStepConfig.id}`}>
                {submitLabel}
              </Button>
            ) : (
              <Button type="submit" form={`step-${currentStepConfig.id}`}>
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
