import React, { useState } from "react";
import { z } from "zod";
import { WizardForm, TextInput, Card, CardContent , NButton } from 'najm-kit';
import type { StepConfig } from "najm-kit";

const basicSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  company: z.string().optional(),
  bio: z.string().optional(),
});

type FormData = z.infer<typeof basicSchema>;

const steps: StepConfig[] = [
  {
    id: "personal",
    title: "Personal",
    fields: ["name", "email"],
    render: ({ form }) => (
      <div className="space-y-4">
        <TextInput name="name" formLabel="Full Name" placeholder="John Doe" required />
        <TextInput name="email" formLabel="Email" placeholder="john@example.com" required />
      </div>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    fields: ["phone", "company"],
    render: () => (
      <div className="space-y-4">
        <TextInput name="phone" formLabel="Phone" placeholder="+1 234 567 890" />
        <TextInput name="company" formLabel="Company" placeholder="Acme Inc." />
      </div>
    ),
  },
  {
    id: "about",
    title: "About",
    fields: ["bio"],
    render: () => (
      <div className="space-y-4">
        <TextInput name="bio" formLabel="Bio" placeholder="Tell us about yourself..." />
      </div>
    ),
  },
];

export default function WizardFormPreview() {
  const [submitted, setSubmitted] = useState<FormData | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  if (submitted) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Submitted!</h2>
        <Card>
          <CardContent className="pt-6">
            <pre className="text-sm bg-muted p-4 rounded-md overflow-auto">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <NButton
          className="text-sm text-primary underline"
          onClick={() => {
            setSubmitted(null);
            setCurrentStep(1);
          }}
        >
          Reset
        </NButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Multi-Step Form</h2>
      <p className="text-sm text-muted-foreground">
        Controlled step navigation with per-step validation. Step {currentStep} of {steps.length}.
      </p>

      <Card>
        <CardContent className="pt-6">
          <WizardForm
            steps={steps}
            schema={basicSchema}
            defaultValues={{ name: "", email: "", phone: "", company: "", bio: "" }}
            onSubmit={(data) => setSubmitted(data)}
            currentStep={currentStep}
            onCurrentStepChange={setCurrentStep}
            nextLabel="Continue"
            previousLabel="Back"
            submitLabel="Finish"
            classNames={{
              root: "gap-6",
              step: "min-h-48",
              footer: "justify-between pt-4 border-t",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
