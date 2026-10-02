import React from 'react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'najm-kit';
import { Plus, Wrench } from 'lucide-react';
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
  const isOpen = openFor === tool.id;

  return (
    <Popover open={isOpen} onOpenChange={(open) => (open ? onOpen(tool.id) : onClose())}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1.5 rounded-md bg-brand/20 px-3 text-brand shadow-none hover:bg-brand/25"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Dep
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {/* Filtering stays with the caller (getFilteredCandidates), so cmdk's own filter is off. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search tools…" value={depSearch} onValueChange={onDepSearchChange} />
          <CommandList className="max-h-48">
            <CommandEmpty>No tools available</CommandEmpty>
            {getFilteredCandidates(tool).map((candidate) => (
              <CommandItem
                key={candidate.id}
                value={candidate.name}
                onSelect={() => {
                  onAddDependency(tool.name, candidate.name);
                  onClose();
                }}
              >
                <Wrench className="h-3.5 w-3.5 text-txt-muted" />
                <span className="truncate font-mono">{candidate.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
