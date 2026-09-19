import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";

import {
  FormInput,
  WizardForm,
  type StepConfig,
} from "../src/components/form";
import { PhoneInput } from "../src/components/inputs";

const guardianSchema = z.object({
  name: z.string().min(2, "Name is required"),
  relationship: z.string().optional(),
  phone: z.string().refine((value) => value !== "+212", "Phone is required"),
});
const householdSchema = z.object({ notes: z.string() });
const schema = guardianSchema.extend(householdSchema.shape);

const steps: StepConfig[] = [
  {
    id: "guardian",
    title: "Guardian",
    fields: ["name", "relationship", "phone"],
    schema: guardianSchema,
    render: () => (
      <>
        <FormInput name="name" type="text" formLabel="Name" />
        <FormInput
          name="relationship"
          type="select"
          formLabel="Relationship"
          placeholder="Select a relationship"
          items={[
            { value: "mother", label: "Mother" },
            { value: "Mother", label: "Mother" },
          ]}
        />
        <FormInput
          name="phone"
          type="phone"
          formLabel="Household phone"
          defaultCountry="ma"
        />
      </>
    ),
  },
  {
    id: "household",
    title: "Household",
    fields: ["notes"],
    schema: householdSchema,
    render: () => <FormInput name="notes" type="text" formLabel="Notes" />,
  },
];

describe("PhoneInput form integration", () => {
  test("does not publish the default dial code as an empty controlled value", async () => {
    const onChange = mock();
    render(
      <PhoneInput
        value=""
        onChange={onChange}
        defaultCountry="ma"
        ariaLabel="Household phone"
      />,
    );

    await waitFor(() =>
      expect(
        (document.querySelector('[aria-label="Household phone"]') as HTMLInputElement)
          .value,
      ).toContain("+212"),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  test("preserves a controlled prefilled phone when another field changes", async () => {
    const user = userEvent.setup();
    const rendered = render(
      <WizardForm
        steps={steps}
        schema={schema}
        defaultValues={{
          name: "Original",
          relationship: "Mother",
          phone: "+212670415926",
          notes: "",
        }}
        onSubmit={mock()}
      />,
    );

    const phone = rendered.getByLabelText("Household phone") as HTMLInputElement;
    expect(phone.value.replace(/[\s().-]+/g, "")).toBe("+212670415926");

    await user.click(
      rendered.getByRole("combobox", { name: "Select a relationship" }),
    );
    await user.keyboard("{Escape}");

    await user.click(rendered.getByText("Next"));
    await rendered.findByLabelText("Notes");

    await user.click(rendered.getByText("Previous"));
    await waitFor(() =>
      expect(
        (rendered.getByLabelText("Household phone") as HTMLInputElement).value.replace(
          /[\s().-]+/g,
          "",
        ),
      ).toBe("+212670415926"),
    );
  });
});
