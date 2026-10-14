import { describe, expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import React from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";

import DynamicArray from "../../src/components/form/DynamicArray";

let form: UseFormReturn<any> | undefined;

function Harness({ items }: { items: unknown[] }) {
  form = useForm<any>({ defaultValues: { items } });
  return (
    <FormProvider {...form}>
      <DynamicArray name="items" addLabel="Add fee" emptyLabel="No fees yet.">
        <span>item</span>
      </DynamicArray>
    </FormProvider>
  );
}

// A rule on the list itself ("at least one fee") belongs to no item, so no
// item showed it: a wizard whose last step failed only that rule refused to
// submit with nothing on screen.
describe("DynamicArray list error", () => {
  test("shows an error set on the list as a root error", async () => {
    const { container, getByRole } = render(<Harness items={[]} />);
    expect(container.querySelector("[data-dynamic-array-error]")).toBeNull();

    await act(async () => {
      form!.setError("items.root" as any, { type: "too_small", message: "At least one fee is required" });
    });

    expect(getByRole("alert").textContent).toBe("At least one fee is required");
    expect(container.querySelector("button[aria-invalid='true']")).toBeTruthy();
  });

  test("shows an error set on the list itself", async () => {
    const { getByRole } = render(<Harness items={[]} />);

    await act(async () => {
      form!.setError("items" as any, { type: "too_small", message: "At least one fee is required" });
    });

    expect(getByRole("alert").textContent).toBe("At least one fee is required");
  });

  test("keeps the message under a list that has items", async () => {
    const { getByRole, getAllByText } = render(<Harness items={[{}]} />);
    expect(getAllByText("item")).toHaveLength(1);

    await act(async () => {
      form!.setError("items.root" as any, { type: "custom", message: "Pick a different fee" });
    });

    expect(getByRole("alert").textContent).toBe("Pick a different fee");
  });
});
