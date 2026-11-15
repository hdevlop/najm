import { Play, Loader2 } from 'lucide-react';
import { Button } from 'najm-kit';
import { Textarea } from 'najm-kit';

interface LabQueryInputProps {
  query: string;
  loading: boolean;
  onQueryChange: (val: string) => void;
  onPreview: () => void;
}

export function LabQueryInput({ query, loading, onQueryChange, onPreview }: LabQueryInputProps) {
  const canPreview = !!query.trim() && !loading;
  return (
    <div className="flex items-end gap-3 px-2 lg:px-0">
      <Textarea
        aria-label="Query to preview"
        placeholder="Enter a query to preview routing decisions… (Ctrl+Enter to run)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canPreview) {
            e.preventDefault();
            onPreview();
          }
        }}
        className="min-h-[72px] flex-1 text-sm"
      />
      <Button onClick={onPreview} disabled={!canPreview} className="shrink-0 gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Preview
      </Button>
    </div>
  );
}
