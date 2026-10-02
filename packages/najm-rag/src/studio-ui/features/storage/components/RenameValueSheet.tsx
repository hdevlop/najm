import React, { useEffect, useId } from 'react';
import { Pencil } from 'lucide-react';
import { Button, FormInput, NAlert, NForm, NSheet, useNForm } from 'najm-kit';
import { z } from 'zod';

interface RenameValueTarget {
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
}

interface RenameValueSheetProps {
  target: RenameValueTarget | null;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  allowUnchanged?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

const schema = z.object({
  value: z.string().trim().min(1, 'Required'),
});

export function RenameValueSheet({
  target,
  busy = false,
  error,
  submitLabel = 'Rename',
  allowUnchanged = false,
  onClose,
  onSubmit,
}: RenameValueSheetProps) {
  const formId = useId();
  const form = useNForm({ schema, defaultValues: { value: target?.initialValue ?? '' } });
  const trimmed = (form.watch('value') ?? '').trim();
  const canSubmit = !!trimmed && (allowUnchanged || trimmed !== target?.initialValue.trim()) && !busy;

  useEffect(() => {
    form.reset({ value: target?.initialValue ?? '' });
  }, [target, form]);

  const submit = ({ value }: z.infer<typeof schema>) => {
    if (canSubmit) onSubmit(value.trim());
  };

  return (
    <NSheet
      open={!!target}
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
      icon={Pencil}
      title={target?.title ?? 'Rename'}
      description={target?.description}
      width={384}
      contentClassName="bg-bg-elev-1"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={formId} disabled={!canSubmit}>{submitLabel}</Button>
        </div>
      }
    >
      <NForm id={formId} schema={schema} form={form} variant="studio" className="space-y-2" onSubmit={submit}>
        <FormInput
          name="value"
          type="text"
          formLabel={target?.label ?? 'New name'}
          placeholder={target?.placeholder}
          autoFocus
        />
        {error && <NAlert tone="destructive" description={error} />}
      </NForm>
    </NSheet>
  );
}
