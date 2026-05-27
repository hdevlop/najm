import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  MessageSquare,
  Server,
  Plug,
  Zap,
  Users,
  Webhook,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { NPageHeader, NEmptyState, Button } from 'najm-ui';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { cn } from '@/lib/utils';
import type { Instance } from '@/features/instances/types';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ─── Mock data helpers (TODO(API): replace with real endpoints) ─── */

function generateMessagesOverTime() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day) => ({
    day,
    sent: Math.floor(Math.random() * 200) + 80,
    received: Math.floor(Math.random() * 200) + 60,
  }));
}

function generateMessageTypes() {
  return [
    { name: 'Text', value: 62, color: '#10b981' },
    { name: 'Image', value: 18, color: '#34d399' },
    { name: 'Video', value: 8, color: '#059669' },
    { name: 'Document', value: 6, color: '#6ee7b7' },
    { name: 'Audio', value: 4, color: '#047857' },
    { name: 'Reaction', value: 2, color: '#f59e0b' },
  ];
}

function generateActivityFeed() {
  return [
    { id: '1', text: 'Message from Alice Johnson', type: 'message', time: '10:42 AM' },
    { id: '2', text: 'Sent document to Carlos Martinez', type: 'sent', time: '10:40 AM' },
    { id: '3', text: 'Auto-reply triggered for "hello"', type: 'system', time: '10:38 AM' },
    { id: '4', text: 'Reaction from Alice', type: 'reaction', time: '10:37 AM' },
    { id: '5', text: 'Group message in Dev Team', type: 'group', time: '10:35 AM' },
  ];
}

/* ─── Stat Card ─── */

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: { value: string; positive: boolean };
}

function StatCard({ icon: Icon, label, value, change }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-subtle">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-txt-muted">{label}</p>
          {change && (
            <span
              className={cn(
                'flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                change.positive ? 'bg-status-green/10 text-status-green' : 'bg-status-red/10 text-status-red'
              )}
            >
              {change.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {change.value}
            </span>
          )}
        </div>
        <p className="text-2xl font-semibold leading-none text-txt-primary">{value}</p>
      </div>
    </div>
  );
}

/* ─── Dashboard Panel ─── */

export function DashboardView() {
  const api = useApiClient();
  const { instanceId, setInstanceId } = useSelectedInstance();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchInstances() {
    setLoading(true);
    try {
      const data = await api.get('/instances');
      setInstances(data || []);
    } catch {
      // Silently fail on dashboard — empty/mocked state is fine
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 30000);
    return () => clearInterval(interval);
  }, []);

  const messagesData = useMemo(() => generateMessagesOverTime(), []);
  const typesData = useMemo(() => generateMessageTypes(), []);
  const activity = useMemo(() => generateActivityFeed(), []);

  const connectedCount = instances.filter((i) => i.status === 'connected').length;
  const totalMessages = instances.reduce((sum, i) => sum + ((i as any).messageCount || 0), 15432);

  return (
    <NPageHeader
      icon={LayoutDashboard}
      title="Dashboard Overview"
      subtitle="Monitor your WhatsApp instances & operations"
      search={{
        placeholder: "Search conversations, contacts...",
        onChange: (e) => console.log(e.target.value),
      }}
      actions={
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-status-yellow/30 bg-status-yellow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-yellow">
            Demo data
          </span>
          <Button variant="outline" onClick={fetchInstances} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-5 p-5">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={MessageSquare} label="Total Messages" value={totalMessages.toLocaleString()} change={{ value: '12.5%', positive: true }} />
          <StatCard icon={Server} label="Instances" value={String(instances.length || 6)} change={{ value: '50%', positive: true }} />
          <StatCard icon={Plug} label="Connected" value={String(connectedCount || 3)} change={{ value: '33%', positive: true }} />
          <StatCard icon={Zap} label="Events/min" value="42" change={{ value: '8.2%', positive: true }} />
          <StatCard icon={Users} label="Contacts" value="20" change={{ value: '5.3%', positive: true }} />
          <StatCard icon={Webhook} label="Services OK" value="5/6" change={{ value: '0%', positive: true }} />
        </div>

        {/* Charts Row */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3 min-h-0">
          {/* Messages Over Time */}
          <div className="col-span-1 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-txt-primary">Messages Over Time</h3>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messagesData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2d" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#6e6e82', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6e6e82', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f0f16', border: '1px solid #1e1e2d', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#f1f1f4' }}
                  />
                  <Area type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
                  <Area type="monotone" dataKey="received" stroke="#06b6d4" strokeWidth={2} fill="url(#recvGrad)" name="Received" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Message Types */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-txt-primary">Message Types</h3>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {typesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f0f16', border: '1px solid #1e1e2d', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#f1f1f4' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2">
              {typesData.map((t) => (
                <span key={t.name} className="flex items-center gap-1 text-[10px] text-txt-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>

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

          {/* Recent Activity */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-txt-primary">Recent Activity</h3>
            <div className="flex flex-col gap-1">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface/50">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        item.type === 'message' && 'bg-accent',
                        item.type === 'sent' && 'bg-status-green',
                        item.type === 'system' && 'bg-status-yellow',
                        item.type === 'reaction' && 'bg-brand',
                        item.type === 'group' && 'bg-status-green'
                      )}
                    />
                    <span className="text-sm text-txt-secondary">{item.text}</span>
                  </div>
                  <span className="text-[10px] text-txt-muted">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </NPageHeader>
  );
}
