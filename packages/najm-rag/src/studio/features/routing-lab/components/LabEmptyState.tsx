import { FlaskConical } from 'lucide-react';
import { NEmptyState } from 'najm-ui';

export function LabEmptyState() {
  return (
    <NEmptyState
      icon={FlaskConical}
      title="Enter a query to preview routing decisions"
      description=""
    />
  );
}