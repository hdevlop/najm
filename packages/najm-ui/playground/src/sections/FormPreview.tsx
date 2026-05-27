import React from "react";
import { NForm, FormInput } from "najm-ui";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  age: z.coerce.number().min(18, "Must be 18+"),
});

export default function FormPreview() {
  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Form</h2>
      <NForm
        schema={schema}
        defaultValues={{ name: "", email: "", age: 18 }}
        onSubmit={async (values) => {
          alert(JSON.stringify(values, null, 2));
        }}
      >
        <FormInput name="name" type="text" formLabel="Name" required />
        <FormInput name="email" type="text" formLabel="Email" required />
        <FormInput name="age" type="number" formLabel="Age" required />
        <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
          Submit
        </button>
      </NForm>
    </div>
  );
}
