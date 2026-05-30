import React from 'react';
import { useApiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, NForm, FormInput, useNForm } from 'najm-ui';

interface CreateInstanceModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateInstanceModal({ onClose, onCreated }: CreateInstanceModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const form = useNForm({ defaultValues: { name: '', id: '' } });
  const [loading, setLoading] = React.useState(false);
  const name = form.watch('name');

  async function handleSubmit(values: { name: string; id: string }) {
    if (!values.name.trim()) return;
    setLoading(true);
    try {
      await api.post('/instances', { name: values.name.trim(), id: values.id.trim() || undefined });
      toast.success('Instance created');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Create failed: ' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Instance</DialogTitle>
        </DialogHeader>
        <NForm form={form} variant="studio" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormInput name="name" type="text" formLabel="Name" placeholder="My WhatsApp" required />
          <FormInput name="id" type="text" formLabel="ID (optional)" placeholder="auto-generated" />
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </NForm>
      </DialogContent>
    </Dialog>
  );
}
