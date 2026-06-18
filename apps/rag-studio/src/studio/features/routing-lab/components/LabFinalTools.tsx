import { Badge } from 'najm-kit';
import { ShieldCheck } from 'lucide-react';
import type { RoutingPreviewResult } from '@/features/routing-lab/types';

interface LabFinalToolsProps {
  finalTools: string[];
  matchByTool: Map<string, RoutingPreviewResult['matches'][number]>;
  scoreByTool: Map<string, NonNullable<RoutingPreviewResult['finalToolScores']>[number] | RoutingPreviewResult['matches'][number]>;
  confirmationByTool: Map<string, RoutingPreviewResult['confirmations'][number]>;
  status: string;
}

export function LabFinalTools({ finalTools, matchByTool, scoreByTool, confirmationByTool, status }: LabFinalToolsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-brand" />
          <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">Matched & Final Tools</h3>
        </div>
        <Badge variant={status === 'routed' ? 'success' : status === 'router_error' ? 'destructive' : 'outline'} className="uppercase text-xs">
          {status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {finalTools.map((toolName) => {
          const match = matchByTool.get(toolName);
          const score = scoreByTool.get(toolName) ?? match;
          const confirmation = confirmationByTool.get(toolName);
          const confirmationMessage = confirmation?.resolvedMessage ?? confirmation?.message;
          const matchLevel = score && 'matchLevel' in score ? score.matchLevel : match ? 'secondary' : 'below_threshold';
          return (
            <div
              key={toolName}
              className={[
                'inline-flex w-fit max-w-full items-stretch overflow-hidden rounded-lg border bg-bg transition-colors',
                matchLevel === 'primary'
                  ? 'border-status-green/60 shadow-[0_0_18px_rgba(34,197,94,0.10)]'
                  : matchLevel === 'secondary'
                  ? 'border-status-yellow/70 shadow-[0_0_16px_rgba(234,179,8,0.08)]'
                  : 'border-border',
              ].join(' ')}
            >
              <span className="flex items-center px-3 py-2 text-sm font-medium text-txt-primary whitespace-nowrap">{toolName}</span>
              <div className={`w-px ${matchLevel === 'primary' ? 'bg-status-green/30' : matchLevel === 'secondary' ? 'bg-status-yellow/30' : 'bg-border'}`} />
              <div className="flex items-center gap-1.5 px-2 py-2">
                {score && (
                  <span className={[
                    'text-sm font-mono px-2 py-0.5 rounded-md',
                    matchLevel === 'primary'
                      ? 'text-status-green bg-status-green/10'
                      : matchLevel === 'secondary'
                      ? 'text-status-yellow bg-status-yellow/10'
                      : 'text-txt-secondary bg-card',
                  ].join(' ')}>
                    {(score.similarity * 100).toFixed(1)}%
                  </span>
                )}
                {confirmation && (
                  <Badge
                    variant={confirmation.level === 'danger' ? 'destructive' : confirmation.level === 'warning' ? 'warning' : 'outline'}
                    className="gap-1 rounded-md text-xs capitalize"
                    title={confirmationMessage}
                  >
                    <ShieldCheck className="h-3 w-3" /> {confirmation.level}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
        {finalTools.length === 0 && (
          <p className="text-sm text-txt-muted text-center py-4">No tools selected</p>
        )}
      </div>
    </div>
  );
}
