import React, { useState } from 'react';
import { z } from 'zod';
import { NForm, FormInput, RepeatingFields, NButton } from 'najm-kit';
import {
  User, Mail, Lock, ShieldCheck,
  FileText, Globe, Palette, Bell,
  Phone, Calendar, Star, Smile,
  Package, Hash,
  Building2, CreditCard, MapPin, Briefcase,
  ImagePlus, Folder,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

// ---- shared options ----
const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const langOptions = [
  { value: 'en', label: 'English', icon: '🇺🇸' },
  { value: 'fr', label: 'Français', icon: '🇫🇷' },
  { value: 'ar', label: 'العربية', icon: '🇸🇦' },
  { value: 'es', label: 'Español', icon: '🇪🇸' },
];

// ---- Reusable shell ----
function FormShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full overflow-y-auto p-6 flex justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-0.5">
            {icon && <span className="text-primary">{icon}</span>}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function ResultShell({ result, onReset }: { result: any; onReset: () => void }) {
  return (
    <div className="w-full h-full overflow-y-auto p-6 flex justify-center">
      <div className="w-full max-w-sm space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted values</p>
        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        <NButton variant="outline" size="sm" onClick={onReset}>Reset</NButton>
      </div>
    </div>
  );
}

// ---- Basic form ----
const basicSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.string().min(1, 'Select a role'),
});

function BasicFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell title="Create Account" subtitle="Fill in your details to get started.">
      <NForm schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
        <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters" required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
        <NButton type="submit" className="mt-2 w-full">Submit</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Icons on labels ----
function IconFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<User size={16} />} title="Create Account" subtitle="Icons appear next to each field label.">
      <NForm schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" icon="User" required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" icon="Mail" required />
        <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters" icon="Lock" required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" icon="ShieldCheck" required />
        <NButton type="submit" className="mt-2 w-full">Submit</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Colored icons ----
const companySchema = z.object({
  company: z.string().min(1, 'Required'),
  card: z.string().min(1, 'Required'),
  address: z.string().optional(),
  role: z.string().optional(),
});

function ColoredIconFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<Building2 size={16} />} title="Company Details" subtitle="Icons use semantic colors per field.">
      <NForm schema={companySchema} defaultValues={{ company: '', card: '', address: '', role: '' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="company" type="text" formLabel="Company Name" placeholder="Acme Inc." icon={<Building2 size={14} className="text-violet-400" />} required />
        <FormInput name="card" type="text" formLabel="Card Number" placeholder="**** **** **** 4242" icon={<CreditCard size={14} className="text-emerald-400" />} required />
        <FormInput name="address" type="text" formLabel="Address" placeholder="123 Main St." icon={<MapPin size={14} className="text-amber-400" />} />
        <FormInput name="role" type="select" formLabel="Job Title" items={roleOptions} placeholder="Select role" icon={<Briefcase size={14} className="text-sky-400" />} />
        <NButton type="submit" className="mt-2 w-full">Continue</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Compact variant ----
function CompactFormDemo() {
  return (
    <FormShell title="User Settings" subtitle="compact variant — smaller labels and inputs.">
      <NForm schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} variant="compact" onSubmit={async () => {}}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
        <NButton type="submit" size="sm" className="mt-2 w-full">Save</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Studio variant ----
function StudioFormDemo() {
  return (
    <FormShell title="Inspector Panel" subtitle="studio variant — uppercase tracking labels.">
      <NForm schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} variant="studio" onSubmit={async () => {}}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
        <NButton type="submit" size="sm" className="mt-2 w-full">Apply</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Bordered ----
function BorderedFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<User size={16} />} title="Create Account" subtitle="All inputs use borders instead of shadows.">
      <NForm bordered schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" icon="User" required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" icon="Mail" required />
        <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters" icon="Lock" required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" icon="ShieldCheck" required />
        <NButton type="submit" className="mt-2 w-full">Submit</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Rounded inputs ----
function RoundedFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<User size={16} />} title="Rounded Inputs" subtitle="All text-style inputs with variant='rounded' for pill-shaped fields.">
      <NForm schema={basicSchema} defaultValues={{ fullName: '', email: '', password: '', role: '' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" variant="rounded" icon={<User size={14} />} required />
        <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" variant="rounded" icon={<Mail size={14} />} required />
        <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters" variant="rounded" icon={<Lock size={14} />} required />
        <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" variant="rounded" icon={<ShieldCheck size={14} />} required />
        <NButton type="submit" className="mt-2 w-full rounded-full">Submit</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Rich inputs ----
const profileSchema = z.object({
  bio: z.string().max(200).optional(),
  language: z.string().optional(),
  theme: z.string().optional(),
  notifications: z.boolean().optional(),
});

function RichFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<FileText size={16} />} title="Edit Profile" subtitle="Textarea, language selector, select, and switch.">
      <NForm schema={profileSchema} defaultValues={{ bio: '', language: 'en', theme: 'system', notifications: true }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="bio" type="textarea" formLabel="Bio" placeholder="Tell us about yourself…" icon={<FileText size={14} />} formDescription="Max 200 characters" />
        <FormInput name="language" type="lang" formLabel="Language" items={langOptions} icon={<Globe size={14} />} />
        <FormInput name="theme" type="select" formLabel="Theme" items={themeOptions} placeholder="Choose theme" icon={<Palette size={14} />} />
        <FormInput name="notifications" type="switch" formLabel="Email notifications" icon={<Bell size={14} />} />
        <NButton type="submit" className="mt-2 w-full">Save Profile</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Specialty inputs ----
const contactSchema = z.object({
  phone: z.string().optional(),
  birthdate: z.date().optional(),
  rating: z.number().min(1, 'Please rate').optional(),
  mood: z.number().optional(),
  timeZone: z.string().min(1, 'Choose a time zone'),
});

function SpecialtyFormDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<Globe size={16} />} title="Contact Info" subtitle="Phone, date picker, time zone, star rating, and emoji mood.">
      <NForm schema={contactSchema} defaultValues={{ phone: '', birthdate: undefined, rating: 0, mood: 0, timeZone: 'America/New_York' }} onSubmit={async (v) => setResult(v)}>
        <FormInput name="phone" type="phone" formLabel="Phone Number" icon={<Phone size={14} />} />
        <FormInput name="birthdate" type="date" formLabel="Date of Birth" placeholder="Pick a date" icon={<Calendar size={14} />} />
        <FormInput name="timeZone" type="timeZone" formLabel="Time Zone" icon={<Globe size={14} />} />
        <FormInput name="timeZone" type="timeZone" formLabel="Time Zone" icon={<Globe size={14} />} />
   <FormInput name="rating" type="starRating" formLabel="Overall Rating" icon={<Star size={14} />} required />
        <FormInput name="mood" type="emoji" formLabel="Current Mood" icon={<Smile size={14} />} />
        <NButton type="submit" className="mt-2 w-full">Submit</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Repeating fields ----
const dynamicSchema = z.object({
  items: z.array(z.object({ name: z.string().min(1, 'Name required'), qty: z.coerce.number().min(1, 'Min 1') })),
});

function RepeatingFieldsDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) return <ResultShell result={result} onReset={() => setResult(null)} />;
  return (
    <FormShell icon={<Package size={16} />} title="Order Items" subtitle="Add, remove, and collapse repeating field groups.">
      <NForm schema={dynamicSchema} defaultValues={{ items: [] }} onSubmit={async (v) => setResult(v)}>
        <RepeatingFields name="items" title="Item" addLabel="Add item" emptyLabel="No items yet.">
          <FormInput name="name" type="text" formLabel="Item Name" placeholder="Product name" icon={<Package size={14} />} required />
          <FormInput name="qty" type="number" formLabel="Quantity" placeholder="1" icon={<Hash size={14} />} required />
        </RepeatingFields>
        <NButton type="submit" className="mt-3 w-full">Submit Order</NButton>
      </NForm>
    </FormShell>
  );
}

// ---- Image input ----
const logoSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  logo: z
    .custom<File>((v) => v instanceof File, 'Please upload your logo')
    .refine((file) => ['image/png', 'image/jpeg'].includes(file.type), {
      message: 'It must be a JPG or PNG file',
    })
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'Image must be smaller than 5 MB',
    }),
  attachments: z
    .custom<File>((v) => v instanceof File, 'Please attach a file')
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File must be smaller than 5 MB',
    }),
});

function ImageInputDemo() {
  const [result, setResult] = useState<any>(null);
  if (result) {
    return (
      <ResultShell
        result={{
          ...result,
          logo: result.logo ? { name: result.logo.name, type: result.logo.type, size: result.logo.size } : null,
          attachments: result.attachments ? { name: result.attachments.name, type: result.attachments.type, size: result.attachments.size } : null,
        }}
        onReset={() => setResult(null)}
      />
    );
  }
  return (
    <FormShell icon={<ImagePlus size={16} />} title="Brand Setup" subtitle="Image upload via FormInput type='image' with Zod validation.">
      <NForm
        schema={logoSchema}
        defaultValues={{ company: '', logo: undefined as unknown as File, attachments: undefined as unknown as File }}
        onSubmit={async (v) => setResult(v)}
      >
        <FormInput name="company" type="text" formLabel="Company name" placeholder="Acme Inc." icon={<Building2 size={14} />} required />
        <FormInput
          name="logo"
          type="image"
          formLabel="Logo"
          previewClassName="w-full h-40 rounded-xl"
          trigger="icon"
          title="Click to upload your logo"
          subtitle="It must be a JPG or PNG file"
          required
        />
        <FormInput
          name="attachments"
          type="image"
          formLabel="Attachments"
          previewClassName="w-full h-40 rounded-xl border-dotted"
          trigger="icon"
          uploadIcon={<Folder className="h-10 w-10" />}
          title="Attach you files here"
        />
        <NButton type="submit" className="mt-2 w-full">Save brand</NButton>
      </NForm>
    </FormShell>
  );
}

export function FormPage() {
  return (
    <ComponentPage
      title="Form"
      description="NForm wraps react-hook-form + Zod for schema-validated forms. FormInput renders the right input for each field type with built-in labels, descriptions, and error messages."
      category="Form"
    >
      <Example
        title="Basic form"
        description="Text, email, password, and select fields with Zod validation and placeholders. Submit to see the values."
        previewHeight="h-[500px]"
        noPad
        center={false}
        code={`import { z } from 'zod';
import { NForm, FormInput, NButton } from 'najm-kit';

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.string().min(1, 'Select a role'),
});

<NForm schema={schema} defaultValues={...} onSubmit={async (v) => console.log(v)}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
  <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters" required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
  <NButton type="submit" className="w-full">Submit</NButton>
</NForm>`}
      >
        <BasicFormDemo />
      </Example>

      <Example
        title="Icons on labels"
        description="Pass an icon prop to FormInput to display an icon next to each field label. The title also accepts an icon."
        previewHeight="h-[500px]"
        noPad
        center={false}
        code={`import { NForm, FormInput, NButton } from 'najm-kit';

<NForm schema={schema} defaultValues={...} onSubmit={...}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe"
    icon="User" required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com"
    icon="Mail" required />
  <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters"
    icon="Lock" required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role"
    icon="ShieldCheck" required />
  <NButton type="submit" className="w-full">Submit</NButton>
</NForm>`}
      >
        <IconFormDemo />
      </Example>

      <Example
        title="Colored icons"
        description="Apply Tailwind color classes directly on the icon element for per-field semantic colors."
        previewHeight="h-[460px]"
        noPad
        center={false}
        code={`import { Building2, CreditCard, MapPin, Briefcase } from 'lucide-react';

<NForm schema={schema} defaultValues={...} onSubmit={...}>
  <FormInput name="company" type="text" formLabel="Company Name" placeholder="Acme Inc."
    icon={<Building2 size={14} className="text-violet-400" />} required />
  <FormInput name="card" type="text" formLabel="Card Number" placeholder="**** **** **** 4242"
    icon={<CreditCard size={14} className="text-emerald-400" />} required />
  <FormInput name="address" type="text" formLabel="Address" placeholder="123 Main St."
    icon={<MapPin size={14} className="text-amber-400" />} />
  <FormInput name="role" type="select" formLabel="Job Title" items={roleOptions} placeholder="Select role"
    icon={<Briefcase size={14} className="text-sky-400" />} />
  <NButton type="submit" className="w-full">Continue</NButton>
</NForm>`}
      >
        <ColoredIconFormDemo />
      </Example>

      <Example
        title="Compact variant"
        description="Smaller labels and inputs — ideal for dense sidebars and settings panels."
        previewHeight="h-[400px]"
        noPad
        center={false}
        code={`<NForm schema={schema} defaultValues={...} variant="compact" onSubmit={...}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
  <NButton type="submit" size="sm" className="w-full">Save</NButton>
</NForm>`}
      >
        <CompactFormDemo />
      </Example>

      <Example
        title="Studio variant"
        description="Uppercase tracking labels with card-style inputs — used inside studio inspector panels."
        previewHeight="h-[400px]"
        noPad
        center={false}
        code={`<NForm schema={schema} defaultValues={...} variant="studio" onSubmit={...}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe" required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com" required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role" required />
  <NButton type="submit" size="sm" className="w-full">Apply</NButton>
</NForm>`}
      >
        <StudioFormDemo />
      </Example>

      <Example
        title="Bordered"
        description="Pass bordered to NForm to give all inputs a border instead of the default shadow."
        previewHeight="h-[500px]"
        noPad
        center={false}
        code={`<NForm bordered schema={schema} defaultValues={...} onSubmit={...}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe"
    icon="User" required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com"
    icon="Mail" required />
  <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters"
    icon="Lock" required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role"
    icon="ShieldCheck" required />
  <NButton type="submit" className="w-full">Submit</NButton>
</NForm>`}
      >
        <BorderedFormDemo />
      </Example>

      <Example
        title="Rounded inputs"
        description="Pass variant='rounded' to FormInput for pill-shaped text, password, and select fields."
        previewHeight="h-[500px]"
        noPad
        center={false}
        code={`<NForm schema={schema} defaultValues={...} onSubmit={...}>
  <FormInput name="fullName" type="text" formLabel="Full Name" placeholder="John Doe"
    variant="rounded" icon={<User size={14} />} required />
  <FormInput name="email" type="text" formLabel="Email" placeholder="john@example.com"
    variant="rounded" icon={<Mail size={14} />} required />
  <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters"
    variant="rounded" icon={<Lock size={14} />} required />
  <FormInput name="role" type="select" formLabel="Role" items={roleOptions} placeholder="Select a role"
    variant="rounded" icon={<ShieldCheck size={14} />} required />
  <NButton type="submit" className="w-full rounded-full">Submit</NButton>
</NForm>`}
      >
        <RoundedFormDemo />
      </Example>

      <Example
        title="Rich inputs"
        description="Textarea, language selector, select, and switch — all managed by FormInput with label icons."
        previewHeight="h-[520px]"
        noPad
        center={false}
        code={`import { FileText, Globe, Palette, Bell } from 'lucide-react';

<NForm schema={profileSchema} defaultValues={...} onSubmit={...}>
  <FormInput name="bio" type="textarea" formLabel="Bio" placeholder="Tell us about yourself…"
    icon={<FileText size={14} />} formDescription="Max 200 characters" />
  <FormInput name="language" type="lang" formLabel="Language" items={langOptions}
    icon={<Globe size={14} />} />
  <FormInput name="theme" type="select" formLabel="Theme" items={themeOptions} placeholder="Choose theme"
    icon={<Palette size={14} />} />
  <FormInput name="notifications" type="switch" formLabel="Email notifications"
    icon={<Bell size={14} />} />
  <NButton type="submit" className="w-full">Save Profile</NButton>
</NForm>`}
      >
        <RichFormDemo />
      </Example>

      <Example
        title="Specialty inputs"
        description="Phone, date picker, time zone, star rating, and emoji mood selector — via the same FormInput API."
        previewHeight="h-[480px]"
        noPad
        center={false}
        code={`import { Phone, Calendar, Star, Smile } from 'lucide-react';

<NForm schema={contactSchema} defaultValues={...} onSubmit={...}>
  <FormInput name="phone" type="phone" formLabel="Phone Number" icon={<Phone size={14} />} />
  <FormInput name="birthdate" type="date" formLabel="Date of Birth" placeholder="Pick a date"
    icon={<Calendar size={14} />} />
  <FormInput name="rating" type="starRating" formLabel="Overall Rating" icon={<Star size={14} />} required />
  <FormInput name="mood" type="emoji" formLabel="Current Mood" icon={<Smile size={14} />} />
  <NButton type="submit" className="w-full">Submit</NButton>
</NForm>`}
      >
        <SpecialtyFormDemo />
      </Example>

      <Example
        title="Repeating fields"
        description="RepeatingFields lets users add, remove, and collapse repeated field groups inside one form."
        previewHeight="h-[500px]"
        noPad
        center={false}
        code={`import { Package, Hash } from 'lucide-react';
import { NForm, FormInput, RepeatingFields, NButton } from 'najm-kit';

<NForm schema={schema} defaultValues={{ items: [] }} onSubmit={async (v) => console.log(v)}>
  <RepeatingFields name="items" title="Item" addLabel="Add item" emptyLabel="No items yet.">
    <FormInput name="name" type="text" formLabel="Item Name" placeholder="Product name"
      icon={<Package size={14} />} required />
    <FormInput name="qty" type="number" formLabel="Quantity" placeholder="1"
      icon={<Hash size={14} />} required />
  </RepeatingFields>
  <NButton type="submit" className="mt-3 w-full">Submit Order</NButton>
</NForm>`}
      >
        <RepeatingFieldsDemo />
      </Example>

      <Example
        title="Image input"
        description="FormInput type='image' renders the ImageInput with preview, hover overlay, and clear button — pass previewClassName to control dimensions and switch to the dropzone layout. Use trigger='icon' | 'button' | 'both' to pick the affordance, uploadIcon to swap the dropzone icon, and title/subtitle to customize the prompt copy."
        previewHeight="h-[820px]"
        noPad
        center={false}
        code={`import { Folder } from 'lucide-react';

const logoSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  logo: z
    .custom<File>((v) => v instanceof File, 'Please upload your logo')
    .refine((file) => ['image/png', 'image/jpeg'].includes(file.type), {
      message: 'It must be a JPG or PNG file',
    })
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'Image must be smaller than 5 MB',
    }),
  attachments: z
    .custom<File>((v) => v instanceof File, 'Please attach a file')
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File must be smaller than 5 MB',
    }),
});

<NForm schema={logoSchema} onSubmit={...}>
  <FormInput name="company" type="text" formLabel="Company name" placeholder="Acme Inc." required />
  <FormInput
    name="logo"
    type="image"
    formLabel="Logo"
    previewClassName="w-full h-40 rounded-xl"
    trigger="icon"
    title="Click to upload your logo"
    subtitle="It must be a JPG or PNG file"
    required
  />
  <FormInput
    name="attachments"
    type="image"
    formLabel="Attachments"
    previewClassName="w-full h-40 rounded-xl border-dotted"
    trigger="icon"
    uploadIcon={<Folder className="h-10 w-10" />}
    title="Attach you files here"
  />
  <NButton type="submit" className="w-full">Save brand</NButton>
</NForm>`}
      >
        <ImageInputDemo />
      </Example>
    </ComponentPage>
  );
}
