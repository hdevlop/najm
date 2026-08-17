import { describe, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";

import { FormInput, NForm } from "../src/components/form";

// Composite inputs render their trigger as a styled `BaseInput` div, so the
// `<label for>` that `FormControl` wires up lands on a non-labelable element and
// names nothing. Every assertion here goes through `getByRole(..., { name })`,
// which resolves through the accessible name computation a browser and
// Playwright actually use — `getByLabelText` follows `for`/`id` directly and
// would pass even while the control is anonymous in the accessibility tree.

function CompositeForm() {
  return (
    <NForm
      defaultValues={{ dateOfBirth: "", capabilities: [], city: "" }}
      onSubmit={mock()}
    >
      <FormInput name="dateOfBirth" type="date" formLabel="Date of birth" required />
      <FormInput
        name="capabilities"
        type="multiselect"
        formLabel="Capabilities"
        items={[
          { value: "operator", label: "Operator" },
          { value: "delivery", label: "Delivery" },
        ]}
        required
      />
      <FormInput
        name="city"
        type="combobox"
        formLabel="City"
        items={[{ value: "casablanca", label: "Casablanca" }]}
      />
    </NForm>
  );
}

describe("composite FormInput accessible names", () => {
  test("names the date, multiselect, and combobox triggers from their form label", () => {
    const { getByRole } = render(<CompositeForm />);

    expect(getByRole("button", { name: "Date of birth" })).toBeDefined();
    expect(getByRole("combobox", { name: "Capabilities" })).toBeDefined();
    expect(getByRole("combobox", { name: "City" })).toBeDefined();
  });

  test("exposes the date trigger as a focusable button, not an inert div", () => {
    const { getByRole } = render(<CompositeForm />);

    const trigger = getByRole("button", { name: "Date of birth" });

    expect(trigger.tagName).toBe("BUTTON");
    // A submit-typed trigger inside NForm would post the form on every open.
    expect(trigger.getAttribute("type")).toBe("button");

    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  test("keeps the required marker out of the accessible name", () => {
    const { getByRole, queryByRole } = render(<CompositeForm />);

    expect(getByRole("button", { name: "Date of birth" })).toBeDefined();
    expect(queryByRole("button", { name: "Date of birth *" })).toBeNull();
  });

  test("lets an explicit ariaLabel win over the form label", () => {
    const { getByRole } = render(
      <NForm defaultValues={{ capabilities: [] }} onSubmit={mock()}>
        <FormInput
          name="capabilities"
          type="multiselect"
          formLabel="Capabilities"
          ariaLabel="Staff capabilities"
          items={[{ value: "delivery", label: "Delivery" }]}
        />
      </NForm>,
    );

    expect(getByRole("combobox", { name: "Staff capabilities" })).toBeDefined();
  });

  test("leaves the select placeholder naming contract alone", () => {
    // SelectInput already resolves a name through `ariaLabel || placeholder`.
    // Consumers select these by placeholder today; naming them from the form
    // label instead would be a separate, deliberate breaking change.
    const { getByRole } = render(
      <NForm defaultValues={{ housing: "" }} onSubmit={mock()}>
        <FormInput
          name="housing"
          type="select"
          formLabel="Housing situation"
          placeholder="Choose a housing situation"
          items={[{ value: "rented", label: "Rented" }]}
        />
      </NForm>,
    );

    expect(getByRole("combobox", { name: "Choose a housing situation" })).toBeDefined();
  });

  test("does not disturb native field labelling", () => {
    const { getByLabelText, getByRole } = render(
      <NForm defaultValues={{ fullName: "" }} onSubmit={mock()}>
        <FormInput name="fullName" type="text" formLabel="Full name" required />
      </NForm>,
    );

    const input = getByLabelText(/^Full name/) as HTMLInputElement;
    expect(input.name).toBe("fullName");
    expect(input.getAttribute("aria-label")).toBeNull();
    expect(getByRole("textbox", { name: /^Full name/ })).toBe(input);
  });
});
