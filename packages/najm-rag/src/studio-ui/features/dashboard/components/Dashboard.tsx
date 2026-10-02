import React, { useMemo } from 'react';
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
import { Button, Badge, NPageHeader, NEmptyState, NPieChart, NStatCard, NStatCardSkeleton, NStatusBreakdown, cn } from 'najm-kit';
import { documentDate, documentName, documentStatus } from './helpers';
import { useDashboardData } from '../hooks/useDashboardData';
import type { Workspace } from '@/shared/hooks/useWorkspace';

const MAX_GROUP_SLICES = 5;

interface DashboardProps {
  onNavigate: (workspace: Workspace) => void;
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
    // The pie legend lists one row per slice, so long tails fold into "Other".
    const sorted = Object.entries(groupCounts).sort(([, a], [, b]) => b - a);
    const top = sorted.slice(0, MAX_GROUP_SLICES).map(([name, value]) => ({ id: name, label: name, value }));
    const rest = sorted.slice(MAX_GROUP_SLICES);
    if (rest.length) {
      top.push({ id: '__other', label: `Other (${rest.length})`, value: rest.reduce((sum, [, n]) => sum + n, 0) });
    }
    return top;
  }, [tools]);

  const phraseStatusData = [
    { id: 'active', label: 'Active', value: activePhrases, color: 'var(--color-status-green)' },
    { id: 'pending', label: 'Pending', value: pendingPhrases, color: 'var(--color-status-yellow)' },
  ];

  const latestDocs = [...documents]
    .sort((a, b) => documentDate(b) - documentDate(a))
    .slice(0, 6);

  return (
    <>
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
      />
      <div className="flex-1 min-h-0 overflow-hidden">
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
              <NStatCard
                icon={Wrench}
                label="MCP Tools"
                value={tools.length || status?.registeredToolCount || 0}
                subtext={`${totalDeps} deps`}
                onClick={() => onNavigate('routing-tools')}
              />
              <NStatCard
                icon={Languages}
                label="Phrases"
                value={semantics.length || status?.semanticPhraseCount || 0}
                subtext={`${activePhrases} active`}
                onClick={() => onNavigate('routing-semantics')}
              />
              <NStatCard
                icon={BookOpen}
                label="Documents"
                value={documentCount}
                subtext={`${indexedDocs} indexed`}
                onClick={knowledgeEnabled ? () => onNavigate('knowledge-documents') : undefined}
              />
              <NStatCard
                icon={FileText}
                label="Total Chunks"
                value={chunkCount.toLocaleString()}
                subtext={`${embeddingCount.toLocaleString()} embedded`}
                onClick={knowledgeEnabled ? () => onNavigate('knowledge-chunks') : undefined}
              />
              <NStatCard
                icon={Inbox}
                label="Unmatched"
                value={unmatched.count}
                subtext={unmatched.count > 0 ? 'needs mapping' : 'inbox zero'}
                onClick={() => onNavigate('logs-unmatched')}
              />
              <NStatCard
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
          <NStatusBreakdown
            className="col-span-1 lg:col-span-2"
            ariaLabel="Phrase status"
            title={
              <span className="flex items-center gap-2">
                Phrase Status
                <Badge variant="success">{phraseCoverage}% active</Badge>
              </span>
            }
            items={phraseStatusData}
            emptyLabel="No semantic phrases yet"
          />

          <NPieChart
            className="min-h-0 overflow-hidden"
            ariaLabel="Tool groups"
            title="Tool Groups"
            items={groupChartData}
            size="sm"
            emptyLabel="No tools indexed yet"
          />
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
      </div>
    </>
  );
}
