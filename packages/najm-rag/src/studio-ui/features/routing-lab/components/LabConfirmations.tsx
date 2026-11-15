import { Badge, NCard } from 'najm-kit';
import { ShieldAlert } from 'lucide-react';
import type { RoutingPreviewResult } from '@/features/routing-lab/types';

interface LabConfirmationsProps {
  confirmations: RoutingPreviewResult['confirmations'];
}

export function LabConfirmations({ confirmations }: LabConfirmationsProps) {
  if (confirmations.length === 0) return null;
  return (
    <NCard title="Confirmations" icon={ShieldAlert} iconColor="text-status-red">
      <div className="flex flex-col gap-2">
        {confirmations.map((confirmation) => (
          <div
            key={confirmation.toolName}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
          >
            <span className="font-mono text-sm font-medium text-txt-primary">{confirmation.toolName}</span>
            <Badge
              variant={confirmation.level === 'danger' ? 'destructive' : confirmation.level === 'warning' ? 'warning' : 'outline'}
              className="rounded-md text-xs capitalize"
            >
              {confirmation.level}
            </Badge>
            {(confirmation.resolvedMessage ?? confirmation.message) && (
              <span className="text-sm text-txt-secondary">
                {confirmation.resolvedMessage ?? confirmation.message}
              </span>
            )}
          </div>
        ))}
      </div>
    </NCard>
  );
}