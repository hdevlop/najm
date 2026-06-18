import React from 'react';
import { Trash2, Wrench } from 'lucide-react';
import { Badge } from 'najm-kit';
import { TableCell, TableRow } from 'najm-kit';
import { ToolParameterList } from './ToolParameterList';
import { ToolDependencyEditor } from './ToolDependencyEditor';
import type { MCPTool } from '@/features/routing-tools/types';

interface ToolExpandedRowProps {
  tool: MCPTool;
  onAddDependency?: (toolName: string, depName: string) => void;
  onRemoveDependency?: (toolName: string, depName: string) => void;
  onOpenDepPopover: (toolId: string) => void;
  onCloseDepPopover: () => void;
  depPopoverOpenFor: string | null;
  depSearch: string;
  onDepSearchChange: (v: string) => void;
  getFilteredCandidates: (tool: MCPTool) => MCPTool[];
}

export function ToolExpandedRow({
  tool,
  onAddDependency,
  onRemoveDependency,
  onOpenDepPopover,
  onCloseDepPopover,
  depPopoverOpenFor,
  depSearch,
  onDepSearchChange,
  getFilteredCandidates,
}: ToolExpandedRowProps) {
  const deps = tool.dependencies ?? [];
  const confirmation = tool.confirmation;
  const confirmationMessage = confirmation?.resolvedMessage ?? confirmation?.message;

  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-card/50 p-0">
        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest">
                Dependencies
              </span>
              {onAddDependency && (
                <ToolDependencyEditor
                  tool={tool}
                  openFor={depPopoverOpenFor}
                  depSearch={depSearch}
                  onDepSearchChange={onDepSearchChange}
                  onOpen={onOpenDepPopover}
                  onClose={onCloseDepPopover}
                  onAddDependency={onAddDependency}
                  getFilteredCandidates={getFilteredCandidates}
                />
              )}
            </div>

            {deps.length === 0 ? (
              <p className="text-sm text-txt-muted">No dependencies configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {deps.map((dep) => (
                  <div
                    key={dep}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5"
                  >
                    <Wrench className="h-3 w-3 text-status-yellow" />
                    <span className="text-sm font-mono text-txt-primary">{dep}</span>
                    {onRemoveDependency && (
                      <button
                        className="ml-1 text-txt-muted hover:text-status-red transition-colors"
                        onClick={() => onRemoveDependency(tool.name, dep)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest block mb-2">
              Parameters
            </span>
            <ToolParameterList params={tool.parameters} />
          </div>

          {confirmation && (
            <div>
              <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest block mb-2">
                Confirmation
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={confirmation.level === 'danger' ? 'destructive' : confirmation.level === 'warning' ? 'warning' : 'outline'}
                  className="rounded-md font-mono text-xs"
                >
                  {confirmation.level ?? 'notice'}
                </Badge>
                {confirmationMessage && (
                  <span
                    className="text-sm text-txt-secondary"
                    title={confirmation?.message !== confirmationMessage ? confirmation?.message : undefined}
                  >
                    {confirmationMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
