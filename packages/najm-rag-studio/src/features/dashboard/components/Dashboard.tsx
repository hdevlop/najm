import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleDot,
  FileText,
  Inbox,
  Languages,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Tag,
  Wrench,
} from 'lucide-react';
import { Button, Badge, NPageHeader, NEmptyState } from 'najm-ui';
import { cn } from '@/lib/utils';
import { documentDate, documentName, documentStatus } from './helpers';
import { useDashboardData } from '../hooks/useDashboardData';
import { NStatCardSkeleton } from 'najm-ui';
import type { Workspace } from '@/shared/hooks/useWorkspace';

const COLORS = ['#10b981', '#f97316', '#7c3aed', '#3b82f6', '#ef4444', '#71717a'];

interface DashboardProps {
  onNavigate: (workspace: Workspace) => void;
}

/* ─── Stat Card (WA-style) ─── */

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, subtext, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors',
        onClick && 'cursor-pointer hover:border-border-subtle hover:bg-card-hover'
      )}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-xs text-txt-muted">{label}</p>
        <p className="text-2xl font-semibold leading-none text-txt-primary">{value}</p>
        {subtext && <p className="text-[10px] text-txt-muted">{subtext}</p>}
      </div>
    </div>
  );
}

/* ─── System Health Item ─── */

interface HealthItemProps {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral' | 'bad';
  icon: React.ElementType;
}

function HealthItem({ label, value, tone, icon: Icon }: HealthItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            tone === 'good' && 'bg-status-green',
            tone === 'warn' && 'bg-status-yellow',
            tone === 'bad' && 'bg-status-red',
            tone === 'neutral' && 'bg-txt-muted'
          )}
        />
        <span className="text-sm font-medium text-txt-primary">{label}</span>
      </div>
      <span
        className={cn(
          'rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium uppercase',
          tone === 'good' && 'text-status-green',
          tone === 'warn' && 'text-status-yellow',
          tone === 'bad' && 'text-status-red',
          tone === 'neutral' && 'text-txt-muted'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    loading,
    error,
    tools,
    semantics,
    documents,
    settings,
    unmatched,
    load,
    totalDeps,
    activePhrases,
    pendingPhrases,
    phraseCoverage,
    documentCount,
    chunkCount,
    embeddingCount,
    indexedDocs,
    pendingDocs,
    errorDocs,
    routerOnline,
    embeddingOnline,
    knowledgeEnabled,
    status,
    embeddingHealth,
  } = useDashboardData();

  const groupChartData = useMemo(() => {
    const groupCounts = tools.reduce((acc, tool) => {
      const group = tool.group || 'default';
      acc[group] = (acc[group] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(groupCounts).map(([name, value]) => ({ name, value }));
  }, [tools]);

  const phraseStatusData = [
    { name: 'Active', value: activePhrases, color: '#10b981' },
    { name: 'Pending', value: pendingPhrases, color: '#f97316' },
  ];

  const latestDocs = [...documents]
    .sort((a, b) => documentDate(b) - documentDate(a))
    .slice(0, 6);

  return (
    <NPageHeader
      icon={LayoutDashboard}
      title="Dashboard"
      subtitle="System overview, routing configuration, and knowledge health"
      search={{
        placeholder: "Search tools, documents...",
        onChange: (e) => console.log(e.target.value),
      }}
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0 gap-1.5 px-2 sm:px-3">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
      contentClassName="flex-1 min-h-0 overflow-hidden"
    >
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden xl:p-5" aria-live="polite">
        {error && (
          <div className="shrink-0 rounded-lg border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red" role="alert">
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {loading && tools.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => <NStatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={Wrench}
                label="MCP Tools"
                value={tools.length || status?.registeredToolCount || 0}
                subtext={`${totalDeps} deps`}
                onClick={() => onNavigate('routing-tools')}
              />
              <StatCard
                icon={Languages}
                label="Phrases"
                value={semantics.length || status?.semanticPhraseCount || 0}
                subtext={`${activePhrases} active`}
                onClick={() => onNavigate('routing-semantics')}
              />
              <StatCard
                icon={BookOpen}
                label="Documents"
                value={documentCount}
                subtext={`${indexedDocs} indexed`}
                onClick={knowledgeEnabled ? () => onNavigate('knowledge-documents') : undefined}
              />
              <StatCard
                icon={FileText}
                label="Total Chunks"
                value={chunkCount.toLocaleString()}
                subtext={`${embeddingCount.toLocaleString()} embedded`}
                onClick={knowledgeEnabled ? () => onNavigate('knowledge-chunks') : undefined}
              />
              <StatCard
                icon={Inbox}
                label="Unmatched"
                value={unmatched.count}
                subtext={unmatched.count > 0 ? 'needs mapping' : 'inbox zero'}
                onClick={() => onNavigate('logs-unmatched')}
              />
              <StatCard
                icon={CheckCircle2}
                label="Indexed Tools"
                value={status?.indexedToolCount ?? tools.filter((tool) => tool.indexed).length}
                subtext="vector indexed"
                onClick={() => onNavigate('routing-tools')}
              />
            </>
          )}
        </div>

        {/* ── Charts Row (2/3 + 1/3) ── */}
        <div className="grid min-h-[420px] shrink-0 grid-cols-1 gap-4 lg:min-h-0 lg:flex-[1.15_1_0] lg:grid-cols-3">
          {/* Phrase Status */}
          <div className="col-span-1 flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 lg:col-span-2">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Phrase Status</h3>
              <p className="text-xs text-txt-muted">Semantic mapping health</p>
            </div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phraseStatusData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid #27272a', borderRadius: '6px', fontSize: '12px' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {phraseStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-txt-muted">Coverage</span>
              <span className="text-xs font-medium text-status-green">{phraseCoverage}% active</span>
            </div>
          </div>

          {/* Tool Groups */}
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Tool Groups</h3>
              <p className="text-xs text-txt-muted">Distribution by category</p>
            </div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={groupChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                    {groupChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid #27272a', borderRadius: '6px', fontSize: '12px' }}
                    itemStyle={{ color: '#a1a1aa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {groupChartData.map((group, index) => (
                <div key={group.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] text-txt-muted">{group.name} ({group.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Row (1/2 + 1/2) ── */}
        <div className="grid min-h-[300px] shrink-0 grid-cols-1 gap-4 lg:min-h-0 lg:flex-[0.85_1_0] lg:grid-cols-2">
          {/* Knowledge Base */}
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Knowledge Base</h3>
              <p className="text-xs text-txt-muted">Document sync status</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col gap-2">
              {latestDocs.map((doc) => {
                const syncStatus = documentStatus(doc);
                return (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          syncStatus === 'indexed' && 'bg-status-green',
                          syncStatus === 'pending' && 'bg-status-yellow',
                          syncStatus === 'error' && 'bg-status-red',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-txt-primary truncate">{documentName(doc)}</p>
                        <p className="text-[10px] text-txt-muted">{doc.chunkCount} chunks</p>
                      </div>
                    </div>
                    <Badge
                      variant={syncStatus === 'indexed' ? 'success' : syncStatus === 'pending' ? 'warning' : 'destructive'}
                      className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider shrink-0"
                    >
                      {syncStatus}
                    </Badge>
                  </div>
                );
              })}
              {latestDocs.length === 0 && (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <NEmptyState icon={BookOpen} title="No documents" description="No documents indexed yet." />
                </div>
              )}
              </div>
            </div>
            <div className="mt-1 grid shrink-0 grid-cols-3 gap-2 border-t border-border pt-3">
              <div className="text-center">
                <p className="text-xs font-medium text-status-green">{indexedDocs}</p>
                <p className="text-[10px] text-txt-muted">Indexed</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-status-yellow">{pendingDocs}</p>
                <p className="text-[10px] text-txt-muted">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-status-red">{errorDocs}</p>
                <p className="text-[10px] text-txt-muted">Error</p>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">System Health</h3>
              <p className="text-xs text-txt-muted">Component status overview</p>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <HealthItem
                label="Router"
                value={routerOnline ? 'Online' : 'Disabled'}
                tone={routerOnline ? 'good' : 'warn'}
                icon={CircleDot}
              />
              <HealthItem
                label="Indexer"
                value={status?.indexingRunning ? 'Indexing' : 'Idle'}
                tone={status?.indexingRunning ? 'warn' : 'good'}
                icon={Activity}
              />
              <HealthItem
                label="Embedding"
                value={embeddingOnline ? 'Healthy' : 'Check'}
                tone={embeddingOnline ? 'good' : 'warn'}
                icon={Activity}
              />
              <HealthItem
                label="Similarity"
                value={`${Math.round((settings?.similarityThreshold ?? 0) * 100)}% threshold`}
                tone="neutral"
                icon={Tag}
              />
              <HealthItem
                label="Max Tools"
                value={`${settings?.maxTools ?? 0} limit`}
                tone="neutral"
                icon={AlertTriangle}
              />
            </div>
          </div>
        </div>
      </div>
    </NPageHeader>
  );
}
