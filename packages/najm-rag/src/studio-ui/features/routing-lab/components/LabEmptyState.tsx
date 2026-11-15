import { FlaskConical } from 'lucide-react';
import { NEmptyState } from 'najm-kit';

export function LabEmptyState() {
  return (
    <NEmptyState
      icon={FlaskConical}
      title="No preview yet"
      description="Enter a query above to see which tools the router selects, with scores, dependencies and confirmations."
    />
  );
}
