import React from 'react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Textarea } from 'najm-ui';
import type { AutoReplyRule, MatchType } from '../types';

interface AddRuleModalProps {
  initial?: AutoReplyRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddRuleModal({ initial, onClose, onSaved }: AddRuleModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [saving, setSaving] = React.useState(false);

  const [pattern, setPattern] = React.useState(initial?.pattern ?? '');
  const [response, setResponse] = React.useState(initial?.response ?? '');
  const [matchType, setMatchType] = React.useState<MatchType>(initial?.matchType ?? 'exact');

  const isEdit = !!initial?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceId || !pattern.trim() || !response.trim()) return;

    setSaving(true);
    try {
      const body = {
        pattern: pattern.trim(),
        response: response.trim(),
        matchType,
        enabled: true,
      };
      if (isEdit) {
        await api.patch(`/auto-reply/${instanceId}/${initial!.id}`, body);
        toast.success('Rule updated');
      } else {
        await api.post(`/auto-reply/${instanceId}`, body);
        toast.success('Rule created');
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
          <DialogTitle>{isEdit ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Pattern</label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="hello or ^!help"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Response</label>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type the auto-reply message..."
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Match Type</label>
            <div className="flex gap-2">
              {(['exact', 'prefix', 'regex'] as MatchType[]).map((mt) => (
                <Button
                  key={mt}
                  type="button"
                  variant={matchType === mt ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setMatchType(mt)}
                  className="text-xs"
                >
                  {mt.charAt(0).toUpperCase() + mt.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !pattern.trim() || !response.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
