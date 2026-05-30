import { useMemo } from 'react';
import type { MCPTool } from '@/features/routing-tools/types';

interface UseToolFiltersOptions {
  tools: MCPTool[];
  search: string;
  groupFilter: string;
  confirmationFilter: string;
}

export function useToolFilters({ tools, search, groupFilter, confirmationFilter }: UseToolFiltersOptions) {
  const safeTools = useMemo(() => (Array.isArray(tools) ? tools : []), [tools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return safeTools.filter((tool) => {
      const group = tool.group || 'default';
      const confirmation = tool.confirmation?.level ?? 'none';
      const matchesSearch = !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        group.toLowerCase().includes(q);
      const matchesGroup = !groupFilter || group === groupFilter;
      const matchesConfirmation = !confirmationFilter || confirmation === confirmationFilter;

      return matchesSearch && matchesGroup && matchesConfirmation;
    });
  }, [safeTools, search, groupFilter, confirmationFilter]);

  const toolGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of safeTools) {
      const group = tool.group || 'default';
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, total]) => ({ value, label: value, total }));
  }, [safeTools]);

  const confirmationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of safeTools) {
      const confirmation = tool.confirmation?.level ?? 'none';
      counts.set(confirmation, (counts.get(confirmation) ?? 0) + 1);
    }

    const order = ['none', 'notice', 'warning', 'danger'];
    const labelByValue: Record<string, string> = {
      none: 'No confirmation',
      notice: 'Notice',
      warning: 'Warning',
      danger: 'Danger',
    };

    return [...counts.entries()]
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([value, total]) => ({ value, label: labelByValue[value] ?? value, total }));
  }, [safeTools]);

  return { safeTools, filtered, toolGroups, confirmationOptions };
}
