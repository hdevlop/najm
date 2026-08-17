import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import { useForm, useFormContext } from "react-hook-form";

import { FormInput, NForm } from "../src/components/form";

function TouchedProbe({ name }: { name: string }) {
  const { formState } = useFormContext();
  return <output data-testid={`${name}-touched`}>{formState.touchedFields[name] ? "yes" : "no"}</output>;
}

function FocusHarness() {
  const form = useForm({ defaultValues: { fullName: "" } });
  return (
    <NForm form={form as any} onSubmit={mock()}>
      <FormInput name="fullName" type="text" formLabel="Full name" />
      <button type="button" onClick={() => form.setFocus("fullName")}>Focus name</button>
    </NForm>
  );
}

describe("FormInput native field binding", () => {
  test("forwards native names and composes consumer blur with React Hook Form", async () => {
    const onBlur = mock();
    const { container, getByLabelText, getByTestId } = render(
      <NForm
        defaultValues={{ fullName: "", age: 0, notes: "", appointmentTime: "" }}
        onSubmit={mock()}
      >
        <FormInput name="fullName" type="text" formLabel="Full name" onBlur={onBlur} />
        <TouchedProbe name="fullName" />
        <FormInput name="age" type="number" formLabel="Age" />
        <FormInput name="notes" type="textarea" formLabel="Notes" />
        <FormInput name="appointmentTime" type="time" formLabel="Appointment time" />
      </NForm>,
    );

    const fullName = getByLabelText("Full name") as HTMLInputElement;
    expect(fullName.name).toBe("fullName");
    expect((getByLabelText("Age") as HTMLInputElement).name).toBe("age");
    expect((getByLabelText("Notes") as HTMLTextAreaElement).name).toBe("notes");
    expect((getByLabelText("Appointment time") as HTMLInputElement).name).toBe("appointmentTime");
    expect(container.querySelector('input[name="fullName"]')).not.toBeNull();

    fireEvent.blur(fullName);

    expect(onBlur).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getByTestId("fullName-touched").textContent).toBe("yes"));
  });

  test("forwards the React Hook Form ref to the native field", async () => {
    const { getByLabelText, getByRole } = render(
      <FocusHarness />,
    );

    const fullName = getByLabelText("Full name") as HTMLInputElement;
    fireEvent.click(getByRole("button", { name: "Focus name" }));

    await waitFor(() => expect(document.activeElement).toBe(fullName));
    // Generous budget on purpose. The assertion itself resolves on the first poll;
    // the cost is mounting NForm's provider tree under happy-dom, which stretches
    // well past 10s when the full 117-file suite is competing for the machine even
    // though this file finishes in ~6s on its own.
  }, 30_000);
});
