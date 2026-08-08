import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { z } from "zod";

import {
  buildFormFill,
  FormDevToolsProvider,
  FormInput,
  NForm,
  WizardForm,
  type StepConfig,
} from "../src/components/form";

const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  cin: z.string().min(8),
  active: z.boolean(),
});

function TestForm({ disabled = false }: { disabled?: boolean }) {
  return (
    <NForm
      schema={formSchema}
      defaultValues={{ name: "", email: "", cin: "", active: false }}
      onSubmit={mock()}
      devTools={disabled ? false : undefined}
    >
      <FormInput name="name" type="text" formLabel="Name" />
      <FormInput name="email" type="text" formLabel="Email" />
      <FormInput name="cin" type="text" formLabel="CIN" />
      <FormInput name="active" type="checkbox" formLabel="Active" />
    </NForm>
  );
}

describe("form development tools", () => {
  test("builds valid nested Zod values and resolves option overrides", () => {
    const schema = z.object({
      projectId: z.string().uuid(),
      mode: z.enum(["draft", "published"]),
      profile: z.object({ email: z.string().email() }),
      children: z.array(z.object({ legalName: z.string().min(2) })),
    });

    const values = buildFormFill(schema, {
      projectId: [
        {
          label: "Project",
          value: "9cc2c93f-f545-4e07-9f77-f79f08a71dd5",
        },
      ],
    });

    expect(schema.safeParse(values).success).toBe(true);
    expect(values.projectId).toBe("9cc2c93f-f545-4e07-9f77-f79f08a71dd5");
    expect(values.children).toHaveLength(1);
  });

  test("the global provider enables F8 filling", async () => {
    const { getByLabelText } = render(
      <FormDevToolsProvider value>
        <TestForm />
      </FormDevToolsProvider>,
    );

    fireEvent.keyDown(document, { key: "F8" });

    await waitFor(() =>
      expect((getByLabelText("Name") as HTMLInputElement).value).toBe("Test User"),
    );
    expect((getByLabelText("Email") as HTMLInputElement).value).toMatch(/@example\.com$/);
    expect((getByLabelText("CIN") as HTMLInputElement).value).toMatch(/^AB\d{6}$/);
  });

  test("a form can explicitly opt out of globally enabled filling", () => {
    const { getByLabelText } = render(
      <FormDevToolsProvider value>
        <TestForm disabled />
      </FormDevToolsProvider>,
    );

    fireEvent.keyDown(document, { key: "F8" });
    expect((getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  test("WizardForm fills every step from the global provider", async () => {
    const firstSchema = z.object({ name: z.string().min(2) });
    const secondSchema = z.object({ email: z.string().email() });
    const schema = firstSchema.merge(secondSchema);
    const steps: StepConfig[] = [
      {
        id: "identity",
        title: "Identity",
        fields: ["name"],
        schema: firstSchema,
        render: ({ form }) => <input aria-label="wizard name" {...form.register("name")} />,
      },
      {
        id: "contact",
        title: "Contact",
        fields: ["email"],
        schema: secondSchema,
        render: ({ form }) => <input aria-label="wizard email" {...form.register("email")} />,
      },
    ];

    const { getByLabelText, getByText } = render(
      <FormDevToolsProvider value>
        <WizardForm
          steps={steps}
          schema={schema}
          defaultValues={{ name: "", email: "" }}
          onSubmit={mock()}
        />
      </FormDevToolsProvider>,
    );

    fireEvent.keyDown(document, { key: "F8" });
    await waitFor(() =>
      expect((getByLabelText("wizard name") as HTMLInputElement).value).toBe("Test User"),
    );
    fireEvent.click(getByText("Next"));
    await waitFor(() =>
      expect((getByLabelText("wizard email") as HTMLInputElement).value).toMatch(/@example\.com$/),
    );
  });
});
