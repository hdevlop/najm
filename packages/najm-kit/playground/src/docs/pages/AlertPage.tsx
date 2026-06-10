import React from 'react';
import { NAlert, NButton } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const tones = [
  { tone: 'info' as const, title: 'Info', desc: 'You can add components using the CLI.' },
  { tone: 'success' as const, title: 'Success', desc: 'Your profile has been updated.' },
  { tone: 'warning' as const, title: 'Warning', desc: 'This action may affect existing data.' },
  { tone: 'error' as const, title: 'Error', desc: 'Your session has expired. Please log in again.' },
];

export function AlertPage() {
  return (
    <ComponentPage
      title="Alert"
      description="Displays a callout for user attention — informational messages, warnings, errors, or successes."
      category="Data Display"
    >
      <Example
        title="Basic usage"
        description="Pass title, description, and icon as props — no sub-components needed."
        center={false}
        code={`import { NAlert } from 'najm-kit';

<NAlert tone="info" title="New message" description="You have 1 unread message." />

<NAlert tone="success" look="outline" title="Purchase confirmed" description="Your receipt is ready to download." />

<NAlert
  tone="warning"
  orientation="responsive"
  title="Cookie preferences"
  description="We use cookies to keep your session preferences."
  actions={
    <>
      <NButton size="sm" variant="outline">Deny</NButton>
      <NButton size="sm">Accept</NButton>
    </>
  }
/>`}
      >
        <div className="w-full space-y-3">
          <NAlert tone="info" title="New message" description="You have 1 unread message." />
          <NAlert tone="success" look="outline" title="Purchase confirmed" description="Your receipt is ready to download." />
          <NAlert
            tone="warning"
            orientation="responsive"
            title="Cookie preferences"
            description="We use cookies to keep your session preferences."
            actions={
              <>
                <NButton size="sm" variant="outline">Deny</NButton>
                <NButton size="sm">Accept</NButton>
              </>
            }
          />
        </div>
      </Example>

      <Example
        title="Default icons"
        description="Each tone gets a default lucide icon automatically when title or description is provided."
        center={false}
        code={`<NAlert tone="info" description="New software update available." />
<NAlert tone="success" description="Your purchase has been confirmed!" />
<NAlert tone="warning" description="Warning: Invalid email address!" />
<NAlert tone="error" description="Error! Task failed successfully." />`}
      >
        <div className="w-full space-y-3">
          <NAlert tone="info" description="New software update available." />
          <NAlert tone="success" description="Your purchase has been confirmed!" />
          <NAlert tone="warning" description="Warning: Invalid email address!" />
          <NAlert tone="error" description="Error! Task failed successfully." />
        </div>
      </Example>

      <Example
        title="Custom icon"
        description="Pass a lucide icon name as a string. Use false to hide the icon."
        center={false}
        code={`<NAlert tone="info" icon="megaphone" title="Announcement" description="Check the blog for updates." />
<NAlert tone="success" icon="rocket" title="Done!" description="All recipients notified." />
<NAlert tone="error" icon={false} description="No icon here." />`}
      >
        <div className="w-full space-y-3">
          <NAlert tone="info" icon="megaphone" title="Announcement" description="Check the blog for updates." />
          <NAlert tone="success" icon="rocket" title="Done!" description="All recipients notified." />
          <NAlert tone="error" icon={false} description="No icon here." />
        </div>
      </Example>

      <Example
        title="Solid look"
        description="All tones with the solid look."
        center={false}
        code={`<NAlert tone="info" look="solid" description="New software update available." />
<NAlert tone="success" look="solid" description="Your purchase has been confirmed!" />
<NAlert tone="warning" look="solid" description="Warning: Invalid email address!" />
<NAlert tone="error" look="solid" description="Error! Task failed successfully." />`}
      >
        <div className="w-full space-y-3">
          {tones.map(({ tone, desc }) => (
            <NAlert key={tone} tone={tone} look="solid" description={desc} />
          ))}
        </div>
      </Example>

      <Example
        title="Outline look"
        description="All tones with the outline look."
        center={false}
        code={`<NAlert tone="info" look="outline" title="Info" description="You can add components using the CLI." />
<NAlert tone="success" look="outline" title="Success" description="Your profile has been updated." />
<NAlert tone="warning" look="outline" title="Warning" description="This action may affect existing data." />
<NAlert tone="error" look="outline" title="Error" description="Your session has expired." />`}
      >
        <div className="w-full space-y-3">
          {tones.map(({ tone, title, desc }) => (
            <NAlert key={tone} tone={tone} look="outline" title={title} description={desc} />
          ))}
        </div>
      </Example>

      <Example
        title="Message alert"
        description="A compact alert for short notifications."
        center={false}
        code={`<NAlert description="12 unread messages. Tap to see." />`}
      >
        <div className="w-full">
          <NAlert description="12 unread messages. Tap to see." />
        </div>
      </Example>

      <Example
        title="Sizes"
        description="sm, md (default), and lg."
        center={false}
        code={`<NAlert size="sm" tone="info" description="Small alert." />
<NAlert size="md" tone="info" description="Medium alert." />
<NAlert size="lg" tone="info" description="Large alert." />`}
      >
        <div className="w-full space-y-3">
          <NAlert size="sm" tone="info" description="Small alert." />
          <NAlert size="md" tone="info" description="Medium alert." />
          <NAlert size="lg" tone="info" description="Large alert." />
        </div>
      </Example>
    </ComponentPage>
  );
}
