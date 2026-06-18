import React, { useState } from 'react';
import { Archive, Pin, BellOff, Trash2, MailOpen, Wrench } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { NPageHeader, NEmptyState, Button, Input } from 'najm-kit';

interface ChatOpsViewProps {
  jid?: string | null;
}

export function ChatOpsView({ jid }: ChatOpsViewProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [loading, setLoading] = useState<string | null>(null);
  const [muteHours, setMuteHours] = useState('8');

  async function runOp(action: string, body?: object) {
    if (!instanceId || !jid) return;
    setLoading(action);
    try {
      await api.post(`/chat-ops/${action}`, { instanceId, jid, ...body });
      toast.success(`${action} succeeded`);
    } catch (err: any) {
      toast.error(`${action} failed: ${err?.message || 'unknown'}`);
    } finally {
      setLoading(null);
    }
  }

  if (!instanceId) {
    return (
      <NEmptyState
        icon={Wrench}
        title="No instance selected"
        description="Select an instance to run chat operations."
      />
    );
  }

  if (!jid) {
    return (
      <NEmptyState
        icon={Wrench}
        title="No conversation selected"
        description="Select a conversation from the Conversations panel to run operations."
      />
    );
  }

  return (
    <NPageHeader
      icon={Wrench}
      title="Chat Ops"
      subtitle={`Target: ${jid}`}
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap gap-2">
          <OpButton icon={Archive} label="Archive" action="archive" loading={loading} onClick={() => runOp('archive')} />
          <OpButton icon={Pin} label="Pin" action="pin" loading={loading} onClick={() => runOp('pin')} />
          <OpButton icon={Trash2} label="Delete" action="delete" loading={loading} onClick={() => runOp('delete')} />
          <OpButton icon={MailOpen} label="Mark Read" action="read" loading={loading} onClick={() => runOp('read')} />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
          <OpButton
            icon={BellOff}
            label="Mute"
            action="mute"
            loading={loading}
            onClick={() => runOp('mute', { duration: (Number(muteHours) || 8) * 60 * 60 * 1000 })}
          />
          <Input
            type="number"
            value={muteHours}
            onChange={(e) => setMuteHours(e.target.value)}
            className="w-24"
          />
          <span className="text-xs text-txt-muted">hours</span>
        </div>
      </div>
    </NPageHeader>
  );
}

function OpButton({
  icon: Icon,
  label,
  action,
  loading,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  action: string;
  loading: string | null;
  onClick: () => void;
}) {
  const isLoading = loading === action;
  return (
    <Button  variant="outline" onClick={onClick} disabled={!!loading} className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {isLoading ? '...' : label}
    </Button>
  );
}
