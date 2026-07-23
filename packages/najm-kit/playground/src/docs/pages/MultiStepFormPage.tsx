import React, { useState } from 'react';
import { z } from 'zod';
import { WizardForm, FormInput, NButton } from 'najm-kit';
import type { StepConfig } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';
import {
  User, Mail, Lock, Building2, Phone, Briefcase,
  Bell, Palette, Globe, CheckCircle2, ChevronRight,
  Package, Hash, MapPin, CreditCard, ShieldCheck,
} from 'lucide-react';

// ── Shared ────────────────────────────────────────────────────────────────────

const roleOptions = [
  { value: 'engineer', label: 'Engineer' },
  { value: 'designer', label: 'Designer' },
  { value: 'manager', label: 'Manager' },
  { value: 'founder', label: 'Founder' },
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

const projectTypeOptions = [
  { value: 'web', label: 'Web App' },
  { value: 'mobile', label: 'Mobile App' },
  { value: 'api', label: 'API / Backend' },
  { value: 'other', label: 'Other' },
];

const visibilityOptions = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'team', label: 'Team Only' },
];

// ── Shell components ──────────────────────────────────────────────────────────

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function SuccessView({ title, subtitle, data, onReset }: {
  title: string;
  subtitle: string;
  data: Record<string, any>;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <pre className="w-full max-w-sm rounded-lg bg-muted p-3 text-left text-xs overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
      <NButton variant="outline" size="sm" onClick={onReset}>
        Start over
      </NButton>
    </div>
  );
}

// ── Review row helper ─────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%] truncate">{display}</span>
    </div>
  );
}

function ReviewSection({ title, rows }: { title: string; rows: Array<{ label: string; value?: any }> }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/30 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="px-4">
        {rows.map((r) => <ReviewRow key={r.label} label={r.label} value={r.value} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 1 — Account registration (4 steps with review)
// ═══════════════════════════════════════════════════════════════════════════════

const registrationSchema = z.object({
  fullName: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  company: z.string().min(1, 'Required'),
  role: z.string().min(1, 'Select a role'),
  phone: z.string().optional(),
  theme: z.string().optional(),
  language: z.string().optional(),
  newsletter: z.boolean().optional(),
});

function RegistrationWizard() {
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [accumulated, setAccumulated] = useState<Record<string, any>>({});

  const steps: StepConfig[] = [
    {
      id: 'account',
      title: 'Account',
      description: 'Create your login credentials.',
      fields: ['fullName', 'email', 'password'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="fullName" type="text" formLabel="Full name" placeholder="Jane Doe"
            icon={<User size={14} />} required />
          <FormInput name="email" type="text" formLabel="Email address" placeholder="jane@example.com"
            icon={<Mail size={14} />} required />
          <FormInput name="password" type="password" formLabel="Password" placeholder="Min 8 characters"
            icon={<Lock size={14} />} required />
        </div>
      ),
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'Tell us about yourself and your company.',
      fields: ['company', 'role', 'phone'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="company" type="text" formLabel="Company" placeholder="Acme Inc."
            icon={<Building2 size={14} />} required />
          <FormInput name="role" type="select" formLabel="Job title" items={roleOptions}
            placeholder="Select your role" icon={<Briefcase size={14} />} required />
          <FormInput name="phone" type="phone" formLabel="Phone (optional)"
            icon={<Phone size={14} />} />
        </div>
      ),
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'Customize your experience.',
      fields: ['theme', 'language', 'newsletter'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="theme" type="select" formLabel="Theme" items={themeOptions}
            placeholder="System default" icon={<Palette size={14} />} />
          <FormInput name="language" type="lang" formLabel="Language" items={langOptions}
            icon={<Globe size={14} />} />
          <FormInput name="newsletter" type="switch" formLabel="Subscribe to newsletter"
            icon={<Bell size={14} />} />
        </div>
      ),
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Check your details before creating your account.',
      render: () => (
        <div className="space-y-3">
          <ReviewSection title="Account" rows={[
            { label: 'Full name', value: accumulated.fullName },
            { label: 'Email', value: accumulated.email },
            { label: 'Password', value: accumulated.password ? '••••••••' : undefined },
          ]} />
          <ReviewSection title="Profile" rows={[
            { label: 'Company', value: accumulated.company },
            { label: 'Role', value: accumulated.role },
            { label: 'Phone', value: accumulated.phone },
          ]} />
          <ReviewSection title="Preferences" rows={[
            { label: 'Theme', value: accumulated.theme },
            { label: 'Language', value: accumulated.language },
            { label: 'Newsletter', value: accumulated.newsletter },
          ]} />
        </div>
      ),
    },
  ];

  if (result) {
    return (
      <SuccessView
        title="Account created!"
        subtitle="Welcome aboard. Your account is ready."
        data={result}
        onReset={() => { setResult(null); setAccumulated({}); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <WizardForm
        steps={steps}
        schema={registrationSchema}
        defaultValues={{ fullName: '', email: '', password: '', company: '', role: '', phone: '', theme: 'system', language: 'en', newsletter: false }}
        onStepComplete={(_, data) => setAccumulated((prev) => ({ ...prev, ...data }))}
        onSubmit={(data) => setResult(data)}
        nextLabel="Continue"
        previousLabel="Back"
        submitLabel="Create account"
        classNames={{ footer: 'pt-4 border-t border-border justify-between' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 2 — Project setup (3 steps)
// ═══════════════════════════════════════════════════════════════════════════════

const projectSchema = z.object({
  projectName: z.string().min(2, 'At least 2 characters'),
  description: z.string().optional(),
  type: z.string().min(1, 'Select a type'),
  inviteEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  inviteRole: z.string().optional(),
  visibility: z.string().min(1, 'Select visibility'),
  enableCI: z.boolean().optional(),
});

function ProjectWizard() {
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const steps: StepConfig[] = [
    {
      id: 'details',
      title: 'Details',
      description: 'Name your project and pick a type.',
      fields: ['projectName', 'description', 'type'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="projectName" type="text" formLabel="Project name" placeholder="My Awesome Project"
            icon={<Package size={14} />} required />
          <FormInput name="description" type="textarea" formLabel="Description" placeholder="What is this project about?"
            icon={<Hash size={14} />} />
          <FormInput name="type" type="select" formLabel="Project type" items={projectTypeOptions}
            placeholder="Select a type" icon={<Briefcase size={14} />} required />
        </div>
      ),
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Invite your first team member (optional).',
      fields: ['inviteEmail', 'inviteRole'],
      render: () => (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center space-y-1">
            <p className="text-sm font-medium">Invite a collaborator</p>
            <p className="text-xs text-muted-foreground">You can always add more members later from the team settings.</p>
          </div>
          <FormInput name="inviteEmail" type="text" formLabel="Email address" placeholder="colleague@example.com"
            icon={<Mail size={14} />} />
          <FormInput name="inviteRole" type="select" formLabel="Role" items={roleOptions}
            placeholder="Select a role" icon={<ShieldCheck size={14} />} />
        </div>
      ),
    },
    {
      id: 'config',
      title: 'Configure',
      description: 'Set visibility and CI/CD defaults.',
      fields: ['visibility', 'enableCI'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="visibility" type="select" formLabel="Visibility" items={visibilityOptions}
            placeholder="Select visibility" icon={<Globe size={14} />} required />
          <FormInput name="enableCI" type="switch" formLabel="Enable CI/CD pipeline"
            icon={<ShieldCheck size={14} />} />
        </div>
      ),
    },
  ];

  if (result) {
    return (
      <SuccessView
        title="Project created!"
        subtitle="Your workspace is ready to use."
        data={result}
        onReset={() => setResult(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <WizardForm
        steps={steps}
        schema={projectSchema}
        defaultValues={{ projectName: '', description: '', type: '', inviteEmail: '', inviteRole: '', visibility: '', enableCI: false }}
        onSubmit={(data) => setResult(data)}
        nextLabel="Next step"
        previousLabel="← Back"
        submitLabel="Create project"
        classNames={{ footer: 'pt-4 border-t border-border justify-between' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 3 — Checkout (3 steps, shipping → payment → confirm)
// ═══════════════════════════════════════════════════════════════════════════════

const checkoutSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  address: z.string().min(5, 'Enter full address'),
  city: z.string().min(1, 'Required'),
  cardName: z.string().min(2, 'Required'),
  cardNumber: z.string().min(16, 'Enter 16-digit number').max(19),
  expiry: z.string().min(5, 'MM/YY'),
  cvv: z.string().min(3, 'Required'),
});

function CheckoutWizard() {
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [accumulated, setAccumulated] = useState<Record<string, any>>({});

  const steps: StepConfig[] = [
    {
      id: 'shipping',
      title: 'Shipping',
      description: 'Where should we ship your order?',
      fields: ['firstName', 'lastName', 'address', 'city'],
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="firstName" type="text" formLabel="First name" placeholder="Jane" required />
            <FormInput name="lastName" type="text" formLabel="Last name" placeholder="Doe" required />
          </div>
          <FormInput name="address" type="text" formLabel="Address" placeholder="123 Main Street"
            icon={<MapPin size={14} />} required />
          <FormInput name="city" type="text" formLabel="City" placeholder="New York"
            icon={<Building2 size={14} />} required />
        </div>
      ),
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Enter your card details securely.',
      fields: ['cardName', 'cardNumber', 'expiry', 'cvv'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="cardName" type="text" formLabel="Name on card" placeholder="Jane Doe"
            icon={<User size={14} />} required />
          <FormInput name="cardNumber" type="text" formLabel="Card number" placeholder="1234 5678 9012 3456"
            icon={<CreditCard size={14} />} required />
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="expiry" type="text" formLabel="Expiry (MM/YY)" placeholder="12/26" required />
            <FormInput name="cvv" type="text" formLabel="CVV" placeholder="123" required />
          </div>
        </div>
      ),
    },
    {
      id: 'confirm',
      title: 'Confirm',
      description: 'Review your order before placing it.',
      render: () => (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card/50 p-4 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Order summary</p>
            {[
              { name: 'Wireless Headphones', qty: 1, price: '$79.00' },
              { name: 'USB-C Hub', qty: 2, price: '$98.00' },
            ].map((item) => (
              <div key={item.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.name} ×{item.qty}</span>
                <span className="font-medium">{item.price}</span>
              </div>
            ))}
            <div className="border-t border-border mt-2 pt-2 flex justify-between font-semibold text-sm">
              <span>Total</span><span>$177.00</span>
            </div>
          </div>
          <ReviewSection title="Shipping to" rows={[
            { label: 'Name', value: accumulated.firstName && `${accumulated.firstName} ${accumulated.lastName}` },
            { label: 'Address', value: accumulated.address },
            { label: 'City', value: accumulated.city },
          ]} />
          <ReviewSection title="Payment" rows={[
            { label: 'Card', value: accumulated.cardNumber ? `•••• •••• •••• ${accumulated.cardNumber.slice(-4)}` : undefined },
            { label: 'Expiry', value: accumulated.expiry },
          ]} />
        </div>
      ),
    },
  ];

  if (result) {
    return (
      <SuccessView
        title="Order placed!"
        subtitle="You'll receive a confirmation email shortly."
        data={{ ...result, cardNumber: `•••• •••• •••• ${result.cardNumber?.slice(-4) ?? ''}`, cvv: '•••' }}
        onReset={() => { setResult(null); setAccumulated({}); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <WizardForm
        steps={steps}
        schema={checkoutSchema}
        defaultValues={{ firstName: '', lastName: '', address: '', city: '', cardName: '', cardNumber: '', expiry: '', cvv: '' }}
        onStepComplete={(_, data) => setAccumulated((prev) => ({ ...prev, ...data }))}
        onSubmit={(data) => setResult(data)}
        nextLabel="Continue"
        previousLabel="Back"
        submitLabel="Place order →"
        classNames={{ footer: 'pt-4 border-t border-border justify-between' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 4 — Controlled step (external state)
// ═══════════════════════════════════════════════════════════════════════════════

const simpleSchema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Invalid email'),
  plan: z.string().min(1, 'Select a plan'),
  agree: z.boolean().refine((v) => v === true, 'You must accept the terms'),
});

const planOptions = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro — $12/mo' },
  { value: 'team', label: 'Team — $49/mo' },
];

function ControlledWizard() {
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const steps: StepConfig[] = [
    {
      id: 'identity',
      title: 'Identity',
      fields: ['name', 'email'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="name" type="text" formLabel="Your name" placeholder="Jane Doe"
            icon={<User size={14} />} required />
          <FormInput name="email" type="text" formLabel="Email address" placeholder="jane@example.com"
            icon={<Mail size={14} />} required />
        </div>
      ),
    },
    {
      id: 'plan',
      title: 'Plan',
      fields: ['plan'],
      render: () => (
        <div className="space-y-4">
          <FormInput name="plan" type="select" formLabel="Choose a plan" items={planOptions}
            placeholder="Select a plan" icon={<CreditCard size={14} />} required />
        </div>
      ),
    },
    {
      id: 'terms',
      title: 'Terms',
      fields: ['agree'],
      render: () => (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-2 max-h-36 overflow-y-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <p key={i}>{i + 1}. By using this service you agree to the terms and privacy policy as outlined in our documentation.</p>
            ))}
          </div>
          <FormInput name="agree" type="switch" formLabel="I accept the terms and conditions"
            icon={<ShieldCheck size={14} />} />
        </div>
      ),
    },
  ];

  if (result) {
    return (
      <SuccessView
        title="You're all set!"
        subtitle="Your subscription is active."
        data={result}
        onReset={() => { setResult(null); setStep(1); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {step} of {steps.length}</span>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <span className={i + 1 <= step ? 'text-primary font-medium' : ''}>{s.title}</span>
              {i < steps.length - 1 && <ChevronRight size={12} className="text-muted-foreground/50" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <WizardForm
        steps={steps}
        schema={simpleSchema}
        defaultValues={{ name: '', email: '', plan: '', agree: false }}
        currentStep={step}
        onCurrentStepChange={setStep}
        onSubmit={(data) => setResult(data)}
        nextLabel="Next"
        previousLabel="Back"
        submitLabel="Subscribe"
        classNames={{ footer: 'pt-4 border-t border-border justify-between' }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

export function WizardFormPage() {
  return (
    <ComponentPage
      title="Wizard Form"
      description="WizardForm splits a large form into guided steps with per-step Zod validation, a progress indicator, and accumulated data passed to onSubmit on the final step."
      category="Forms"
    >

      <Example
        title="Account registration"
        description="4-step wizard: Account → Profile → Preferences → Review. The last step shows all collected data before final submit."
        previewHeight="h-[680px]"
        noPad
        center={false}
        code={`import { z } from 'zod';
import { WizardForm, FormInput } from 'najm-kit';
import type { StepConfig } from 'najm-kit';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().min(1),
  role: z.string().min(1),
  theme: z.string().optional(),
  newsletter: z.boolean().optional(),
});

const steps: StepConfig[] = [
  {
    id: 'account',
    title: 'Account',
    description: 'Create your login credentials.',
    fields: ['fullName', 'email', 'password'],   // per-step validation
    render: () => (
      <div className="space-y-4">
        <FormInput name="fullName" type="text" formLabel="Full name" placeholder="Jane Doe" required />
        <FormInput name="email"    type="text" formLabel="Email"     placeholder="jane@example.com" required />
        <FormInput name="password" type="password" formLabel="Password" required />
      </div>
    ),
  },
  // ... more steps
  {
    id: 'review',
    title: 'Review',
    // no fields — no validation on this step
    render: () => <ReviewContent data={accumulated} />,
  },
];

const [accumulated, setAccumulated] = useState({});

<WizardForm
  steps={steps}
  schema={schema}
  defaultValues={{ fullName: '', email: '', password: '', ... }}
  onStepComplete={(_, data) => setAccumulated(prev => ({ ...prev, ...data }))}
  onSubmit={(allData) => console.log(allData)}
  nextLabel="Continue"
  previousLabel="Back"
  submitLabel="Create account"
/>`}
      >
        <div className="h-full overflow-auto p-6">
        <WizardShell>
          <RegistrationWizard />
        </WizardShell>
        </div>
      </Example>

      <Example
        title="Project setup"
        description="3-step wizard for creating a new project: Details → Team → Configure. Each step validates only its own fields."
        previewHeight="h-[560px]"
        noPad
        center={false}
        code={`const steps: StepConfig[] = [
  {
    id: 'details',
    title: 'Details',
    fields: ['projectName', 'description', 'type'],
    render: () => (
      <div className="space-y-4">
        <FormInput name="projectName" type="text" formLabel="Project name" required />
        <FormInput name="description" type="textarea" formLabel="Description" />
        <FormInput name="type" type="select" formLabel="Project type" items={projectTypeOptions} required />
      </div>
    ),
  },
  {
    id: 'team',
    title: 'Team',
    fields: ['inviteEmail', 'inviteRole'],
    render: () => (
      <div className="space-y-4">
        <FormInput name="inviteEmail" type="text" formLabel="Email address" />
        <FormInput name="inviteRole" type="select" formLabel="Role" items={roleOptions} />
      </div>
    ),
  },
  {
    id: 'config',
    title: 'Configure',
    fields: ['visibility', 'enableCI'],
    render: () => (
      <div className="space-y-4">
        <FormInput name="visibility" type="select" formLabel="Visibility" items={visibilityOptions} required />
        <FormInput name="enableCI" type="switch" formLabel="Enable CI/CD pipeline" />
      </div>
    ),
  },
];

<WizardForm steps={steps} schema={schema} defaultValues={...} onSubmit={handleSubmit} />`}
      >
        <div className="h-full overflow-auto p-6">
        <WizardShell>
          <ProjectWizard />
        </WizardShell>
        </div>
      </Example>

      <Example
        title="Checkout wizard"
        description="3-step checkout: Shipping → Payment → Confirm. The confirm step renders an order summary and masked card details from accumulated state."
        previewHeight="h-[600px]"
        noPad
        center={false}
        code={`const [accumulated, setAccumulated] = useState({});

const steps: StepConfig[] = [
  {
    id: 'shipping',
    title: 'Shipping',
    fields: ['firstName', 'lastName', 'address', 'city'],
    render: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormInput name="firstName" type="text" formLabel="First name" required />
          <FormInput name="lastName"  type="text" formLabel="Last name"  required />
        </div>
        <FormInput name="address" type="text" formLabel="Address" required />
        <FormInput name="city"    type="text" formLabel="City"    required />
      </div>
    ),
  },
  {
    id: 'payment',
    title: 'Payment',
    fields: ['cardName', 'cardNumber', 'expiry', 'cvv'],
    render: () => (
      <div className="space-y-4">
        <FormInput name="cardName"   type="text" formLabel="Name on card" required />
        <FormInput name="cardNumber" type="text" formLabel="Card number"  required />
        <div className="grid grid-cols-2 gap-3">
          <FormInput name="expiry" type="text" formLabel="Expiry (MM/YY)" required />
          <FormInput name="cvv"    type="text" formLabel="CVV"            required />
        </div>
      </div>
    ),
  },
  {
    id: 'confirm',
    title: 'Confirm',
    render: () => <OrderSummary data={accumulated} />,
  },
];

<WizardForm
  steps={steps}
  schema={checkoutSchema}
  defaultValues={...}
  onStepComplete={(_, data) => setAccumulated(prev => ({ ...prev, ...data }))}
  onSubmit={handleSubmit}
  submitLabel="Place order →"
/>`}
      >
        <div className="h-full overflow-auto p-6">
        <WizardShell>
          <CheckoutWizard />
        </WizardShell>
        </div>
      </Example>

      <Example
        title="Controlled step state"
        description="Pass currentStep and onCurrentStepChange to own the step index externally — useful for deep-linking, analytics, or custom breadcrumb rendering."
        previewHeight="h-[480px]"
        noPad
        center={false}
        code={`const [step, setStep] = useState(1);

// Your own step indicator / breadcrumb
<div className="flex items-center gap-1 text-xs">
  {steps.map((s, i) => (
    <>
      <span className={i + 1 <= step ? 'text-primary font-medium' : ''}>{s.title}</span>
      {i < steps.length - 1 && <ChevronRight size={12} />}
    </>
  ))}
</div>

<WizardForm
  steps={steps}
  schema={schema}
  defaultValues={...}
  currentStep={step}
  onCurrentStepChange={setStep}   // you control navigation
  onSubmit={handleSubmit}
/>`}
      >
        <div className="h-full overflow-auto p-6">
        <WizardShell>
          <ControlledWizard />
        </WizardShell>
        </div>
      </Example>

    </ComponentPage>
  );
}
