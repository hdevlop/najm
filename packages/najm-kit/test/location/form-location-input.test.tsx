import React from "react";
import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { z } from "zod";
import { NForm } from "../../src/components/form";
import { FormLocationInput, NLocationProvider } from "../../src/location";

const schema = z.object({
  household: z.object({
    deliveryLocation: z.object({
      address: z.string().min(5, "Address is too short"),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
    }),
  }),
});

describe("FormLocationInput", () => {
  test("registers one prefixed object field and exposes nested errors", async () => {
    const view = render(
      <NLocationProvider>
        <NForm schema={schema} defaultValues={{ household: { deliveryLocation: { address: "", latitude: null, longitude: null } } }} onSubmit={() => {}}>
          <FormLocationInput name="household.deliveryLocation" formLabel="Location" required />
          <button type="submit">Submit</button>
        </NForm>
      </NLocationProvider>,
    );
    expect(view.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.click(view.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(view.getByText("Address is too short")).toBeDefined());
  });
});
