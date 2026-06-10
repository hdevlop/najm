import { Table, FileJson } from 'lucide-react';
import { cn } from "../../lib/cn";

interface NViewToggleProps {
  mode: 'table' | 'json';
  onChange: (mode: 'table' | 'json') => void;
  className?: string;
}

export function NViewToggle({ mode, onChange, className }: NViewToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 border border-border rounded-md px-0.5', className)}>
      <button
        onClick={() => onChange('table')}
        className={cn(
          'flex items-center gap-1.5 px-3 h-9 rounded text-xs transition-colors',
          mode === 'table'
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Table className="h-3.5 w-3.5" />
        Table
      </button>
      <button
        onClick={() => onChange('json')}
        className={cn(
          'flex items-center gap-1.5 px-3 h-9 rounded text-xs transition-colors',
          mode === 'json'
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileJson className="h-3.5 w-3.5" />
        JSON
      </button>
    </div>
  );
}