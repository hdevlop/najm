import React from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Badge } from 'najm-kit';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from 'najm-kit';
import { ScrollArea } from 'najm-kit';
import { Separator } from 'najm-kit';
import { ToolParameterList } from './ToolParameterList';
import { ToolDependencyEditor } from './ToolDependencyEditor';
import type { MCPTool } from '@/features/routing-tools/types';

interface ToolDetailSheetProps {
  tool: MCPTool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddDependency?: (toolName: string, depName: string) => void;
  onRemoveDependency?: (toolName: string, depName: string) => void;
  depPopoverOpenFor: string | null;
  depSearch: string;
  onDepSearchChange: (v: string) => void;
  onOpenDepPopover: (toolId: string) => void;
  onCloseDepPopover: () => void;
  getFilteredCandidates: (tool: MCPTool) => MCPTool[];
}

export function ToolDetailSheet({
  tool,
  open,
  onOpenChange,
  onAddDependency,
  onRemoveDependency,
  depPopoverOpenFor,
  depSearch,
  onDepSearchChange,
  onOpenDepPopover,
  onCloseDepPopover,
  getFilteredCandidates,
}: ToolDetailSheetProps) {
  if (!tool) return null;

  const deps = tool.dependencies ?? [];
  const confirmation = tool.confirmation;
  const confirmationMessage = confirmation?.resolvedMessage ?? confirmation?.message;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-sidebar">
        <SheetHeader className="px-6 pt-6 pb-2 text-left space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand shrink-0" />
            <SheetTitle className="text-base font-semibold font-mono text-txt-primary">
              {tool.name}
            </SheetTitle>
          </div>
          {tool.description && (
            <SheetDescription className="text-sm text-txt-secondary leading-relaxed">
              {tool.description}
            </SheetDescription>
          )}
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Dependencies */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-[0.18em]">
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
                      className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5"
                    >
                      <Link2 className="h-3 w-3 text-status-yellow shrink-0" />
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

            <Separator />

            {/* Parameters */}
            <div>
              <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-[0.18em] block mb-3">
                Parameters
              </span>
              <ToolParameterList params={tool.parameters} />
            </div>

            {/* Confirmation */}
            {confirmation && (
              <>
                <Separator />
                <div>
                  <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-[0.18em] block mb-3">
                    Confirmation
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        confirmation.level === 'danger'
                          ? 'destructive'
                          : confirmation.level === 'warning'
                            ? 'warning'
                            : 'outline'
                      }
                      className="rounded-md font-mono text-xs"
                    >
                      {confirmation.level ?? 'notice'}
                    </Badge>
                    {confirmationMessage && (
                      <span className="text-sm text-txt-secondary">{confirmationMessage}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
