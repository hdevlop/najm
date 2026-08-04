import React, { useState } from 'react';
import { AtSign, Hash } from 'lucide-react';
import {
  TextInput,
  NumberInput,
  PasswordInput,
  TextAreaInput,
  SelectInput,
  ComboboxInput,
  MultiSelectInput,
  CheckboxInput,
  CheckboxGroupInput,
  RadioGroupInput,
  SwitchInput,
  DateInput,
  TimeInput,
  TimeZoneInput,
  PhoneInput,

  FileInput,
  ImageInput,
  ColorPickerInput,
  ColorArrayInput,
  EmojiInput,
  StarRatingInput,
  SearchInput,
  Slider,
  NSlider,
  LangInput,
} from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
];

const countries = [
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'jp', label: 'Japan' },
];

const skills = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
];

const notificationOptions = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
  { value: 'slack', label: 'Slack' },
];

const planOptions = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const langs = [
  { value: 'en', label: 'English', icon: 'EN' },
  { value: 'fr', label: 'Francais', icon: 'FR' },
  { value: 'ar', label: 'Arabic', icon: 'AR' },
  { value: 'ja', label: 'Japanese', icon: 'JA' },
];

const brandColors = ['#0f172a', '#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed'];
const productColors = ['#111827', '#e11d48', '#ea580c', '#16a34a', '#2563eb', '#9333ea'];

function Field({ label, helper, error, children }: { label: string; helper?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="w-full space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function PreviewBox({ children, className = 'max-w-sm' }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full ${className}`}>{children}</div>;
}

function PreviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">{children}</div>;
}

function TextInputSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('sam@najem.dev');
  const [slug, setSlug] = useState('najm-kit-inputs');

  return (
    <ComponentPage title="Text Input" description="Single-line input examples for border styles, labels, helper copy, error states, icons, and disabled values." category="Data Input">
      <Example title="Basic Text" description="A plain controlled text field with a label and helper text." center={false} previewHeight="h-48" code={`<TextInput value={name} onChange={setName} placeholder="Jane Carter" />`}>
        <PreviewBox>
          <Field label="Full name" helper="Shown in profiles, reports, and invitations.">
            <TextInput value={name} onChange={setName} placeholder="Jane Carter" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Border styles" description="Three visual styles: default (rounded-md border), rounded (pill shape), and ghost (no border or background). Pass bordered to draw the muted-foreground border." center={false} previewHeight="h-56" code={`<TextInput value={name} onChange={setName}
  bordered placeholder="Default" />

<TextInput value={name} onChange={setName}
  bordered variant="rounded" placeholder="Rounded" />

<TextInput value={name} onChange={setName}
  variant="ghost" placeholder="Ghost" />`}>
        <PreviewGrid>
          <Field label="default">
            <TextInput value={name} onChange={setName} bordered placeholder="Default variant" />
          </Field>
          <Field label="rounded">
            <TextInput value={name} onChange={setName} bordered variant="rounded" placeholder="Rounded variant" />
          </Field>
          <Field label="ghost">
            <TextInput value={name} onChange={setName} variant="ghost" placeholder="Ghost variant" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="With Icons" description="Use Lucide icons when the field benefits from a visual cue." center={false} previewHeight="h-56" code={`import { AtSign, Hash } from 'lucide-react';

<TextInput value={email} onChange={setEmail}
  icon={<AtSign size={14} />} placeholder="you@example.com" />

<TextInput value={slug} onChange={setSlug}
  icon={<Hash size={14} />} placeholder="project-slug" />`}>
        <PreviewGrid>
          <Field label="Email address">
            <TextInput value={email} onChange={setEmail} icon={<AtSign size={14} />} placeholder="you@example.com" />
          </Field>
          <Field label="Project slug" helper="Lowercase words separated by hyphens.">
            <TextInput value={slug} onChange={setSlug} icon={<Hash size={14} />} placeholder="project-slug" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="States" description="Show validation errors and disabled values in their own small preview." center={false} previewHeight="h-56" code={`<TextInput value="" onChange={() => {}}
  status="error" placeholder="Required field" />

<TextInput value="Archived customer" onChange={() => {}}
  disabled />`}>
        <PreviewGrid>
          <Field label="Workspace" error="Workspace is required.">
            <TextInput value="" onChange={() => {}} status="error" placeholder="Required field" />
          </Field>
          <Field label="Disabled value">
            <TextInput value="Archived customer" onChange={() => {}} disabled />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function PasswordInputSection() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('sk_live_hidden');

  return (
    <ComponentPage title="Password Input" description="Password fields with the built-in reveal toggle for credentials and secret-like values." category="Data Input">
      <Example title="Password" center={false} previewHeight="h-48" code={`<PasswordInput value={password} onChange={setPassword}
  placeholder="Enter password" />`}>
        <PreviewBox>
          <Field label="Password" helper="The reveal button is included in the component.">
            <PasswordInput value={password} onChange={setPassword} placeholder="Enter password" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Secret With Icon" center={false} previewHeight="h-48" code={`<PasswordInput value={token} onChange={setToken}
  icon="key" placeholder="API token" />`}>
        <PreviewBox>
          <Field label="API token">
            <PasswordInput value={token} onChange={setToken} icon="key" placeholder="API token" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Error State" center={false} previewHeight="h-48" code={`<PasswordInput value="" onChange={() => {}}
  status="error" placeholder="Confirm password" />`}>
        <PreviewBox>
          <Field label="Confirm password" error="Passwords do not match.">
            <PasswordInput value="" onChange={() => {}} status="error" placeholder="Confirm password" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function NumberInputSection() {
  const [quantity, setQuantity] = useState(42);
  const [budget, setBudget] = useState(5000);
  const [seats, setSeats] = useState(12);

  return (
    <ComponentPage title="Number Input" description="Numeric input examples for counts, budgets, thresholds, and validation states." category="Data Input">
      <Example title="Quantity" center={false} previewHeight="h-48" code={`<NumberInput value={quantity} onChange={setQuantity}
  placeholder="Enter amount" />`}>
        <PreviewBox>
          <Field label="Quantity">
            <NumberInput value={quantity} onChange={setQuantity} placeholder="Enter amount" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Numeric Icons" center={false} previewHeight="h-56" code={`<NumberInput value={budget} onChange={setBudget}
  icon="$" placeholder="Budget" />

<NumberInput value={seats} onChange={setSeats}
  icon="#" placeholder="Seats" />`}>
        <PreviewGrid>
          <Field label="Monthly budget" helper={`Current budget: $${budget.toLocaleString()}`}>
            <NumberInput value={budget} onChange={setBudget} icon="$" placeholder="Budget" />
          </Field>
          <Field label="Seats">
            <NumberInput value={seats} onChange={setSeats} icon="#" placeholder="Seats" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Validation" center={false} previewHeight="h-48" code={`<NumberInput value={0} onChange={() => {}}
  status="error" placeholder="Minimum 1" />`}>
        <PreviewBox>
          <Field label="Minimum quantity" error="Enter a value greater than zero.">
            <NumberInput value={0} onChange={() => {}} status="error" placeholder="Minimum 1" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function SearchInputSection() {
  const [globalSearch, setGlobalSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('invoice');
  const [compactSearch, setCompactSearch] = useState('');

  return (
    <ComponentPage title="Search Input" description="Search fields for command palettes, table filters, and compact lookup controls." category="Data Input">
      <Example title="Global Search" center={false} previewHeight="h-48" code={`<SearchInput value={globalSearch} onChange={setGlobalSearch}
  placeholder="Search everything..." />`}>
        <PreviewBox className="max-w-xl">
          <Field label="Global search">
            <SearchInput value={globalSearch} onChange={setGlobalSearch} placeholder="Search everything..." />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Filters" center={false} previewHeight="h-56" code={`<SearchInput value={customerSearch} onChange={setCustomerSearch}
  placeholder="Filter customers" />

<SearchInput value={compactSearch} onChange={setCompactSearch}
  className="max-w-56" placeholder="Quick find" />`}>
        <PreviewGrid>
          <Field label="Table filter" helper="Keeps the same shape as the primitive Input.">
            <SearchInput value={customerSearch} onChange={setCustomerSearch} placeholder="Filter customers" />
          </Field>
          <Field label="Compact lookup">
            <SearchInput value={compactSearch} onChange={setCompactSearch} className="max-w-56" placeholder="Quick find" />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function TextareaSection() {
  const [message, setMessage] = useState('');
  const [comment, setComment] = useState('This release makes the table view much easier to scan.');
  const [subject, setSubject] = useState('');
  const [feedback, setFeedback] = useState('');

  return (
    <ComponentPage title="Textarea" description="Multi-line input examples for notes, comments, support messages, and validation states." category="Data Input">
      <Example title="Message" center={false} previewHeight="h-64" code={`<TextAreaInput value={message} onChange={setMessage}
  placeholder="Write a message..." rows={4} />`}>
        <PreviewBox>
          <Field label="Message" helper={`${message.length}/500 characters`}>
            <TextAreaInput value={message} onChange={setMessage} placeholder="Write a message..." rows={4} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Comment" center={false} previewHeight="h-56" code={`<TextAreaInput value={comment} onChange={setComment}
  rows={3} />`}>
        <PreviewBox>
          <Field label="Comment" helper={`${comment.length}/280 characters`}>
            <TextAreaInput value={comment} onChange={setComment} rows={3} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Composed Feedback" center={false} previewHeight="h-72" code={`<TextInput value={subject} onChange={setSubject}
  placeholder="Subject" />

<TextAreaInput value={feedback} onChange={setFeedback}
  placeholder="Tell us what happened..." rows={4} />`}>
        <PreviewGrid>
          <Field label="Subject">
            <TextInput value={subject} onChange={setSubject} placeholder="Brief subject" />
          </Field>
          <Field label="Support message">
            <TextAreaInput value={feedback} onChange={setFeedback} placeholder="Tell us what happened..." rows={4} />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Error State" center={false} previewHeight="h-56" code={`<TextAreaInput value="" onChange={() => {}}
  status="error" placeholder="Required details" rows={3} />`}>
        <PreviewBox>
          <Field label="Required details" error="Details are required.">
            <TextAreaInput value="" onChange={() => {}} status="error" placeholder="Required details" rows={3} />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function SelectInputSection() {
  const [framework, setFramework] = useState('');
  const [country, setCountry] = useState('de');
  const [plan, setPlan] = useState('pro');

  return (
    <ComponentPage title="Select Input" description="Dropdown selects for small option sets, default values, icons, and disabled states." category="Data Input">
      <Example title="Basic Select" center={false} previewHeight="h-48" code={`<SelectInput value={framework} onChange={setFramework}
  items={frameworks} placeholder="Choose a framework" />`}>
        <PreviewBox>
          <Field label="Framework">
            <SelectInput value={framework} onChange={setFramework} items={frameworks} placeholder="Choose a framework" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Prefilled Values" center={false} previewHeight="h-56" code={`<SelectInput value={country} onChange={setCountry}
  items={countries} icon="map" placeholder="Country" />

<SelectInput value={plan} onChange={setPlan}
  items={planOptions} placeholder="Plan" />`}>
        <PreviewGrid>
          <Field label="Country">
            <SelectInput value={country} onChange={setCountry} items={countries} icon="map" placeholder="Country" />
          </Field>
          <Field label="Billing plan" helper={`Selected plan: ${plan || 'none'}`}>
            <SelectInput value={plan} onChange={setPlan} items={planOptions} placeholder="Plan" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Disabled" center={false} previewHeight="h-48" code={`<SelectInput value="" onChange={() => {}}
  items={frameworks} placeholder="Cannot select" disabled />`}>
        <PreviewBox>
          <Field label="Disabled">
            <SelectInput value="" onChange={() => {}} items={frameworks} placeholder="Cannot select" disabled />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function ComboboxInputSection() {
  const [framework, setFramework] = useState('');
  const [freeText, setFreeText] = useState('Solid');
  const [disabledValue, setDisabledValue] = useState('react');

  return (
    <ComponentPage title="Combobox" description="Searchable dropdown examples with filtering, custom empty text, free-text entry, and disabled values." category="Data Input">
      <Example title="Search And Select" center={false} previewHeight="h-48" code={`<ComboboxInput value={framework} onChange={setFramework}
  items={frameworks}
  searchPlaceholder="Type to filter..."
  emptyMessage="No framework found." />`}>
        <PreviewBox>
          <Field label="Framework">
            <ComboboxInput value={framework} onChange={setFramework} items={frameworks} placeholder="Search and select" searchPlaceholder="Type to filter..." emptyMessage="No framework found." />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Free Text" center={false} previewHeight="h-48" code={`<ComboboxInput value={freeText} onChange={setFreeText}
  items={frameworks}
  allowFreeText
  placeholder="Pick or type" />`}>
        <PreviewBox>
          <Field label="Free text" helper="Allows values that are not in the list.">
            <ComboboxInput value={freeText} onChange={setFreeText} items={frameworks} allowFreeText placeholder="Pick or type" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Disabled" center={false} previewHeight="h-48" code={`<ComboboxInput value={disabledValue} onChange={setDisabledValue}
  items={frameworks} disabled />`}>
        <PreviewBox>
          <Field label="Disabled value">
            <ComboboxInput value={disabledValue} onChange={setDisabledValue} items={frameworks} disabled />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function MultiSelectInputSection() {
  const [stack, setStack] = useState<string[]>(['react', 'vue']);
  const [channels, setChannels] = useState<string[]>(['email', 'push', 'slack']);
  const [simple, setSimple] = useState<string[]>(['typescript']);

  return (
    <ComponentPage title="Multi Select" description="Multiple-selection examples with chips, overflow display, search, and non-search compact lists." category="Data Input">
      <Example title="Framework Stack" center={false} previewHeight="h-48" code={`<MultiSelectInput value={stack} onChange={setStack}
  items={frameworks} maxDisplay={2}
  placeholder="Select frameworks" />`}>
        <PreviewBox>
          <Field label="Framework stack" helper={`Selected: ${stack.length}`}>
            <MultiSelectInput value={stack} onChange={setStack} items={frameworks} placeholder="Select frameworks" maxDisplay={2} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Overflow Display" center={false} previewHeight="h-48" code={`<MultiSelectInput value={channels} onChange={setChannels}
  items={notificationOptions} maxDisplay={3}
  placeholder="Choose channels" />`}>
        <PreviewBox>
          <Field label="Notification channels">
            <MultiSelectInput value={channels} onChange={setChannels} items={notificationOptions} placeholder="Choose channels" maxDisplay={3} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Without Search" center={false} previewHeight="h-48" code={`<MultiSelectInput value={simple} onChange={setSimple}
  items={skills} showSearch={false}
  placeholder="Pick skills" />`}>
        <PreviewBox>
          <Field label="Skills without search">
            <MultiSelectInput value={simple} onChange={setSimple} items={skills} showSearch={false} placeholder="Pick skills" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function CheckboxSection() {
  const [terms, setTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [channels, setChannels] = useState<string[]>(['email']);
  const [skillsValue, setSkillsValue] = useState<string[]>(['typescript', 'go']);

  return (
    <ComponentPage title="Checkbox" description="Single checkbox and grouped checkbox examples for opt-ins, feature flags, and multi-value preferences." category="Data Input">
      <Example title="Single Checkbox" center={false} previewHeight="h-56" code={`<CheckboxInput variant="ghost" value={terms} onChange={setTerms}
  label="Accept terms and conditions"
  helper="Required before creating the account." />

<CheckboxInput variant="ghost" value={newsletter} onChange={setNewsletter}
  label="Product newsletter"
  helper="One email every month." />`}>
        <PreviewGrid>
          <Field label="Required agreement">
            <CheckboxInput variant="ghost" value={terms} onChange={setTerms} label="Accept terms and conditions" helper="Required before creating the account." />
          </Field>
          <Field label="Marketing preference">
            <CheckboxInput variant="ghost" value={newsletter} onChange={setNewsletter} label="Product newsletter" helper="One email every month." />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Checkbox Group" center={false} previewHeight="h-72" code={`<CheckboxGroupInput variant="ghost" value={channels} onChange={setChannels}
  items={notificationOptions} layout="column" />

<CheckboxGroupInput variant="ghost" value={skillsValue} onChange={setSkillsValue}
  items={skills} layout="row" />`}>
        <PreviewGrid>
          <Field label="Channel group">
            <CheckboxGroupInput variant="ghost" value={channels} onChange={setChannels} items={notificationOptions} layout="column" />
          </Field>
          <Field label="Skill group">
            <CheckboxGroupInput variant="ghost" value={skillsValue} onChange={setSkillsValue} items={skills} layout="row" />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function RadioGroupSection() {
  const [plan, setPlan] = useState('starter');
  const [framework, setFramework] = useState('react');
  const [region, setRegion] = useState('us');

  return (
    <ComponentPage title="Radio Group" description="Exclusive selection examples for plans, options, regions, and compact horizontal choices." category="Data Input">
      <Example title="Column Layout" center={false} previewHeight="h-72" code={`<RadioGroupInput variant="ghost" value={plan} onChange={setPlan}
  items={planOptions} layout="column" />`}>
        <PreviewBox>
          <Field label="Plan">
            <RadioGroupInput variant="ghost" value={plan} onChange={setPlan} items={planOptions} layout="column" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Row Layout" center={false} previewHeight="h-48" code={`<RadioGroupInput variant="ghost" value={framework} onChange={setFramework}
  items={frameworks} layout="row" />`}>
        <PreviewBox>
          <Field label="Framework">
            <RadioGroupInput variant="ghost" value={framework} onChange={setFramework} items={frameworks} layout="row" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Error State" center={false} previewHeight="h-72" code={`<RadioGroupInput variant="ghost" value={region} onChange={setRegion}
  items={countries} layout="column" status="error" />`}>
        <PreviewBox>
          <Field label="Region" error="Pick a supported billing region.">
            <RadioGroupInput variant="ghost" value={region} onChange={setRegion} items={countries} layout="column" status="error" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function SwitchInputSection() {
  const [notifications, setNotifications] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [sync, setSync] = useState(true);

  return (
    <ComponentPage title="Switch" description="Toggle examples for settings rows, helpers, icon placement, and error highlighting." category="Data Input">
      <Example title="Settings Row" center={false} previewHeight="h-48" code={`<SwitchInput variant="ghost" value={notifications} onChange={setNotifications}
  label="Enable notifications"
  helper="Receive account updates." />`}>
        <PreviewBox className="max-w-xl">
          <SwitchInput variant="ghost" value={notifications} onChange={setNotifications} label="Enable notifications" helper="Receive account updates." />
        </PreviewBox>
      </Example>

      <Example title="Multiple Toggles" center={false} previewHeight="h-56" code={`<SwitchInput variant="ghost" value={marketing} onChange={setMarketing}
  label="Marketing emails" />

<SwitchInput variant="ghost" value={sync} onChange={setSync}
  icon="sync" iconPosition="input"
  label="Background sync" />`}>
        <div className="w-full max-w-xl space-y-3">
          <SwitchInput variant="ghost" value={marketing} onChange={setMarketing} label="Marketing emails" helper="New features and product notes." />
          <SwitchInput variant="ghost" value={sync} onChange={setSync} icon="sync" iconPosition="input" label="Background sync" helper="Keep cached data fresh while the app is open." />
        </div>
      </Example>

      <Example title="Error State" center={false} previewHeight="h-48" code={`<SwitchInput variant="ghost" value={false} onChange={() => {}}
  status="error" label="Two-factor authentication" />`}>
        <PreviewBox className="max-w-xl">
          <SwitchInput variant="ghost" value={false} onChange={() => {}} status="error" label="Two-factor authentication" helper="Required for admin users." />
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function DateInputSection() {
  const [date, setDate] = useState<any>(undefined);
  const [startDate, setStartDate] = useState<any>(undefined);
  const [endDate, setEndDate] = useState<any>(undefined);
  const [reviewDate, setReviewDate] = useState<any>('2026-06-15');

  return (
    <ComponentPage title="Date Input" description="Date picker examples for single dates, ranges, pre-filled values, and validation states." category="Data Input">
      <Example title="Single Date" center={false} previewHeight="h-48" code={`<DateInput value={date} onChange={setDate}
  placeholder="Pick a date" />`}>
        <PreviewBox>
          <Field label="Single date">
            <DateInput value={date} onChange={setDate} placeholder="Pick a date" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Date Range Composition" center={false} previewHeight="h-56" code={`<DateInput value={startDate} onChange={setStartDate}
  placeholder="Start" />

<DateInput value={endDate} onChange={setEndDate}
  placeholder="End" />`}>
        <PreviewGrid>
          <Field label="Start date">
            <DateInput value={startDate} onChange={setStartDate} placeholder="Start" />
          </Field>
          <Field label="End date">
            <DateInput value={endDate} onChange={setEndDate} placeholder="End" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Prefilled And Error" center={false} previewHeight="h-56" code={`<DateInput value={reviewDate} onChange={setReviewDate}
  placeholder="Review date" />

<DateInput value={undefined} onChange={() => {}}
  status="error" placeholder="Required date" />`}>
        <PreviewGrid>
          <Field label="Pre-filled review date">
            <DateInput value={reviewDate} onChange={setReviewDate} placeholder="Review date" />
          </Field>
          <Field label="Required date" error="Choose a date before continuing.">
            <DateInput value={undefined} onChange={() => {}} status="error" placeholder="Required date" />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function TimeInputSection() {
  const [time, setTime] = useState('');
  const [seconds, setSeconds] = useState('14:30:15');
  const [deadline, setDeadline] = useState('09:00');

  return (
    <ComponentPage title="Time Input" description="Time inputs for native-looking HH:MM fields, seconds precision, disabled values, and invalid states." category="Data Input">
      <Example title="Basic Time" center={false} previewHeight="h-48" code={`<TimeInput value={time} onChange={setTime}
  placeholder="HH:MM" />`}>
        <PreviewBox>
          <Field label="Meeting time">
            <TimeInput value={time} onChange={setTime} placeholder="HH:MM" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Seconds And Icon" center={false} previewHeight="h-56" code={`<TimeInput value={seconds} onChange={setSeconds}
  showSeconds placeholder="HH:MM:SS" />

<TimeInput value={deadline} onChange={setDeadline}
  icon="clock" placeholder="Deadline" />`}>
        <PreviewGrid>
          <Field label="With seconds">
            <TimeInput value={seconds} onChange={setSeconds} showSeconds placeholder="HH:MM:SS" />
          </Field>
          <Field label="Deadline">
            <TimeInput value={deadline} onChange={setDeadline} icon="clock" placeholder="Deadline" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Disabled And Error" center={false} previewHeight="h-56" code={`<TimeInput value="10:00" onChange={() => {}} disabled />

<TimeInput value="25:99" onChange={() => {}}
  status="error" />`}>
        <PreviewGrid>
          <Field label="Disabled">
            <TimeInput value="10:00" onChange={() => {}} disabled />
          </Field>
          <Field label="Invalid time" error="Use a valid 24-hour time.">
            <TimeInput value="25:99" onChange={() => {}} status="error" />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function TimeZoneInputSection() {
  const [timeZone, setTimeZone] = useState('America/New_York');

  return (
    <ComponentPage title="Time Zone Input" description="Select an IANA time zone for scheduling, localization, and user preferences." category="Data Input">
      <Example title="Time Zone Selector" center={false} previewHeight="h-48" code={`<TimeZoneInput value={timeZone} onChange={setTimeZone} />`}>
        <PreviewBox>
          <Field label="Preferred time zone" helper={`Selected: ${timeZone}`}>
            <TimeZoneInput value={timeZone} onChange={setTimeZone} />
          </Field>
        </PreviewBox>
      </Example>
      <Example title="Custom Placeholder" center={false} previewHeight="h-48" code={`<TimeZoneInput value="" onChange={setTimeZone} placeholder="Choose a time zone" />`}>
        <PreviewBox>
          <Field label="Time zone">
            <TimeZoneInput value="" onChange={setTimeZone} placeholder="Choose a time zone" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function PhoneInputSection() {
  const [phoneUs, setPhoneUs] = useState('');
  const [phoneFr, setPhoneFr] = useState('');
  const [phoneForm, setPhoneForm] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <ComponentPage title="Phone Input" description="International phone inputs with country selectors, contact form composition, helper text, and disabled states." category="Data Input">
      <Example title="Default Countries" center={false} previewHeight="h-56" code={`<PhoneInput value={phoneUs} onChange={setPhoneUs}
  defaultCountry="us" />

<PhoneInput value={phoneFr} onChange={setPhoneFr}
  defaultCountry="fr" />`}>
        <PreviewGrid>
          <Field label="US number">
            <PhoneInput value={phoneUs} onChange={setPhoneUs} defaultCountry="us" />
          </Field>
          <Field label="French number">
            <PhoneInput value={phoneFr} onChange={setPhoneFr} defaultCountry="fr" />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Contact Form" center={false} previewHeight="h-72" code={`<TextInput value={name} onChange={setName}
  placeholder="Full name" />
<TextInput value={email} onChange={setEmail}
  placeholder="Email address" />
<PhoneInput value={phoneForm} onChange={setPhoneForm}
  defaultCountry="us" />`}>
        <div className="grid w-full max-w-2xl gap-3 md:grid-cols-3">
          <Field label="Full name">
            <TextInput value={name} onChange={setName} placeholder="Jane Carter" />
          </Field>
          <Field label="Email address">
            <TextInput value={email} onChange={setEmail} placeholder="jane@example.com" />
          </Field>
          <Field label="Phone number" helper="Used for SMS verification.">
            <PhoneInput value={phoneForm} onChange={setPhoneForm} defaultCountry="us" />
          </Field>
        </div>
      </Example>

      <Example title="Disabled" center={false} previewHeight="h-48" code={`<PhoneInput value="" onChange={() => {}} disabled />`}>
        <PreviewBox>
          <Field label="Disabled phone">
            <PhoneInput value="" onChange={() => {}} disabled />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function FileInputSection() {
  const [file, setFile] = useState<File | null>(null);
  const [errorFile, setErrorFile] = useState<File | null>(null);

  return (
    <ComponentPage title="File Input" description="File picker examples with empty, selected, existing, custom icon, and error display states." category="Data Input">
      <Example title="Upload File" center={false} previewHeight="h-48" code={`<FileInput value={file} onChange={setFile}
  placeholder="No file chosen" />`}>
        <PreviewBox>
          <Field label="Upload document" helper={file ? file.name : 'PDF, DOCX, or TXT.'}>
            <FileInput value={file} onChange={setFile} placeholder="No file chosen" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Existing File" center={false} previewHeight="h-48" code={`<FileInput value="contracts/master-service-agreement.pdf"
  onChange={() => {}}
  placeholder="No file chosen" />`}>
        <PreviewBox>
          <Field label="Existing file">
            <FileInput value="contracts/master-service-agreement.pdf" onChange={() => {}} placeholder="No file chosen" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Custom Icon And Error" center={false} previewHeight="h-56" code={`<FileInput value={null} onChange={() => {}}
  icon="csv" placeholder="Import CSV file" />

<FileInput value={errorFile} onChange={setErrorFile}
  status="error" placeholder="Upload a PDF" />`}>
        <PreviewGrid>
          <Field label="CSV import">
            <FileInput value={null} onChange={() => {}} icon="csv" placeholder="Import CSV file" />
          </Field>
          <Field label="Required upload" error="Upload a PDF file.">
            <FileInput value={errorFile} onChange={setErrorFile} status="error" placeholder="Upload a PDF" />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function ImageInputSection() {
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  return (
    <ComponentPage title="Image Input" description="Image upload examples for avatars, default images, different preview sizes, and layout positions." category="Data Input">
      <Example title="Avatar Upload" center={false} previewHeight="h-64" code={`<ImageInput value={avatar} onChange={setAvatar}
  imageSize="md" />`}>
        <PreviewBox>
          <Field label="Avatar upload">
            <ImageInput value={avatar} onChange={setAvatar} imageSize="md" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Default And Locked Preview" center={false} previewHeight="h-64" code={`<ImageInput value={null} onChange={() => {}}
  defaultImage="https://placehold.co/96x96/0f172a/ffffff?text=N"
  imageSize="sm" />

<ImageInput value={null} onChange={() => {}}
  imageSize="sm" allowClear={false} />`}>
        <PreviewGrid>
          <Field label="Default avatar">
            <ImageInput value={null} onChange={() => {}} defaultImage="https://placehold.co/96x96/0f172a/ffffff?text=N" imageSize="sm" />
          </Field>
          <Field label="No clear button">
            <ImageInput value={null} onChange={() => {}} imageSize="sm" allowClear={false} />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Side Preview" center={false} previewHeight="h-72" code={`<ImageInput value={cover} onChange={setCover}
  imageSize="lg" previewPosition="left" />`}>
        <PreviewBox className="max-w-xl">
          <Field label="Cover image">
            <ImageInput value={cover} onChange={setCover} imageSize="lg" previewPosition="left" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Resilient Preview And Fallback" center={false} previewHeight="h-72" code={`<ImageInput
  value="https://broken.example.com/missing.png"
  onChange={() => {}}
  previewAlt="Workspace logo"
  fallbackImage="https://placehold.co/96x96/0f172a/ffffff?text=N"
  fallbackAlt="Default logo"
  unavailableContent={<span>Logo unavailable</span>}
  imageClassName="object-contain"
  imageSize="md"
/>

<ImageInput
  value="https://placehold.co/96x96/0f172a/ffffff?text=N"
  onChange={() => {}}
  previewAlt="Workspace logo"
  imageClassName="object-cover"
  imageSize="md"
/>`}>
        <PreviewGrid>
          <Field label="Broken primary with fallback">
            <ImageInput
              value="https://broken.example.com/missing.png"
              onChange={() => {}}
              previewAlt="Workspace logo"
              fallbackImage="https://placehold.co/96x96/0f172a/ffffff?text=N"
              fallbackAlt="Default logo"
              unavailableContent={<span>Logo unavailable</span>}
              imageClassName="object-contain"
              imageSize="md"
            />
          </Field>
          <Field label="Contain vs cover">
            <ImageInput
              value="https://placehold.co/96x96/0f172a/ffffff?text=N"
              onChange={() => {}}
              previewAlt="Workspace logo"
              imageClassName="object-cover"
              imageSize="md"
            />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function ColorPickerSection() {
  const [brand, setBrand] = useState('#2563eb');
  const [danger, setDanger] = useState('#dc2626');
  const [accent, setAccent] = useState('#e11d48');
  const [product, setProduct] = useState('#16a34a');

  return (
    <ComponentPage title="Color Inputs" description="Color picker and palette examples with custom palettes, compact swatches, selected values, and validation states." category="Data Input">
      <Example title="Color Picker" center={false} previewHeight="h-64" code={`<ColorPickerInput variant="ghost" value={brand}
  onChange={setBrand} colors={brandColors} />`}>
        <PreviewBox>
          <Field label="Brand color" helper={`Selected: ${brand}`}>
            <ColorPickerInput variant="ghost" value={brand} onChange={setBrand} colors={brandColors} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Picker Error" center={false} previewHeight="h-64" code={`<ColorPickerInput variant="ghost" value={danger}
  onChange={setDanger} status="error" />`}>
        <PreviewBox>
          <Field label="Destructive color" error="Avoid colors that fail contrast.">
            <ColorPickerInput variant="ghost" value={danger} onChange={setDanger} status="error" />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Color Array" center={false} previewHeight="h-48" code={`<ColorArrayInput variant="ghost" value={accent}
  onChange={setAccent} />`}>
        <PreviewBox>
          <Field label="Accent swatches" helper={`Selected: ${accent}`}>
            <ColorArrayInput variant="ghost" value={accent} onChange={setAccent} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Custom Palette" center={false} previewHeight="h-48" code={`<ColorArrayInput variant="ghost" value={product}
  onChange={setProduct} colors={productColors} />`}>
        <PreviewBox>
          <Field label="Product palette" helper={`Selected: ${product}`}>
            <ColorArrayInput variant="ghost" value={product} onChange={setProduct} colors={productColors} />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function StarRatingSection() {
  const [productRating, setProductRating] = useState(4);
  const [supportRating, setSupportRating] = useState(0);
  const [tenPointRating, setTenPointRating] = useState(7);

  return (
    <ComponentPage title="Star Rating" description="Rating input examples for product reviews, satisfaction scores, longer scales, and required states." category="Data Input">
      <Example title="Five Stars" center={false} previewHeight="h-48" code={`<StarRatingInput variant="ghost" value={productRating}
  onChange={setProductRating} maxStars={5} />`}>
        <PreviewBox>
          <Field label="Product review" helper={`${productRating}/5 stars`}>
            <StarRatingInput variant="ghost" value={productRating} onChange={(value) => setProductRating(value ?? 0)} maxStars={5} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Empty Rating" center={false} previewHeight="h-48" code={`<StarRatingInput variant="ghost" value={supportRating}
  onChange={setSupportRating} maxStars={5} />`}>
        <PreviewBox>
          <Field label="Support satisfaction" helper={`${supportRating}/5 stars`}>
            <StarRatingInput variant="ghost" value={supportRating} onChange={(value) => setSupportRating(value ?? 0)} maxStars={5} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Ten Point Scale" center={false} previewHeight="h-48" code={`<StarRatingInput variant="ghost" value={tenPointRating}
  onChange={setTenPointRating} maxStars={10} />`}>
        <PreviewBox>
          <Field label="Ten point scale" helper={`${tenPointRating}/10`}>
            <StarRatingInput variant="ghost" value={tenPointRating} onChange={(value) => setTenPointRating(value ?? 0)} maxStars={10} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Required Rating" center={false} previewHeight="h-48" code={`<StarRatingInput variant="ghost" value={0}
  onChange={() => {}} status="error" />`}>
        <PreviewBox>
          <Field label="Required rating" error="Select at least one star.">
            <StarRatingInput variant="ghost" value={0} onChange={() => {}} status="error" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function EmojiInputSection() {
  const [experience, setExperience] = useState(3);
  const [mood, setMood] = useState(4);
  const [simple, setSimple] = useState(2);

  const shortOptions = [
    { value: 1, label: 'Poor' },
    { value: 2, label: 'Okay' },
    { value: 3, label: 'Great' },
  ];

  return (
    <ComponentPage title="Emoji Rating" description="Sentiment picker examples for feedback flows, mood checks, custom option labels, and error states." category="Data Input">
      <Example title="Experience" center={false} previewHeight="h-48" code={`<EmojiInput variant="ghost" value={experience}
  onChange={setExperience} />`}>
        <PreviewBox>
          <Field label="Experience" helper={`Score: ${experience}`}>
            <EmojiInput variant="ghost" value={experience} onChange={setExperience} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Mood Check" center={false} previewHeight="h-48" code={`<EmojiInput variant="ghost" value={mood}
  onChange={setMood} />`}>
        <PreviewBox>
          <Field label="Team mood" helper={`Score: ${mood}`}>
            <EmojiInput variant="ghost" value={mood} onChange={setMood} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Custom Options" center={false} previewHeight="h-48" code={`<EmojiInput variant="ghost" value={simple}
  onChange={setSimple}
  options={shortOptions} />`}>
        <PreviewBox>
          <Field label="Short scale">
            <EmojiInput variant="ghost" value={simple} onChange={setSimple} options={shortOptions} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Required Sentiment" center={false} previewHeight="h-48" code={`<EmojiInput variant="ghost" value={0}
  onChange={() => {}} status="error" />`}>
        <PreviewBox>
          <Field label="Required sentiment" error="Choose a sentiment.">
            <EmojiInput variant="ghost" value={0} onChange={() => {}} status="error" />
          </Field>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

function LangInputSection() {
  const [language, setLanguage] = useState('en');
  const [contentLanguage, setContentLanguage] = useState('fr');
  const [emptyLanguage, setEmptyLanguage] = useState('');

  return (
    <ComponentPage title="Language Input" description="Language pickers for app locale, content locale, compact trigger states, and disabled values." category="Data Input">
      <Example title="App Locale" center={false} previewHeight="h-48" code={`<LangInput value={language} onChange={setLanguage}
  items={langs} />`}>
        <PreviewBox>
          <Field label="App language" helper={`Selected: ${language || 'none'}`}>
            <LangInput value={language} onChange={setLanguage} items={langs} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Content Locale" center={false} previewHeight="h-48" code={`<LangInput value={contentLanguage} onChange={setContentLanguage}
  items={langs} />`}>
        <PreviewBox>
          <Field label="Content language" helper={`Selected: ${contentLanguage || 'none'}`}>
            <LangInput value={contentLanguage} onChange={setContentLanguage} items={langs} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Unset And Disabled" center={false} previewHeight="h-56" code={`<LangInput value={emptyLanguage} onChange={setEmptyLanguage}
  items={langs} />

<LangInput value="ja" onChange={() => {}}
  items={langs} disabled />`}>
        <PreviewGrid>
          <Field label="Unset language" helper="Shows the globe trigger before a value is selected.">
            <LangInput value={emptyLanguage} onChange={setEmptyLanguage} items={langs} />
          </Field>
          <Field label="Locked language">
            <LangInput value="ja" onChange={() => {}} items={langs} disabled />
          </Field>
        </PreviewGrid>
      </Example>
    </ComponentPage>
  );
}

function SliderSection() {
  const [brightness, setBrightness] = useState([60]);
  const [volume, setVolume] = useState([75]);
  const [opacity, setOpacity] = useState([35]);
  const [disabledValue, setDisabledValue] = useState([20]);

  // NSlider state
  const [rangeValue, setRangeValue] = useState<[number, number]>([20, 60]);
  const [tooltipValue, setTooltipValue] = useState(42);
  const [sizeSm, setSizeSm] = useState(30);
  const [sizeMd, setSizeMd] = useState(50);
  const [sizeLg, setSizeLg] = useState(70);

  return (
    <ComponentPage title="Slider" description="Range input examples for percentages, steps, disabled controls, visible min/max values, color variants, vertical orientation, RTL, and tooltips." category="Data Input">
      <Example title="With Min And Max Labels" center={false} previewHeight="h-48" code={`<Slider value={brightness} onValueChange={setBrightness}
  min={0} max={100} step={1} />`}>
        <PreviewBox className="max-w-xl">
          <Field label="Brightness" helper={`Value: ${brightness[0]}%`}>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">0</span>
              <Slider value={brightness} onValueChange={setBrightness} min={0} max={100} step={1} className="flex-1" />
              <span className="text-xs text-muted-foreground">100</span>
            </div>
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Stepped Ranges" center={false} previewHeight="h-56" code={`<Slider value={volume} onValueChange={setVolume}
  min={0} max={100} step={5} />

<Slider value={opacity} onValueChange={setOpacity}
  min={0} max={100} step={5} />`}>
        <PreviewGrid>
          <Field label="Volume" helper={`Step 5: ${volume[0]}%`}>
            <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={5} />
          </Field>
          <Field label="Opacity" helper={`${opacity[0]}%`}>
            <Slider value={opacity} onValueChange={setOpacity} min={0} max={100} step={5} />
          </Field>
        </PreviewGrid>
      </Example>

      <Example title="Disabled" center={false} previewHeight="h-48" code={`<Slider value={disabledValue} onValueChange={setDisabledValue}
  disabled />`}>
        <PreviewBox>
          <Field label="Disabled">
            <Slider value={disabledValue} onValueChange={setDisabledValue} disabled />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Range (NSlider)" center={false} previewHeight="h-48" code={`<NSlider value={[20, 60]}
  onValueChange={setRangeValue} />`}>
        <PreviewBox className="max-w-xl">
          <Field label="Price Range" helper={`${rangeValue[0]} — ${rangeValue[1]}`}>
            <NSlider value={rangeValue} onValueChange={setRangeValue} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Color Variants" center={false} previewHeight="h-64" code={`<NSlider variant="default" value={50} />
<NSlider variant="secondary" value={50} />
<NSlider variant="destructive" value={50} />
<NSlider variant="accent" value={50} />
<NSlider variant="success" value={50} />
<NSlider variant="warning" value={50} />
<NSlider variant="info" value={50} />`}>
        <PreviewBox className="max-w-xl space-y-3">
          {(["default", "secondary", "destructive", "accent", "success", "warning", "info"] as const).map((v) => (
            <Field key={v} label={v}>
              <NSlider variant={v} value={50} />
            </Field>
          ))}
        </PreviewBox>
      </Example>

      <Example title="Size Variants" center={false} previewHeight="h-48" code={`<NSlider size="sm" value={30} />
<NSlider size="md" value={50} />
<NSlider size="lg" value={70} />`}>
        <PreviewBox className="max-w-xl space-y-4">
          <Field label="Small" helper={`Value: ${sizeSm}`}>
            <NSlider size="sm" value={sizeSm} onValueChange={setSizeSm} />
          </Field>
          <Field label="Medium" helper={`Value: ${sizeMd}`}>
            <NSlider size="md" value={sizeMd} onValueChange={setSizeMd} />
          </Field>
          <Field label="Large" helper={`Value: ${sizeLg}`}>
            <NSlider size="lg" value={sizeLg} onValueChange={setSizeLg} />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="Vertical" center={false} previewHeight="h-56" code={`<NSlider orientation="vertical" value={40} />
<NSlider orientation="vertical" value={[20, 70]} />
<NSlider orientation="vertical" value={60} variant="success" />`}>
        <PreviewBox className="max-w-xl">
          <div className="flex items-end gap-8 h-40">
            <NSlider orientation="vertical" value={40} />
            <NSlider orientation="vertical" value={[20, 70] as [number, number]} />
            <NSlider orientation="vertical" value={60} variant="success" />
          </div>
        </PreviewBox>
      </Example>

      <Example title="With Tooltip" center={false} previewHeight="h-48" code={`<NSlider value={42} showTooltip
  formatTooltip={(n) => \`$\${n}\`} />`}>
        <PreviewBox className="max-w-xl">
          <Field label="Price" helper={`Value: $${tooltipValue}`}>
            <NSlider
              value={tooltipValue}
              onValueChange={setTooltipValue}
              showTooltip
              formatTooltip={(n) => `$${n}`}
            />
          </Field>
        </PreviewBox>
      </Example>

      <Example title="RTL" center={false} previewHeight="h-48" code={`<div dir="rtl">
  <NSlider value={60} />
</div>`}>
        <PreviewBox className="max-w-xl">
          <div dir="rtl">
            <Field label="RTL Slider">
              <NSlider value={60} dir="rtl" />
            </Field>
          </div>
        </PreviewBox>
      </Example>
    </ComponentPage>
  );
}

const sectionMap: Record<string, () => React.ReactElement> = {
  'text-input': TextInputSection,
  'password-input': PasswordInputSection,
  'number-input': NumberInputSection,
  'search-input': SearchInputSection,
  'textarea-input': TextareaSection,
  'select-input': SelectInputSection,
  'combobox-input': ComboboxInputSection,
  'multiselect-input': MultiSelectInputSection,
  checkbox: CheckboxSection,
  'radio-group': RadioGroupSection,
  'switch-input': SwitchInputSection,
  'date-input': DateInputSection,
  'time-zone-input': TimeZoneInputSection,
  'phone-input': PhoneInputSection,
  'file-input': FileInputSection,
  'image-input': ImageInputSection,
  'color-picker': ColorPickerSection,
  'star-rating': StarRatingSection,
  'emoji-input': EmojiInputSection,
  'lang-input': LangInputSection,
  slider: SliderSection,
};

export function InputsPage({ slug }: { slug?: string }) {
  const Section = slug ? (sectionMap[slug] ?? TextInputSection) : TextInputSection;
  return <Section />;
}
