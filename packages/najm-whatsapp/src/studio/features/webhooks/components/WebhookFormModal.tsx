import React from 'react';
import { useForm } from 'react-hook-form';
import { useApiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { Webhook } from '@/features/webhooks/types';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, NForm, FormInput } from 'najm-kit';

interface WebhookFormModalProps {
  initial?: Webhook | null;
  onClose: () => void;
  onSaved: () => void;
}

interface WebhookFormValues {
  url: string;
  events: string;
  headersJson: string;
  enabled: boolean;
}

export function WebhookFormModal({ initial, onClose, onSaved }: WebhookFormModalProps) {
  const api = useApiClient();
  const toast = useToast();

  const formValues: WebhookFormValues = {
    url: initial?.url ?? '',
    events: (initial?.events ?? []).join(', '),
    headersJson: initial?.headers ? JSON.stringify(initial.headers, null, 2) : '',
    enabled: initial?.enabled ?? true,
  };
  const form = useForm<WebhookFormValues>({ defaultValues: formValues, values: formValues });
  const url = form.watch('url');
  const [saving, setSaving] = React.useState(false);

  const isEdit = !!initial?.id;

  async function handleSubmit(values: WebhookFormValues) {
    if (!values.url.trim()) return;

    let headers: Record<string, string> | undefined;
    if (values.headersJson.trim()) {
      try {
        const parsed = JSON.parse(values.headersJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          headers = parsed;
        } else {
          toast.error('Headers must be a JSON object');
          return;
        }
      } catch {
        toast.error('Headers JSON is invalid');
        return;
      }
    }

    const payload: any = {
      url: values.url.trim(),
      events: values.events
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      headers,
      enabled: values.enabled,
    };
    if (!payload.events.length) payload.events = undefined;

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/webhooks/${initial!.id}`, payload);
        toast.success('Webhook updated');
      } else {
        await api.post('/webhooks', payload);
        toast.success('Webhook created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
        </DialogHeader>
        <NForm form={form as any} variant="studio" onSubmit={handleSubmit as any} className="flex flex-col gap-3">
          <FormInput name="url" type="text" formLabel="URL" required placeholder="https://example.com/hook" />
          <FormInput name="events" type="text" formLabel="Events (comma-separated; empty = all)" placeholder="message, connection_update" />
          <FormInput
            name="headersJson"
            type="textarea"
            formLabel="Headers (JSON object, optional)"
            rows={4}
            placeholder='{ "Authorization": "Bearer ..." }'
            classNames={{ input: 'font-mono text-xs' }}
          />
          <FormInput name="enabled" type="switch" label="Enabled" />
          <Button type="submit" disabled={saving || !url.trim()} className="mt-2">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </NForm>
      </DialogContent>
    </Dialog>
  );
}
