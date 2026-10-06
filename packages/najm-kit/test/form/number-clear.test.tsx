import { describe, expect, mock, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useForm } from "react-hook-form";

import { FormInput, NForm } from "../../src/components/form";

let form: ReturnType<typeof useForm> | undefined;

// user-event's clear() selects the text first, which a number input does not
// support, so erase the way a person does: one Backspace per character.
const erase = (input: HTMLInputElement) =>
  userEvent.type(input, "{Backspace}".repeat(input.value.length));

function Harness({ defaultValues }: { defaultValues: Record<string, unknown> }) {
  form = useForm({ defaultValues });
  return (
    <NForm form={form as any} onSubmit={mock()}>
      <FormInput name="discount" type="number" formLabel="Discount" />
    </NForm>
  );
}

describe("FormInput number field", () => {
  test("a cleared field stays empty and holds null instead of its default", async () => {
    const { getByLabelText } = render(<Harness defaultValues={{ discount: 200 }} />);
    const input = getByLabelText("Discount") as HTMLInputElement;
    expect(input.value).toBe("200");

    await erase(input);

    await waitFor(() => expect(input.value).toBe(""));
    expect(form!.getValues("discount")).toBeNull();
  });

  test("a cleared default of 0 stays empty", async () => {
    const { getByLabelText } = render(<Harness defaultValues={{ discount: 0 }} />);
    const input = getByLabelText("Discount") as HTMLInputElement;

    await erase(input);

    await waitFor(() => expect(input.value).toBe(""));
  });

  test("a value set by the form after clearing is shown", async () => {
    const { getByLabelText } = render(<Harness defaultValues={{ discount: 200 }} />);
    const input = getByLabelText("Discount") as HTMLInputElement;
    await erase(input);
    await waitFor(() => expect(input.value).toBe(""));

    act(() => form!.setValue("discount", 75));
    await waitFor(() => expect(input.value).toBe("75"));

    act(() => form!.reset({ discount: 10 }));
    await waitFor(() => expect(input.value).toBe("10"));
  });

  test("typing after clearing reports the typed number", async () => {
    const { getByLabelText } = render(<Harness defaultValues={{ discount: 200 }} />);
    const input = getByLabelText("Discount") as HTMLInputElement;
    await erase(input);
    await userEvent.type(input, "5");

    await waitFor(() => expect(input.value).toBe("5"));
    expect(form!.getValues("discount")).toBe(5);
  });
});
