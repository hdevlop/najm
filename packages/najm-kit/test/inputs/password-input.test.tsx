import { describe, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
import { z } from "zod";

import { FormInput, NForm } from "../../src/components/form";

describe("PasswordInput", () => {
  test("associates an NForm label with the native password input", () => {
    const { getByLabelText } = render(
      <NForm
        schema={z.object({ password: z.string() })}
        defaultValues={{ password: "" }}
        onSubmit={mock()}
      >
        <FormInput
          name="password"
          type="password"
          formLabel="New password"
          autoComplete="new-password"
        />
      </NForm>,
    );

    const input = getByLabelText("New password") as HTMLInputElement;

    expect(input.type).toBe("password");
    expect(input.id).not.toBe("");
    expect(input.autocomplete).toBe("new-password");
  });
});
