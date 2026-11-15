import React, { useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Inbox,
  Languages,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { Button, Badge, NCard, NPageHeader, NEmptyState, NPieChart, NSkeleton, NStatCard, NStatCardSkeleton, NStatusBreakdown, cn } from 'najm-kit';
import { documentDate, documentName, documentStatus } from './helpers';
import { useDashboardData } from '../hooks/useDashboardData';
import type { Workspace } from '@/shared/hooks/useWorkspace';

const MAX_GROUP_SLICES = 5;

interface DashboardProps {
  onNavigate: (workspace: Workspace) => void;
}

/* ─── System Health Item ─── */

type HealthTone = 'good' | 'warn' | 'neutral' | 'bad';

const HEALTH_BADGE: Record<HealthTone, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  good: 'success',
  warn: 'warning',
  bad: 'destructive',
  neutral: 'secondary',
};

interface HealthItemProps {
  label: string;
  value: string;
  tone: HealthTone;
}

function HealthItem({ label, value, tone }: HealthItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            tone === 'good' && 'bg-status-green',
            tone === 'warn' && 'bg-status-yellow',
            tone === 'bad' && 'bg-status-red',
            tone === 'neutral' && 'bg-txt-muted'
          )}
        />
        <span className="truncate text-sm font-medium text-txt-primary">{label}</span>
      </div>
      <Badge variant={HEALTH_BADGE[tone]} className="shrink-0 uppercase">{value}</Badge>
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <NSkeleton key={i} className="h-10 w-full rounded-lg" />)}
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

  // `loading` is also true on a manual refresh; only the first load has no
  // data to show, so only then do panels render skeletons instead of zeros.
  const initialLoading = loading && status === null;

  const groupChartData = useMemo(() => {
    const groupCounts = tools.reduce((acc, tool) => {
      const group = tool.group || 'default';
      acc[group] = (acc[group] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    // The pie legend lists one row per slice, so long tails fold into "Other".
    const sorted = Object.entries(groupCounts).sort(([, a], [, b]) => b - a);
    const top: Array<{ id: string; label: string; value: number; color?: string }> = sorted
      .slice(0, MAX_GROUP_SLICES)
      .map(([name, value]) => ({ id: name, label: name, value }));
    const rest = sorted.slice(MAX_GROUP_SLICES);
    if (rest.length) {
      // The kit palette has five colors, so a sixth slice would reuse the
      // first one; "Other" gets a neutral color instead.
      top.push({
        id: '__other',
        label: `Other (${rest.length})`,
        value: rest.reduce((sum, [, n]) => sum + n, 0),
        color: 'var(--muted-foreground)',
      });
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
          {initialLoading ? (
            Array.from({ length: 6 }).map((_, i) => <NStatCardSkeleton key={i} subtext />)
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

        {/* ── Panels: Phrase Status over Knowledge Base + System Health; Tool Groups on the right ── */}
        <div className="grid shrink-0 grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)]">
          <NStatusBreakdown
            className="lg:col-span-2"
            ariaLabel="Phrase status"
            title={
              <span className="flex items-center gap-2">
                Phrase Status
                {!initialLoading && <Badge variant="success">{phraseCoverage}% active</Badge>}
              </span>
            }
            items={phraseStatusData}
            loading={initialLoading}
            loadingLabel="Loading phrase status"
            emptyLabel="No semantic phrases yet"
          />

          <NPieChart
            className="min-h-0 overflow-hidden lg:col-start-3 lg:row-span-2 lg:row-start-1"
            ariaLabel="Tool groups"
            title="Tool Groups"
            items={groupChartData}
            size="sm"
            loading={initialLoading}
            loadingLabel="Loading tool groups"
            emptyLabel="No tools indexed yet"
          />

          {/* Knowledge Base */}
          <NCard
            title="Knowledge Base"
            description="Document sync status"
            className="min-h-[300px] overflow-hidden lg:min-h-0"
            classNames={{ content: 'min-h-0 flex-1' }}
            loading={initialLoading}
            skeleton={<ListSkeleton rows={4} />}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              {latestDocs.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <NEmptyState icon={BookOpen} title="No documents" description="No documents indexed yet." />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {latestDocs.map((doc) => {
                    const syncStatus = documentStatus(doc);
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent/50">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              syncStatus === 'indexed' && 'bg-status-green',
                              syncStatus === 'pending' && 'bg-status-yellow',
                              syncStatus === 'error' && 'bg-status-red',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-txt-primary">{documentName(doc)}</p>
                            <p className="text-xs text-txt-muted">{doc.chunkCount} chunks</p>
                          </div>
                        </div>
                        <Badge
                          variant={syncStatus === 'indexed' ? 'success' : syncStatus === 'pending' ? 'warning' : 'destructive'}
                          className="shrink-0 uppercase"
                        >
                          {syncStatus}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-border pt-3">
              {[
                { label: 'Indexed', value: indexedDocs, tone: 'text-status-green' },
                { label: 'Pending', value: pendingDocs, tone: 'text-status-yellow' },
                { label: 'Error', value: errorDocs, tone: 'text-status-red' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className={cn('text-base font-semibold tabular-nums', item.tone)}>{item.value}</p>
                  <p className="text-xs text-txt-muted">{item.label}</p>
                </div>
              ))}
            </div>
          </NCard>

          {/* System Health */}
          <NCard
            title="System Health"
            description="Component status overview"
            className="min-h-[300px] overflow-hidden lg:min-h-0"
            classNames={{ content: 'min-h-0 flex-1' }}
            loading={initialLoading}
            skeleton={<ListSkeleton rows={5} />}
          >
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <HealthItem
                label="Router"
                value={routerOnline ? 'Online' : 'Disabled'}
                tone={routerOnline ? 'good' : 'warn'}
              />
              <HealthItem
                label="Indexer"
                value={status?.indexingRunning ? 'Indexing' : 'Idle'}
                tone={status?.indexingRunning ? 'warn' : 'good'}
              />
              <HealthItem
                label="Embedding"
                value={embeddingOnline ? 'Healthy' : 'Check'}
                tone={embeddingOnline ? 'good' : 'warn'}
              />
              {typeof status?.staleSemanticCount === 'number' && (
                <HealthItem
                  label="Phrase vectors"
                  value={status.staleSemanticCount > 0
                    ? `${status.staleSemanticCount} to reindex`
                    : 'Current'}
                  tone={status.staleSemanticCount > 0 ? 'warn' : 'good'}
                />
              )}
              <HealthItem
                label="Similarity"
                value={`${Math.round((settings?.similarityThreshold ?? 0) * 100)}% threshold`}
                tone="neutral"
              />
              <HealthItem
                label="Max Tools"
                value={`${settings?.maxTools ?? 0} limit`}
                tone="neutral"
              />
            </div>
          </NCard>
        </div>
        </div>
      </div>
    </>
  );
}
