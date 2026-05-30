import React from 'react';
import { Send } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { Button, FormInput, NForm, useNForm } from 'najm-ui';

interface SendMessageFormProps {
  instanceId: string;
  jid: string;
  onSent: () => void;
}

export function SendMessageForm({ instanceId, jid, onSent }: SendMessageFormProps) {
  const api = useApiClient();
  const form = useNForm({ defaultValues: { text: '' } });
  const text = (form.watch() as { text: string }).text;
  const [sending, setSending] = React.useState(false);

  async function handleSubmit(values: { text: string }) {
    if (!values.text.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/messages/send', { instanceId, jid, text: values.text.trim() });
      form.reset({ text: '' });
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <NForm form={form} variant="studio" onSubmit={(values) => handleSubmit(values as { text: string })} className="flex-row items-center gap-2 border-t border-border p-3">
      <FormInput
        name="text"
        type="text"
        placeholder="Type a message..."
        classNames={{ item: 'flex-1', input: 'h-10' }}
      />
      <Button size="icon" type="submit" disabled={sending || !text.trim()}>
        <Send className="h-3.5 w-3.5" />
      </Button>
    </NForm>
  );
}
