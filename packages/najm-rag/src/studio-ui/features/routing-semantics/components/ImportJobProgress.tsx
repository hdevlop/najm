import { Progress } from 'najm-kit';
import type { ImportJobState } from '@/features/routing-semantics/types';

interface ImportJobProgressProps {
  job: ImportJobState;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'parsing': return 'Parsing files';
    case 'checking': return 'Checking existing rows';
    case 'embedding': return 'Embedding phrases';
    case 'saving': return 'Saving to database';
    case 'completed': return 'Completed';
    default: return phase;
  }
}

export function ImportJobProgress({ job }: ImportJobProgressProps) {
  return (
    <div className="px-5 py-3 border-b border-border bg-surface">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-txt-primary">
          {phaseLabel(job.currentPhase)}
          {job.currentFile ? ` — ${job.currentFile}` : ''}
        </span>
        <span className="text-sm text-txt-muted">
          {job.processed} / {job.total} phrases ({job.progressPercent}%)
        </span>
      </div>
      <Progress value={job.progressPercent} className="h-2" />
      <div className="flex items-center gap-4 mt-1.5 text-xs text-txt-muted">
        <span className="text-status-green">{job.inserted} inserted</span>
        <span className="text-brand">{job.updated} updated</span>
        <span className="text-txt-muted">{job.skipped} skipped</span>
        {job.failed > 0 && <span className="text-status-red">{job.failed} failed</span>}
      </div>
    </div>
  );
}