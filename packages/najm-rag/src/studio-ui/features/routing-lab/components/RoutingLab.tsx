import { FlaskConical } from 'lucide-react';
import { NAlert, NLoadingState, NPageHeader } from 'najm-kit';
import type { RoutingPreviewResult } from '@/features/routing-lab/types';
import type { PendingRoutingLabQuery } from '@/lib/chatDraftsContext';
import { useRoutingLab, buildLabVisibleData } from '../hooks';
import { LabMetrics, LabFinalTools, LabDependencies, LabConfirmations, LabEmptyState, LabQueryInput } from '.';

interface RoutingLabProps {
  onPreview: (query: string) => Promise<RoutingPreviewResult>;
  pendingQuery?: PendingRoutingLabQuery | null;
}

export function RoutingLab({ onPreview, pendingQuery }: RoutingLabProps) {
  const { query, setQuery, loading, result, error, elapsedMs, handlePreview } = useRoutingLab(onPreview, pendingQuery);
  const visible = result ? buildLabVisibleData(result) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <NPageHeader
        icon={FlaskConical}
        title="Routing Lab"
        subtitle="Preview tool selection for queries"
        filters={<LabQueryInput query={query} loading={loading} onQueryChange={setQuery} onPreview={() => void handlePreview()} />}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="p-5">
          {error && <NAlert tone="destructive" description={error} />}
          {result && !loading && visible && (
            <div className="space-y-5">
              <LabMetrics
                elapsedMs={elapsedMs}
                matchesCount={visible.matches.length}
                dependenciesCount={visible.visibleDependencies.length}
                confirmationsCount={visible.confirmations.length}
              />
              <LabFinalTools
                finalTools={visible.finalTools}
                matchByTool={visible.matchByTool}
                scoreByTool={visible.scoreByTool}
                confirmationByTool={visible.confirmationByTool}
                status={result.status}
              />
              <LabDependencies visibleDependencies={visible.visibleDependencies} />
              <LabConfirmations confirmations={visible.confirmations} />
              {(result.error || result.status.startsWith('fallback_')) && (
                <NAlert
                  tone="warning"
                  className="p-4"
                  title={<span className="uppercase tracking-wider">{result.error ? 'Router Error' : 'Fallback'}</span>}
                  description={result.error ?? result.status}
                />
              )}
            </div>
          )}
          {loading && <NLoadingState label="Running routing preview…" />}
          {!result && !loading && !error && <LabEmptyState />}
        </div>
      </div>
    </div>
  );
}
