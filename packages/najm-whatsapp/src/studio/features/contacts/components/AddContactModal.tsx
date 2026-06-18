import React from 'react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, NForm, FormInput, useNForm } from 'najm-kit';

interface AddContactModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function AddContactModal({ onClose, onSaved }: AddContactModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const form = useNForm({ defaultValues: { jid: '', name: '', phone: '' } });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(values: { jid: string; name: string; phone: string }) {
    if (!instanceId || !values.jid.trim()) return;
    setSaving(true);
    try {
      await api.post(`/contacts/${instanceId}`, {
        jid: values.jid.trim(),
        name: values.name.trim() || undefined,
        phone: values.phone.trim() || undefined,
      });
      toast.success('Contact added');
      form.reset({ jid: '', name: '', phone: '' });
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
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <NForm form={form} variant="studio" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormInput name="jid" type="text" formLabel="JID" required placeholder="1234567890@s.whatsapp.net" />
          <FormInput name="name" type="text" formLabel="Name" placeholder="John Doe" />
          <FormInput name="phone" type="text" formLabel="Phone" placeholder="+1234567890" />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </NForm>
      </DialogContent>
    </Dialog>
  );
}
