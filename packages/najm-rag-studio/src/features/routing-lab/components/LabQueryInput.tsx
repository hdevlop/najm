import { Play, Loader2 } from 'lucide-react';
import { Button } from 'najm-ui';
import { Textarea } from 'najm-ui';

interface LabQueryInputProps {
  query: string;
  loading: boolean;
  onQueryChange: (val: string) => void;
  onPreview: () => void;
}

export function LabQueryInput({ query, loading, onQueryChange, onPreview }: LabQueryInputProps) {
  return (
    <div className="p-5 space-y-3">
      <Textarea
        placeholder="Enter a query to preview routing decisions..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="min-h-[80px] text-sm bg-card"
      />
      <div className="flex justify-end">
        <Button onClick={onPreview} disabled={!query.trim() || loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Preview
        </Button>
      </div>
    </div>
  );
}