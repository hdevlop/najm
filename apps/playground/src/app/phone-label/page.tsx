'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { FormInput, NButton, NForm } from 'najm-kit';

// Harness for the FormInput -> PhoneInput accessible name. Before the fix the
// phone control reached the a11y tree anonymous and only the placeholder could
// select it. The readout below is what getByLabel resolves against.
const schema = z.object({ phone: z.string(), relationship: z.string() });

const RELATIONSHIPS = [
  { value: '', label: 'Not provided' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
];

export default function PhoneLabelPage() {
  const [names, setNames] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<string>('');

  useEffect(() => {
    const read = () => {
      const phone = document.querySelector<HTMLInputElement>('input[type="tel"]');
      const select = document.querySelector<HTMLElement>('[data-slot="select-trigger"]');
      setNames({
        phone: phone?.getAttribute('aria-label') ?? '(none)',
        phoneValue: phone?.value ?? '',
        select: select?.getAttribute('aria-label') ?? '(none)',
      });
    };
    read();
    const id = setInterval(read, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Phone accessible name</h1>

      <NForm
        schema={schema}
        defaultValues={{ phone: '', relationship: '' }}
        onSubmit={(values) => setSubmitted(JSON.stringify(values))}
      >
        <FormInput
          name="phone"
          type="phone"
          formLabel="Household phone"
          placeholder="For example: +212 6 12 34 56 78"
          defaultCountry="ma"
          icon="Phone"
          required
        />
        <FormInput
          name="relationship"
          type="select"
          formLabel="Relationship"
          placeholder="Choose a relationship"
          items={RELATIONSHIPS}
          icon="HeartHandshake"
        />
        <NButton type="submit">Submit</NButton>
      </NForm>

      <dl className="bg-card border-border grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-4 text-sm">
        <dt className="text-muted-foreground">phone aria-label</dt>
        <dd className="font-mono">{names.phone}</dd>
        <dt className="text-muted-foreground">phone value</dt>
        <dd className="font-mono">{names.phoneValue || '(empty)'}</dd>
        <dt className="text-muted-foreground">select aria-label</dt>
        <dd className="font-mono">{names.select}</dd>
        <dt className="text-muted-foreground">submitted</dt>
        <dd className="font-mono break-all">{submitted || '(not yet)'}</dd>
      </dl>

      <p className="text-muted-foreground text-sm">
        Expected: phone aria-label is <code>Household phone</code>, and picking
        “Not provided” submits <code>relationship: &quot;&quot;</code>.
      </p>
    </main>
  );
}
