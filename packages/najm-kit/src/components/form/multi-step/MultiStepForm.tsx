import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "../../ui/form";
import { Button } from "../../Button";
import { cn } from "../../../lib/cn";
import { StepsHeader } from "./StepsHeader";
import { useStepNavigation } from "./hooks/useStepNavigation";
import { useFormSubmission } from "./hooks/useFormSubmission";
import { VariantProvider } from "../VariantContext";
import type { WizardFooterDivider, WizardFormProps } from "./types";
import { useResolvedFormDevTools } from "../FormDevToolsContext";

type ValidationIssue = {
  path?: Array<string | number>;
  message?: string;
};

function issuePath(issue: ValidationIssue) {
  return issue.path?.map(String).join(".") ?? "";
}

function matchesFieldPath(path: string, field: string) {
  return path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`);
}

function footerDividerClass(divider: WizardFooterDivider = "none") {
  if (divider === false || divider === "none") return "border-t-0";
  if (divider === "dashed") return "border-t border-dashed border-border";
  if (divider === "dotted") return "border-t border-dotted border-border";
  return "border-t border-solid border-border";
}

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
  footerDivider = "none",
  footerDividerClassName,
  devTools,
}: WizardFormProps) {
  const resolvedDevTools = useResolvedFormDevTools(schema, devTools);
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
  const pendingIssuesRef = useRef<{ stepIndex: number; issues: ValidationIssue[] } | null>(null);

  const getIssueStepIndex = (issue: ValidationIssue) => {
    const path = issuePath(issue);
    if (!path) return nav.currentStep - 1;

    const stepIndex = steps.findIndex((step) =>
      step.fields?.some((field) => matchesFieldPath(path, field))
    );

    return stepIndex >= 0 ? stepIndex : nav.currentStep - 1;
  };

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

  const fillWizard = useCallback(() => {
    if (!resolvedDevTools.fill) return;
    const values = {
      ...(defaultValues ?? {}),
      ...resolvedDevTools.fill(),
    };
    formDataRef.current = values;
    pendingIssuesRef.current = null;
    nav.reset();
    const firstStep = steps[0];
    const firstValues = firstStep?.fields
      ? Object.fromEntries(
          firstStep.fields
            .filter((field) => field in values)
            .map((field) => [field, values[field]]),
        )
      : values;
    form.reset(firstValues);
  }, [defaultValues, form, formDataRef, nav, resolvedDevTools.fill, steps]);

  useEffect(() => {
    if (!resolvedDevTools.enabled || !resolvedDevTools.fill) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== resolvedDevTools.shortcut) return;
      event.preventDefault();
      fillWizard();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    fillWizard,
    resolvedDevTools.enabled,
    resolvedDevTools.fill,
    resolvedDevTools.shortcut,
  ]);

  useEffect(() => {
    const newDefaults = getStepDefaultValues(currentStepConfig.id);
    form.reset(newDefaults as any);
  }, [nav.currentStep, currentStepConfig.id]);

  useEffect(() => {
    const pending = pendingIssuesRef.current;
    if (!pending || pending.stepIndex !== nav.currentStep - 1) return;

    pendingIssuesRef.current = null;
    pending.issues.forEach((issue, index) => {
      const name = issuePath(issue) || "root";
      form.setError(
        name as any,
        { type: "validate", message: issue.message ?? "Invalid value" },
        { shouldFocus: index === 0 }
      );
    });
  }, [nav.currentStep, currentStepConfig.id, form]);

  const handleSubmit = async (data: any) => {
    onStepComplete?.(nav.currentStep - 1, data);
    const result = await handleStepSubmit(data);
    if (result.ok === true) return;

    const issues: ValidationIssue[] = Array.isArray(result.error?.issues)
      ? result.error.issues
      : [];

    if (issues.length === 0) {
      throw result.error;
    }

    const targetStepIndex = getIssueStepIndex(issues[0]);
    const targetIssues = issues.filter((issue) => getIssueStepIndex(issue) === targetStepIndex);

    if (targetStepIndex === nav.currentStep - 1) {
      pendingIssuesRef.current = { stepIndex: targetStepIndex, issues: targetIssues };
      const pending = pendingIssuesRef.current;
      pendingIssuesRef.current = null;
      pending.issues.forEach((issue, index) => {
        const name = issuePath(issue) || "root";
        form.setError(
          name as any,
          { type: "validate", message: issue.message ?? "Invalid value" },
          { shouldFocus: index === 0 }
        );
      });
      return;
    }

    pendingIssuesRef.current = { stepIndex: targetStepIndex, issues: targetIssues };
    nav.goToStep(targetStepIndex + 1);
  };

  return (
    <div
      data-najm-wizard-form="true"
      data-najm-dialog-actions="content"
      className={cn("flex min-h-full w-full flex-col gap-4", classNames?.root, className)}
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
            className={cn("min-h-0 flex-1 overflow-y-auto pb-4 flex flex-col gap-4", classNames?.step)}
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
        <div
          data-najm-wizard-footer="true"
          className={cn(
            "sticky bottom-0 z-10 mt-auto flex shrink-0 items-center justify-between bg-background/95 pt-3 backdrop-blur",
            footerDividerClass(footerDivider),
            footerDividerClassName,
            classNames?.footer
          )}
        >
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
