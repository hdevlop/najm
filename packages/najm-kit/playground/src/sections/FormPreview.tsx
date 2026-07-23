import React, { useState } from "react";
import { z } from "zod";
import {
  NForm,
  FormInput,
  RepeatingFields,
  NButton,
  Card,
  CardContent,
} from 'najm-kit';

// --- Schemas ---

const basicSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().min(1, "Please select a role"),
});

const profileSchema = z.object({
  bio: z.string().max(200, "Max 200 characters").optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  language: z.string().optional(),
  notifications: z.boolean().optional(),
  theme: z.string().optional(),
});

const contactSchema = z.object({
  phone: z.string().optional(),
  birthdate: z.date().optional(),
  rating: z.number().min(1, "Please rate").optional(),
  mood: z.number().optional(),
});

const dynamicSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1, "Name required"),
      qty: z.coerce.number().min(1, "Min 1"),
    })
  ),
});

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const langOptions = [
  { value: "en", label: "English", icon: "🇺🇸" },
  { value: "fr", label: "Français", icon: "🇫🇷" },
  { value: "ar", label: "العربية", icon: "🇸🇦" },
  { value: "es", label: "Español", icon: "🇪🇸" },
];

// --- FormPreview ---

export default function FormPreview() {
  const [basicResult, setBasicResult] = useState<any>(null);
  const [profileResult, setProfileResult] = useState<any>(null);
  const [contactResult, setContactResult] = useState<any>(null);
  const [dynamicResult, setDynamicResult] = useState<any>(null);

  return (
    <div className="space-y-10">
      <h2 className="text-lg font-semibold">Form</h2>

      {/* Basic Form */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Basic Form</h3>
        <p className="text-sm text-muted-foreground">
          NForm with Zod schema validation — text, email, password, select.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-5">
              <NForm
                schema={basicSchema}
                defaultValues={{ fullName: "", email: "", password: "", role: "" }}
                onSubmit={async (v) => setBasicResult(v)}
              >
                <FormInput name="fullName" type="text" formLabel="Full Name" required />
                <FormInput name="email" type="text" formLabel="Email" required />
                <FormInput name="password" type="password" formLabel="Password" required />
                <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select role" required />
                <NButton type="submit" className="mt-2">Submit</NButton>
              </NForm>
            </CardContent>
          </Card>

          {basicResult ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Submitted values:</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                  {JSON.stringify(basicResult, null, 2)}
                </pre>
                <NButton variant="ghost" size="sm" className="mt-2" onClick={() => setBasicResult(null)}>
                  Clear
                </NButton>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
              Submit the form to see results
            </div>
          )}
        </div>
      </section>

      {/* Compact Variant */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Compact Variant</h3>
        <p className="text-sm text-muted-foreground">
          Smaller labels and inputs — ideal for dense dashboards and sidebars.
        </p>
        <Card className="max-w-sm">
          <CardContent className="pt-5">
            <NForm
              schema={basicSchema}
              defaultValues={{ fullName: "", email: "", password: "", role: "" }}
              variant="compact"
              onSubmit={async () => {}}
            >
              <FormInput name="fullName" type="text" formLabel="Full Name" required />
              <FormInput name="email" type="text" formLabel="Email" required />
              <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select role" required />
              <NButton type="submit" size="sm" className="mt-1">Save</NButton>
            </NForm>
          </CardContent>
        </Card>
      </section>

      {/* Studio Variant */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Studio Variant</h3>
        <p className="text-sm text-muted-foreground">
          Uppercase tracking labels with card-style inputs — used inside studio panels.
        </p>
        <Card className="max-w-sm">
          <CardContent className="pt-5">
            <NForm
              schema={basicSchema}
              defaultValues={{ fullName: "", email: "", password: "", role: "" }}
              variant="studio"
              onSubmit={async () => {}}
            >
              <FormInput name="fullName" type="text" formLabel="Full Name" required />
              <FormInput name="email" type="text" formLabel="Email" required />
              <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select role" required />
              <NButton type="submit" size="sm" className="mt-1">Apply</NButton>
            </NForm>
          </CardContent>
        </Card>
      </section>

      {/* Profile / Rich Inputs */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Rich Inputs</h3>
        <p className="text-sm text-muted-foreground">
          Textarea, combobox, switch, and language selector inside a form.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-5">
              <NForm
                schema={profileSchema}
                defaultValues={{ bio: "", website: "", language: "en", notifications: true, theme: "system" }}
                onSubmit={async (v) => setProfileResult(v)}
              >
                <FormInput name="bio" type="textarea" formLabel="Bio" formDescription="Max 200 characters" />
                <FormInput name="website" type="text" formLabel="Website URL" />
                <FormInput name="language" type="lang" formLabel="Language" items={langOptions} />
                <FormInput name="theme" type="select" formLabel="Theme" items={themeOptions} />
                <FormInput name="notifications" type="switch" formLabel="Email Notifications" />
                <NButton type="submit" className="mt-2">Save Profile</NButton>
              </NForm>
            </CardContent>
          </Card>

          {profileResult ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Submitted values:</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                  {JSON.stringify(profileResult, null, 2)}
                </pre>
                <NButton variant="ghost" size="sm" className="mt-2" onClick={() => setProfileResult(null)}>
                  Clear
                </NButton>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
              Submit the form to see results
            </div>
          )}
        </div>
      </section>

      {/* Contact / Specialty Inputs */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Specialty Inputs</h3>
        <p className="text-sm text-muted-foreground">
          Phone, date picker, star rating, and emoji mood inside a form.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-5">
              <NForm
                schema={contactSchema}
                defaultValues={{ phone: "", birthdate: undefined, rating: 0, mood: 0 }}
                onSubmit={async (v) => setContactResult(v)}
              >
                <FormInput name="phone" type="phone" formLabel="Phone Number" />
                <FormInput name="birthdate" type="date" formLabel="Date of Birth" />
                <FormInput name="rating" type="starRating" formLabel="Overall Rating" required />
                <FormInput name="mood" type="emoji" formLabel="Current Mood" />
                <NButton type="submit" className="mt-2">Submit</NButton>
              </NForm>
            </CardContent>
          </Card>

          {contactResult ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Submitted values:</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                  {JSON.stringify(contactResult, null, 2)}
                </pre>
                <NButton variant="ghost" size="sm" className="mt-2" onClick={() => setContactResult(null)}>
                  Clear
                </NButton>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
              Submit the form to see results
            </div>
          )}
        </div>
      </section>

      {/* Repeating Fields */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">Repeating Fields</h3>
        <p className="text-sm text-muted-foreground">
          RepeatingFields lets users add, remove, and collapse repeated field groups.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-5">
              <NForm
                schema={dynamicSchema}
                defaultValues={{ items: [] }}
                onSubmit={async (v) => setDynamicResult(v)}
              >
                <RepeatingFields
                  name="items"
                  title="Item"
                  addLabel="Add item"
                  emptyLabel="No items yet."
                >
                  <FormInput name="name" type="text" formLabel="Item Name" required />
                  <FormInput name="qty" type="number" formLabel="Quantity" required />
                </RepeatingFields>
                <NButton type="submit" className="mt-2">Submit Order</NButton>
              </NForm>
            </CardContent>
          </Card>

          {dynamicResult ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium mb-2 text-muted-foreground">Submitted values:</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                  {JSON.stringify(dynamicResult, null, 2)}
                </pre>
                <NButton variant="ghost" size="sm" className="mt-2" onClick={() => setDynamicResult(null)}>
                  Clear
                </NButton>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
              Submit the form to see results
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
