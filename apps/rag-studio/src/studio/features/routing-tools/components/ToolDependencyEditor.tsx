import React, { useRef } from 'react';
import { Button } from 'najm-kit';
import { Input } from 'najm-kit';
import { Plus, Wrench } from 'lucide-react';
import { useClickOutside } from 'najm-kit';
import type { MCPTool } from '@/features/routing-tools/types';

interface ToolDependencyEditorProps {
  tool: MCPTool;
  openFor: string | null;
  depSearch: string;
  onDepSearchChange: (v: string) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onAddDependency: (toolName: string, depName: string) => void;
  getFilteredCandidates: (tool: MCPTool) => MCPTool[];
}

export function ToolDependencyEditor({
  tool,
  openFor,
  depSearch,
  onDepSearchChange,
  onOpen,
  onClose,
  onAddDependency,
  getFilteredCandidates,
}: ToolDependencyEditorProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const isOpen = openFor === tool.id;

  useClickOutside(popoverRef, {
    enabled: isOpen,
    onClickOutside: onClose,
  });

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="default"
        className="h-8 gap-1.5 rounded-md bg-brand/20 px-3 text-brand shadow-none hover:bg-brand/25"
        onClick={() => (isOpen ? onClose() : onOpen(tool.id))}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Dep
      </Button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg shadow-card"
        >
          <div className="p-2">
            <Input
              placeholder="Search tools…"
              value={depSearch}
              onChange={(e) => onDepSearchChange(e.target.value)}
              className="bg-card"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-auto">
            {getFilteredCandidates(tool).map((candidate) => (
              <button
                key={candidate.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-txt-primary hover:bg-surface transition-colors"
                onClick={() => {
                  onAddDependency(tool.name, candidate.name);
                  onClose();
                }}
              >
                <Wrench className="h-3.5 w-3.5 text-txt-muted" />
                <span className="font-mono truncate">{candidate.name}</span>
              </button>
            ))}
            {getFilteredCandidates(tool).length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-txt-muted">No tools available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
