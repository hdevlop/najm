import React from 'react';
import { Plus, X } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, NForm, FormInput, useNForm } from 'najm-kit';

const WHATSAPP_LABEL_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
];

const DEFAULT_COLOR = WHATSAPP_LABEL_COLORS[2];

interface NewLabelModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewLabelModal({ onClose, onCreated }: NewLabelModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const form = useNForm({ defaultValues: { name: '' } });
  const nameValue = (form.watch() as { name: string }).name;
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [creating, setCreating] = React.useState(false);

  async function handleSubmit(values: { name: string }) {
    if (!instanceId || !values.name.trim()) return;
    setCreating(true);
    try {
      await api.post(`/labels/${instanceId}`, { name: values.name.trim(), color });
      toast.success('Label created');
      form.reset({ name: '' });
      setColor(DEFAULT_COLOR);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Create failed: ' + (err?.message || 'unknown'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Label</DialogTitle>
        </DialogHeader>
        <NForm form={form} variant="studio" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormInput name="name" type="text" formLabel="Name" placeholder="e.g. Lead" />
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Color</span>
            <div className="flex flex-wrap gap-2">
              {WHATSAPP_LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform',
                    color === c && 'ring-2 ring-offset-2 ring-offset-card ring-brand scale-110'
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !nameValue.trim()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </NForm>
      </DialogContent>
    </Dialog>
  );
}
