import React from 'react';
import type { Row } from '@tanstack/react-table';
import { Badge, Button, NDataCardShell } from 'najm-kit';
import { Boxes, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import type { SemanticPhraseResponse } from '@/features/routing-semantics/types';

export interface SemanticCardContext {
  toolGroupByName: Record<string, string>;
  onEdit: (phrase: SemanticPhraseResponse) => void;
  onDelete: (id: string) => void;
}

export function makeSemanticCard(ctx: SemanticCardContext) {
  return function SemanticCard({
    data,
    row,
    onClick,
    onContextMenu,
    isExpanded,
    onToggleExpanded,
    canExpand,
    renderSubRow,
  }: {
    data: SemanticPhraseResponse;
    row: Row<SemanticPhraseResponse>;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    canExpand?: boolean;
    renderSubRow?: (row: SemanticPhraseResponse) => React.ReactNode;
  }) {
    const phrase = data;
    const confirm = phrase.confirmation;
    const confirmVariant =
      confirm?.level === 'danger' ? 'destructive' : confirm?.level === 'warning' ? 'warning' : 'outline';

    const stopAnd = (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };

    return (
      <NDataCardShell row={row as unknown as Row<unknown>} onClick={onClick} onContextMenu={onContextMenu}>
        <div className="w-full text-left">
          <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-txt-primary">
            {phrase.phrase}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="max-w-full truncate rounded-md px-2 py-0.5 font-mono text-xs">
              {phrase.toolName}
            </Badge>
            <Badge variant="outline" className="gap-1 rounded-md px-2 py-0.5 text-xs">
              <Boxes className="h-3 w-3" />
              {ctx.toolGroupByName[phrase.toolName] ?? 'default'}
            </Badge>
            <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs uppercase text-txt-muted">
              {phrase.lang}
            </Badge>
            {phrase.hasEmbedding ? (
              <Badge variant="success" className="text-xs uppercase">Embedded</Badge>
            ) : (
              <Badge variant="warning" className="text-xs uppercase">Pending</Badge>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
            {confirm ? (
              <Badge
                variant={confirmVariant}
                className="gap-1 rounded-md text-xs capitalize"
                title={confirm.resolvedMessage ?? confirm.message}
              >
                <ShieldCheck className="h-3 w-3" />
                {confirm.level ?? 'notice'}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-md text-xs text-txt-muted">No confirm</Badge>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={stopAnd(() => ctx.onEdit(phrase))}
                aria-label={`Edit semantic phrase`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-status-red hover:bg-status-red/10"
                onClick={stopAnd(() => ctx.onDelete(phrase.id))}
                aria-label={`Delete semantic phrase`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {isExpanded && renderSubRow && (
            <div data-testid={`subrow-${phrase.id}`} className="mt-3 border-t pt-3">
              {renderSubRow(phrase)}
            </div>
          )}
        </div>
      </NDataCardShell>
    );
  };
}
