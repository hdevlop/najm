import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { z } from "zod";
import { WizardForm } from "../src/components/form";
import type { StepConfig } from "../src/components/form";

const firstStepSchema = z.object({
  mode: z.enum(["monthly", "hourly"]),
});

const secondStepSchema = z.object({
  hourlyRate: z.coerce.number().positive().optional().or(z.literal("")),
});

const thirdStepSchema = z.object({
  notes: z.string().optional(),
});

const fullSchema = firstStepSchema
  .merge(secondStepSchema)
  .merge(thirdStepSchema)
  .superRefine((data, ctx) => {
    if (data.mode === "hourly" && !(Number(data.hourlyRate) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourlyRate"],
        message: "Hourly rate is required",
      });
    }
  });

function errorText(form: any, name: string) {
  const message = form.formState.errors[name]?.message;
  return typeof message === "string" ? <p role="alert">{message}</p> : null;
}

describe("WizardForm", () => {
  test("supports configurable footer divider styles", () => {
    const steps: StepConfig[] = [
      {
        id: "mode",
        title: "Mode",
        schema: firstStepSchema,
        fields: ["mode"],
        render: ({ form }) => (
          <select aria-label="mode" {...form.register("mode")}>
            <option value="monthly">Monthly</option>
            <option value="hourly">Hourly</option>
          </select>
        ),
      },
    ];

    const defaultDivider = render(
      <WizardForm
        steps={steps}
        schema={firstStepSchema}
        defaultValues={{ mode: "monthly" }}
        onSubmit={mock()}
      />
    );

    expect(defaultDivider.container.querySelector("[data-najm-wizard-footer='true']")!.className).toContain("border-t-0");
    defaultDivider.unmount();

    const dashed = render(
      <WizardForm
        steps={steps}
        schema={firstStepSchema}
        defaultValues={{ mode: "monthly" }}
        onSubmit={mock()}
        footerDivider="dashed"
        footerDividerClassName="border-primary"
      />
    );

    const dashedFooter = dashed.container.querySelector("[data-najm-wizard-footer='true']")!;
    expect(dashedFooter.className).toContain("border-dashed");
    expect(dashedFooter.className).toContain("border-primary");
    dashed.unmount();

    const hidden = render(
      <WizardForm
        steps={steps}
        schema={firstStepSchema}
        defaultValues={{ mode: "monthly" }}
        onSubmit={mock()}
        footerDivider={false}
      />
    );

    expect(hidden.container.querySelector("[data-najm-wizard-footer='true']")!.className).toContain("border-t-0");
  });

  test("routes full-schema validation errors back to the owning step", async () => {
    const onSubmit = mock();
    const steps: StepConfig[] = [
      {
        id: "mode",
        title: "Mode",
        schema: firstStepSchema,
        fields: ["mode"],
        render: ({ form }) => (
          <select aria-label="mode" {...form.register("mode")}>
            <option value="monthly">Monthly</option>
            <option value="hourly">Hourly</option>
          </select>
        ),
      },
      {
        id: "pay",
        title: "Pay",
        schema: secondStepSchema,
        fields: ["hourlyRate"],
        render: ({ form }) => (
          <>
            <input aria-label="hourly rate" type="number" {...form.register("hourlyRate")} />
            {errorText(form, "hourlyRate")}
          </>
        ),
      },
      {
        id: "review",
        title: "Review",
        schema: thirdStepSchema,
        fields: ["notes"],
        render: ({ form }) => (
          <input aria-label="notes" {...form.register("notes")} />
        ),
      },
    ];

    const { container, getByText } = render(
      <WizardForm
        steps={steps}
        schema={fullSchema}
        defaultValues={{ mode: "hourly", hourlyRate: "", notes: "" }}
        onSubmit={onSubmit}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("select[aria-label='mode']")!, {
        target: { value: "hourly" },
      });
      fireEvent.click(getByText("Next"));
    });

    await waitFor(() => {
      expect(container.querySelector("input[aria-label='hourly rate']")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(getByText("Next"));
    });

    await waitFor(() => {
      expect(container.querySelector("input[aria-label='notes']")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(getByText("Submit"));
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Hourly rate is required");
    });

    expect(container.querySelector("input[aria-label='hourly rate']")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
