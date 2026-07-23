import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  MessageSquare,
  Server,
  Plug,
  Users,
  Webhook,
} from 'lucide-react';
import { NPageHeader, NEmptyState, Button, NStatCard } from 'najm-kit';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { cn } from '@/lib/utils';
import type { Instance } from '@/features/instances/types';

interface DashboardData {
  instances: { total: number; connected: number; disconnected: number };
  messages: { total: number; byInstance: Record<string, number> };
  recentEvents: Array<{ id: string; eventType: string; instanceId: string | null; createdAt: string }>;
  messageTypes: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  text: '#10b981',
  image: '#34d399',
  video: '#059669',
  document: '#6ee7b7',
  audio: '#047857',
  reaction: '#f59e0b',
};

function pickColor(key: string, idx: number) {
  return TYPE_COLORS[key] ?? ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857', '#f59e0b', '#a7f3d0'][idx % 7];
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

/* ─── Dashboard Panel ─── */

export function DashboardView() {
  const api = useApiClient();
  const { instanceId, setInstanceId } = useSelectedInstance();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [instData, dashData] = await Promise.all([
        api.get('/instances').catch(() => []),
        api.get('/instances/dashboard').catch(() => null),
      ]);
      setInstances((instData as Instance[]) || []);
      setDashboard(dashData as DashboardData | null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalMessages = dashboard?.messages.total ?? 0;
  const connectedCount = dashboard?.instances.connected ?? 0;
  const totalInstances = dashboard?.instances.total ?? instances.length;
  const recentEvents = dashboard?.recentEvents ?? [];
  const typesData = Object.entries(dashboard?.messageTypes ?? {}).map(([name, value], idx) => ({
    name,
    value,
    color: pickColor(name, idx),
  }));

  return (
    <NPageHeader
      icon={LayoutDashboard}
      title="Dashboard Overview"
      subtitle="Monitor your WhatsApp instances & operations"
      actions={
        <Button variant="outline" onClick={fetchAll} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-5 p-5">
        {/* Metric Cards — every value is real and falls back to 0 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NStatCard icon={MessageSquare} label="Total Messages" value={String(totalMessages)} />
          <NStatCard icon={Server} label="Instances" value={String(totalInstances)} />
          <NStatCard icon={Plug} label="Connected" value={String(connectedCount)} />
          <NStatCard icon={Webhook} label="Webhook Events" value={String(recentEvents.length)} />
        </div>

        {/* Empty-state handling when there is no data */}
        {totalInstances === 0 && totalMessages === 0 && (
          <NEmptyState
            icon={Server}
            title="No activity yet"
            description="Create an instance and start sending or receiving messages to see real metrics here."
          />
        )}

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Instance Status */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-txt-primary">Instance Status</h3>
            {instances.length === 0 ? (
              <NEmptyState
                icon={Server}
                title="No instances"
                description="Create an instance to see status here."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {instances.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => setInstanceId?.(inst.id)}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                      instanceId === inst.id
                        ? 'border-brand/30 bg-brand/5'
                        : 'border-border bg-bg hover:bg-surface'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          inst.status === 'connected' && 'bg-status-green',
                          inst.status === 'connecting' && 'bg-status-yellow',
                          inst.status === 'error' && 'bg-status-red',
                          inst.status === 'disconnected' && 'bg-txt-muted'
                        )}
                      />
                      <span className="text-sm font-medium text-txt-primary">{inst.name}</span>
                    </div>
                    <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium uppercase text-txt-muted">
                      {inst.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity — real events from webhook event log */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-txt-primary">Recent Webhook Events</h3>
            {recentEvents.length === 0 ? (
              <NEmptyState
                icon={Webhook}
                title="No events"
                description="Webhook events will appear here as configured webhooks receive traffic."
              />
            ) : (
              <div className="flex flex-col gap-1">
                {recentEvents.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface/50">
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                      <span className="text-sm text-txt-secondary">{item.eventType}</span>
                      {item.instanceId && (
                        <span className="text-[10px] text-txt-muted">· {item.instanceId}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-txt-muted">{formatTime(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Types breakdown */}
          {typesData.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-txt-primary">Message Types</h3>
              <div className="flex flex-wrap gap-3">
                {typesData.map((t) => (
                  <div key={t.name} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-xs font-medium text-txt-primary">{t.name}</span>
                    <span className="text-xs text-txt-muted">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </NPageHeader>
  );
}
