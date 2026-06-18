import { useState } from 'react';
import type { MCPTool } from '@/features/routing-tools/types';

interface UseToolDependencyPopoverOptions {
  tools: MCPTool[];
  onAddDependency?: (toolId: string, depName: string) => void;
}

export function useToolDependencyPopover({ tools, onAddDependency }: UseToolDependencyPopoverOptions) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [depSearch, setDepSearch] = useState('');

  const getDepCandidates = (tool: MCPTool) => {
    const deps = tool.dependencies ?? [];
    const safe = Array.isArray(tools) ? tools : [];
    return safe.filter((t) => t.name !== tool.name && !deps.includes(t.name));
  };

  const getFilteredCandidates = (tool: MCPTool) => {
    const candidates = getDepCandidates(tool);
    if (!depSearch) return candidates;
    const q = depSearch.toLowerCase();
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  };

  const open = (toolId: string) => {
    setOpenFor(toolId);
    setDepSearch('');
  };

  const close = () => {
    setOpenFor(null);
    setDepSearch('');
  };

  const addDependency = (toolName: string, depName: string) => {
    onAddDependency?.(toolName, depName);
    close();
  };

  return {
    openFor,
    depSearch,
    setDepSearch,
    open,
    close,
    addDependency,
    getDepCandidates,
    getFilteredCandidates,
  };
}
