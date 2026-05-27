import React from 'react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, NForm, FormInput, useNForm } from 'najm-ui';

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const form = useNForm({ defaultValues: { subject: '', participantsText: '' } });
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(values: { subject: string; participantsText: string }) {
    if (!instanceId || !values.subject.trim()) return;
    const participants = values.participantsText
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    if (participants.length === 0) {
      toast.error('Enter at least one participant JID.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/groups', { instanceId, subject: values.subject.trim(), participants });
      toast.success('Group created');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>
        <NForm form={form} variant="studio" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormInput name="subject" type="text" formLabel="Subject" required />
          <FormInput
            name="participantsText"
            type="textarea"
            formLabel="Participants (one JID per line)"
            rows={5}
            required
            placeholder="1234567890@s.whatsapp.net"
          />
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </NForm>
      </DialogContent>
    </Dialog>
  );
}
