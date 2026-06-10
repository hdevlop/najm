import React, { useState } from 'react';
import { Loader2, X, ChevronUp, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from "../Button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';

export interface NBulkActionButton {
  type?: 'button';
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
}

export interface NBulkActionSelect {
  type: 'select';
  id: string;
  label: string;
  icon?: LucideIcon;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  buttonLabel?: string;
  disabled?: boolean;
}

export type NBulkAction = NBulkActionButton | NBulkActionSelect;

export interface NBulkActionsBarProps {
  count: number;
  actions: NBulkAction[];
  /** Invoked for `button` actions, and for `select` actions with the chosen option value. */
  onAction: (actionId: string, value?: string) => Promise<void> | void;
  onClear: () => void;
  busy?: boolean;
  variant?: 'docked' | 'floating';
  className?: string;
}

/**
 * Sticky bottom toolbar that appears when ≥1 item is selected.
 * Renders a mix of plain button actions (Delete, Copy, Move, …) and
 * select-then-confirm actions (Move to lang, Move to folder, …).
 */
export function NBulkActionsBar({ count, actions, onAction, onClear, busy, variant = 'docked', className }: NBulkActionsBarProps) {
  if (count <= 0) return null;

  if (variant === 'floating') {
    return (
      <div className={cn('pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4', className)}>
        <div className={cn(
          'pointer-events-auto flex w-fit max-w-full items-stretch',
          'divide-x divide-border/40 overflow-hidden',
          'rounded-full border border-border/60 bg-background/85 shadow-lg backdrop-blur',
        )}>
          <div className="flex items-center gap-2 px-4 h-11 text-sm">
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground">selected</span>
          </div>
          {actions.map((a) =>
            a.type === 'select'
              ? <FloatingSelectSegment key={a.id} action={a} busy={busy} onAction={onAction} />
              : <FloatingButtonSegment key={a.id} action={a} busy={busy} onAction={onAction} />
          )}
          <button
            type="button"
            onClick={onClear}
            className="flex items-center justify-center px-3 h-11 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{count}</span>
        <span className="text-muted-foreground">selected</span>
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1 text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) =>
          a.type === 'select' ? (
            <SelectAction key={a.id} action={a} busy={busy} onAction={onAction} />
          ) : (
            <ButtonAction key={a.id} action={a} busy={busy} onAction={onAction} />
          ),
        )}
      </div>
    </div>
  );
}

function ButtonAction({
  action,
  busy,
  onAction,
}: {
  action: NBulkActionButton;
  busy?: boolean;
  onAction: (id: string, value?: string) => Promise<void> | void;
}) {
  const Icon = action.icon;
  return (
    <Button
      size="sm"
      variant={action.danger ? 'destructive' : 'default'}
      disabled={busy || action.disabled}
      onClick={() => onAction(action.id)}
      className="gap-1.5"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {action.label}
    </Button>
  );
}

function SelectAction({
  action,
  busy,
  onAction,
}: {
  action: NBulkActionSelect;
  busy?: boolean;
  onAction: (id: string, value?: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState('');
  const Icon = action.icon;
  return (
    <div className="flex items-center gap-1.5">
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      <span className="text-xs text-muted-foreground">{action.label}</span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy || action.disabled}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">{action.placeholder ?? '…'}</option>
        {action.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!value || busy || action.disabled}
        onClick={async () => {
          await onAction(action.id, value);
          setValue('');
        }}
        className="gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {action.buttonLabel ?? 'Apply'}
      </Button>
    </div>
  );
}

function FloatingButtonSegment({
  action,
  busy,
  onAction,
}: {
  action: NBulkActionButton;
  busy?: boolean;
  onAction: (id: string, value?: string) => Promise<void> | void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled={busy || action.disabled}
      onClick={() => onAction(action.id)}
      className={cn(
        'flex items-center gap-2 px-4 h-11 text-sm transition-colors',
        'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
        action.danger && 'text-status-red hover:bg-status-red/10',
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  );
}

function FloatingSelectSegment({
  action,
  busy,
  onAction,
}: {
  action: NBulkActionSelect;
  busy?: boolean;
  onAction: (id: string, value?: string) => Promise<void> | void;
}) {
  const Icon = action.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy || action.disabled}
        className="flex items-center gap-2 px-4 h-11 text-sm hover:bg-accent disabled:opacity-50"
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span className="hidden sm:inline">{action.label}</span>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-72 najm-overlay-scroll-y">
        {action.options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => void onAction(action.id, o.value)}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
