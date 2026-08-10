import React from 'react';
import { NCredentialsCard, NButton } from 'najm-kit';
import { Phone, KeyRound, Mail, Globe2, ShieldCheck } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function NCredentialsCardPage() {
  return (
    <ComponentPage
      title="NCredentialsCard"
      description="One-time handover surface for freshly generated credentials. Renders a labeled field list, copies on a user gesture, and never auto-copies, logs, or stores the value."
      category="Data Display"
    >
      <Example
        title="Default — phone + password"
        description="Two fields with the packaged English copy labels."
        previewHeight="h-[420px]"
        code={`import { NCredentialsCard } from 'najm-kit';
import { Phone, KeyRound } from 'lucide-react';

<NCredentialsCard
  title="Account created"
  description="Give these details directly to the person. The password is shown only once."
  fields={[
    { label: 'Phone', value: '+1 555 0100', icon: Phone },
    { label: 'Initial password', value: 'p@ssw0rd!', icon: KeyRound },
  ]}
/>`}
      >
        <NCredentialsCard
          title="Account created"
          description="Give these details directly to the person. The password is shown only once."
          fields={[
            { label: 'Phone', value: '+1 555 0100', icon: Phone },
            { label: 'Initial password', value: 'p@ssw0rd!', icon: KeyRound },
          ]}
        />
      </Example>

      <Example
        title="With custom actions"
        description="Consumer-owned buttons next to the built-in copy action."
        previewHeight="h-[480px]"
        code={`import { NCredentialsCard, NButton } from 'najm-kit';
import { Phone, Mail, Globe2, ShieldCheck } from 'lucide-react';

<NCredentialsCard
  title="Provisioning bundle"
  description="Operator handover with extra context."
  fields={[
    { label: 'Phone', value: '+212 555 0199', icon: Phone },
    { label: 'Email', value: 'ops@example.com', icon: Mail },
    {
      label: 'Login URL',
      value: 'https://app.example.com/login?token=8f4e7c1a',
      icon: Globe2,
      mono: false,
    },
    { label: 'Recovery code', value: '9e3b1c2d-3e4f', icon: ShieldCheck },
  ]}
  actions={<NButton onClick={() => alert('Done')}>Done</NButton>}
/>`}
      >
        <NCredentialsCard
          title="Provisioning bundle"
          description="Operator handover with extra context."
          fields={[
            { label: 'Phone', value: '+212 555 0199', icon: Phone },
            { label: 'Email', value: 'ops@example.com', icon: Mail },
            {
              label: 'Login URL',
              value: 'https://app.example.com/login?token=8f4e7c1a-2b9d-4f0e-9e3b-1c2d3e4f5a6b',
              icon: Globe2,
              mono: false,
            },
            { label: 'Recovery code', value: '9e3b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d', icon: ShieldCheck },
          ]}
          actions={<NButton onClick={() => alert('Done')}>Done</NButton>}
        />
      </Example>

      <Example
        title="Long value"
        description="A secret that wraps mid-string without breaking layout."
        previewHeight="h-[340px]"
        code={`import { NCredentialsCard } from 'najm-kit';
import { KeyRound } from 'lucide-react';

<NCredentialsCard
  title="Long recovery phrase"
  description="A value that needs to wrap mid-string without breaking layout."
  fields={[
    {
      label: 'Passphrase',
      value:
        'trail-mango-velvet-orchid-pioneer-quartz-river-falcon-summit-dragon-amber-canyon-frost-lantern-meadow',
      icon: KeyRound,
    },
  ]}
/>`}
      >
        <NCredentialsCard
          title="Long recovery phrase"
          description="A value that needs to wrap mid-string without breaking layout."
          fields={[
            {
              label: 'Passphrase',
              value:
                'trail-mango-velvet-orchid-pioneer-quartz-river-falcon-summit-dragon-amber-canyon-frost-lantern-meadow',
              icon: KeyRound,
            },
          ]}
        />
      </Example>
    </ComponentPage>
  );
}
