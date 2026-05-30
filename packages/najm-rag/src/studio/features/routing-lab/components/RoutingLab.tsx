import { FlaskConical } from 'lucide-react';
import { Alert, AlertDescription, AlertIcon, AlertTitle } from 'najm-ui';
import { NPageHeader } from 'najm-ui';
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
    <NPageHeader
      icon={FlaskConical}
      title="Routing Lab"
      subtitle="Preview tool selection for queries"
      top={<LabQueryInput query={query} loading={loading} onQueryChange={setQuery} onPreview={() => void handlePreview()} />}
    >
      <div className="p-5">
        {error && (
          <Alert variant="destructive">
            <AlertIcon variant="destructive" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
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
              <Alert variant="warning" className="p-4">
                <AlertIcon variant="warning" />
                <div>
                  <AlertTitle className="uppercase tracking-wider">{result.error ? 'Router Error' : 'Fallback'}</AlertTitle>
                  <AlertDescription>{result.error ?? result.status}</AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        )}
        {!result && !loading && !error && <LabEmptyState />}
      </div>
    </NPageHeader>
  );
}
