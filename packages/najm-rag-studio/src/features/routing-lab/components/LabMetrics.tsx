import { Clock3, GitBranch, ShieldCheck, Zap } from 'lucide-react';

interface LabMetricsProps {
  elapsedMs: number | null;
  matchesCount: number;
  dependenciesCount: number;
  confirmationsCount: number;
}

export function LabMetrics({ elapsedMs, matchesCount, dependenciesCount, confirmationsCount }: LabMetricsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-txt-muted">
      <div className="inline-flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{elapsedMs ?? 0}ms</span>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        <span>{matchesCount} matched</span>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5" />
        <span>{dependenciesCount} dependencies</span>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{confirmationsCount} confirmations</span>
      </div>
    </div>
  );
}
