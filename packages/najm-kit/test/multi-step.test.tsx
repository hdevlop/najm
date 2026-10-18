import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  test("owns a Najm scroll viewport for every step", () => {
    const steps: StepConfig[] = [
      {
        id: "mode",
        title: "Mode",
        schema: firstStepSchema,
        fields: ["mode"],
        render: ({ form }) => <input aria-label="mode" {...form.register("mode")} />,
      },
    ];

    const rendered = render(
      <WizardForm
        steps={steps}
        schema={firstStepSchema}
        defaultValues={{ mode: "monthly" }}
        onSubmit={mock()}
      />
    );

    const scroll = rendered.container.querySelector('[data-najm-wizard-step-scroll="true"]');
    expect(scroll).not.toBeNull();
    expect(scroll?.className).toContain("flex-1");
    expect(scroll?.querySelector("form")?.className).not.toContain("overflow-y-auto");
    // The overlay bar sits in the gutter, not over the right edge of the fields.
    expect(scroll?.className).toContain("-me-3");
    expect(scroll?.className).toContain("pe-3");
  });

  test("uses a transparent footer surface by default", () => {
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

    const rendered = render(
      <WizardForm
        steps={steps}
        schema={firstStepSchema}
        defaultValues={{ mode: "monthly" }}
        onSubmit={mock()}
      />
    );

    const footer = rendered.container.querySelector("[data-najm-wizard-footer='true']")!;
    expect(footer.className).toContain("bg-transparent");
    expect(footer.className).not.toContain("bg-background/95");
    expect(footer.className).not.toContain("backdrop-blur");
    rendered.unmount();
  });

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

describe("WizardForm draft between steps", () => {
  // 2026-10-18, School /teachers: salary and specialization typed on step 2
  // were blank again after Previous then Next.
  const identity = z.object({ name: z.string().min(1) });
  const profession = z.object({ salary: z.coerce.number().positive(), specialization: z.string().min(3) });
  const draftSteps: StepConfig[] = [
    { id: "identity", title: "Identity", schema: identity, fields: ["name"],
      render: ({ form }) => <input aria-label="name" {...form.register("name")} /> },
    { id: "profession", title: "Profession", schema: profession, fields: ["salary", "specialization"],
      render: ({ form }) => (
        <>
          <input aria-label="salary" {...form.register("salary")} />
          <input aria-label="specialization" {...form.register("specialization")} />
        </>
      ) },
  ];
  const field = (container: HTMLElement, name: string) => container.querySelector(`input[aria-label='${name}']`) as HTMLInputElement;

  for (const via of ["Previous", "the step header"] as const) {
    test(`leaving step 2 by ${via} keeps its unsaved, even invalid, values`, async () => {
      const onSubmit = mock();
      const view = render(
        <WizardForm steps={draftSteps} schema={identity.merge(profession)}
          defaultValues={{ name: "", salary: "", specialization: "" }} onSubmit={onSubmit} />
      );
      await userEvent.type(field(view.container, "name"), "Hicham");
      await act(async () => { fireEvent.click(view.getByText("Next")); });
      await waitFor(() => expect(field(view.container, "salary")).toBeTruthy());

      await userEvent.type(field(view.container, "salary"), "3000");
      await userEvent.type(field(view.container, "specialization"), "Ma");
      await act(async () => {
        fireEvent.click(via === "Previous" ? view.getByText("Previous") : view.getByText("Identity"));
      });
      await waitFor(() => expect(field(view.container, "name")).toBeTruthy());
      expect(field(view.container, "name").value).toBe("Hicham");

      await act(async () => { fireEvent.click(view.getByText("Next")); });
      await waitFor(() => expect(field(view.container, "salary")).toBeTruthy());
      expect(field(view.container, "salary").value).toBe("3000");
      expect(field(view.container, "specialization").value).toBe("Ma");

      // Kept as a draft, not accepted: the step still refuses it.
      await act(async () => { fireEvent.click(view.getByText("Submit")); });
      expect(onSubmit).not.toHaveBeenCalled();
      await userEvent.type(field(view.container, "specialization"), "ths");
      await act(async () => { fireEvent.click(view.getByText("Submit")); });
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toEqual({ name: "Hicham", salary: 3000, specialization: "Maths" });
    });
  }
});
