import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Server, Wifi, MessageSquare, Users } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { InstanceCard } from './InstanceCard';
import { CreateInstanceModal } from './CreateInstanceModal';
import { QrModal } from './QrModal';
import { cn } from '@/lib/utils';
import type { Instance } from '@/features/instances/types';
import { NPageHeader, NEmptyState, Button } from 'najm-kit';

interface StatSummaryProps {
  icon: React.ElementType;
  label: string;
  value: string;
  colorClass: string;
}

function StatSummary({ icon: Icon, label, value, colorClass }: StatSummaryProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', colorClass)}>
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold text-txt-primary">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-txt-muted">{label}</span>
      </div>
    </div>
  );
}

export function InstancesView() {
  const api = useApiClient();
  const { instanceId, setInstanceId } = useSelectedInstance();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);

  async function fetchInstances(): Promise<Instance[]> {
    setLoading(true);
    try {
      const data = await api.get('/instances');
      setInstances(data || []);
      return data || [];
    } catch {
      setInstances([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleConnect(id: string) {
    await api.post(`/instances/${id}/connect`);
    const fresh = await fetchInstances();
    const updated = fresh.find((i) => i.id === id);
    if (updated && updated.status !== 'connected') {
      setQrInstanceId(id);
    }
  }

  async function handleDisconnect(id: string) {
    await api.post(`/instances/${id}/disconnect`);
    await fetchInstances();
  }

  async function handleRestart(id: string) {
    await api.post(`/instances/${id}/disconnect`);
    await api.post(`/instances/${id}/connect`);
    await fetchInstances();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this instance?')) return;
    await api.del(`/instances/${id}`);
    if (instanceId === id) setInstanceId(null);
    await fetchInstances();
  }

  const connectedCount = instances.filter((i) => i.status === 'connected').length;
  const totalMessages = instances.reduce((sum, i) => sum + (i.messageCount ?? 0), 0);
  const totalContacts = instances.reduce((sum, i) => sum + (i.contactCount ?? 0), 0);

  return (
    <NPageHeader
      icon={Server}
      title="Instances"
      subtitle="Manage your WhatsApp connections"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchInstances} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className={loading ? 'animate-pulse' : ''}>Refresh</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Top Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatSummary icon={Server} label="Total" value={String(instances.length)} colorClass="bg-brand/10 text-brand" />
          <StatSummary icon={Wifi} label="Connected" value={String(connectedCount)} colorClass="bg-status-green/10 text-status-green" />
          <StatSummary icon={MessageSquare} label="Messages" value={totalMessages > 0 ? totalMessages.toLocaleString() : '—'} colorClass="bg-accent/10 text-accent" />
          <StatSummary icon={Users} label="Contacts" value={totalContacts > 0 ? totalContacts.toLocaleString() : '—'} colorClass="bg-violet-500/10 text-violet-400" />
        </div>

        {instances.length === 0 && !loading && (
          <NEmptyState
            icon={Server}
            title="No instances yet"
            description="Create your first WhatsApp instance to get started."
            action={
              <Button onClick={() => setShowCreate(true)}>
                Create Instance
              </Button>
            }
          />
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              selected={instanceId === inst.id}
              onSelect={(id) => setInstanceId(id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRestart={handleRestart}
              onDelete={handleDelete}
              onShowQr={setQrInstanceId}
            />
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateInstanceModal onClose={() => setShowCreate(false)} onCreated={fetchInstances} />
      )}

      {qrInstanceId && (
        <QrModal instanceId={qrInstanceId} onClose={() => setQrInstanceId(null)} />
      )}
    </NPageHeader>
  );
}
