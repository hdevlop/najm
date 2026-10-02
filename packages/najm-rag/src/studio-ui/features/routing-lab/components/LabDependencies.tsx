import { Badge } from 'najm-kit';

interface LabDependenciesProps {
  visibleDependencies: Array<{ toolName: string; reason: string }>;
}

export function LabDependencies({ visibleDependencies }: LabDependenciesProps) {
  if (visibleDependencies.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-status-yellow" />
        <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">Dependencies</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleDependencies.map((dependency) => (
          <Badge key={`${dependency.reason}:${dependency.toolName}`} variant="outline" className="text-sm font-mono">
            {dependency.toolName}
          </Badge>
        ))}
      </div>
    </div>
  );
}