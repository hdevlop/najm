import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCcw, X } from 'lucide-react';
import { Alert, AlertIcon } from 'najm-ui';
import type { EmbeddingHealthResult } from '../hooks/useEmbeddingHealth';

interface EmbeddingHealthBannerProps {
  health: EmbeddingHealthResult | null;
  checking?: boolean;
  onRecheck?: () => void | Promise<void>;
}

export function EmbeddingHealthBanner({
  health,
  checking = false,
  onRecheck,
}: EmbeddingHealthBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!health || health.ok || dismissed) {
    return null;
  }

  const providerKnown = Boolean(health.provider && health.provider !== 'unknown');
  const provider = providerKnown ? health.provider : 'Embedding provider';
  const baseUrl = health.baseUrl && health.baseUrl !== 'unknown' ? health.baseUrl : 'Unavailable';
  const model = health.model && health.model !== 'unknown' ? health.model : 'Unavailable';
  const error = health.error || 'The embedding provider did not respond successfully.';

  return (
    <Alert
      variant="destructive"
      role="status"
      aria-live="polite"
      className="fixed right-4 top-16 z-50 w-[min(420px,calc(100vw-2rem))] p-3.5 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-status-red/30 bg-status-red/10 text-status-red">
          <AlertIcon variant="destructive" className="m-0 h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-white">Embedding health alert</p>
            <p className="text-sm leading-5 text-slate-300">
              {providerKnown
                ? `${provider} is not ready, so RAG search and indexing may fail.`
                : 'Could not verify the embedding provider. RAG search and indexing may fail.'}
            </p>
          </div>

          {expanded ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-[#23232e] bg-[#06060a]/60 p-3 text-sm leading-5 text-slate-300">
              <div className="min-w-0">
                <dt className="font-medium text-slate-100">Provider</dt>
                <dd className="truncate">{provider}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-100">Model</dt>
                <dd className="truncate">{model}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-100">Latency</dt>
                <dd>{health.latencyMs}ms</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="font-medium text-slate-100">URL</dt>
                <dd className="break-all">{baseUrl}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="font-medium text-slate-100">Error</dt>
                <dd className="break-words">{error}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-status-red/15 focus:outline-none focus:ring-2 focus:ring-status-red/40"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Hide embedding health details' : 'Show embedding health details'}
            title={expanded ? 'Hide details' : 'Show details'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {onRecheck ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-status-red/15 focus:outline-none focus:ring-2 focus:ring-status-red/40 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onRecheck()}
              disabled={checking}
              aria-label="Recheck embedding health"
              title="Recheck"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </button>
          ) : null}

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-status-red/15 focus:outline-none focus:ring-2 focus:ring-status-red/40"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss embedding health alert"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Alert>
  );
}
