import * as React from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from "../../lib/cn";
import { NajmScroll } from "./scroll";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowFreeText?: boolean;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyText = 'No matches',
  className,
  allowFreeText = false,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const selectedLabel = React.useMemo(() => {
    const match = options.find((o) => o.value === value);
    return match?.label ?? value;
  }, [options, value]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) {
        commit(filtered[highlight].value);
      } else if (allowFreeText && query.trim()) {
        commit(query.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          disabled && 'opacity-50 cursor-not-allowed',
          !value && 'text-muted-foreground',
        )}
      >
        <span className="truncate text-left">{value ? selectedLabel : placeholder}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>
      {open && (
        <div className="absolute z-[10000] mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground caret-foreground"
            />
          </div>
          <NajmScroll className="max-h-64">
            <div className="py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {allowFreeText && query.trim() ? `Press Enter to use "${query.trim()}"` : emptyText}
                </div>
              ) : (
                filtered.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => commit(opt.value)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-sm text-left transition-colors',
                      i === highlight ? 'bg-muted text-foreground' : 'text-foreground',
                      opt.value === value && 'font-medium',
                    )}
                  >
                    <span className="truncate font-mono text-sm">{opt.label}</span>
                    {opt.value === value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))
              )}
            </div>
          </NajmScroll>
        </div>
      )}
    </div>
  );
}
