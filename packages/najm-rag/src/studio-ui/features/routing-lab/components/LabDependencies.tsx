import { Badge, NCard } from 'najm-kit';
import { GitBranch } from 'lucide-react';

interface LabDependenciesProps {
  visibleDependencies: Array<{ toolName: string; reason: string }>;
}

export function LabDependencies({ visibleDependencies }: LabDependenciesProps) {
  if (visibleDependencies.length === 0) return null;
  return (
    <NCard title="Dependencies" icon={GitBranch} iconColor="text-status-yellow">
      <div className="flex flex-wrap gap-1.5">
        {visibleDependencies.map((dependency) => (
          <Badge key={`${dependency.reason}:${dependency.toolName}`} variant="outline" className="text-sm font-mono">
            {dependency.toolName}
          </Badge>
        ))}
      </div>
    </NCard>
  );
}