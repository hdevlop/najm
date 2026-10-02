import React, { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import type { MCPTool } from '@/features/routing-tools/types';
import { normalizeDependencyImport } from '../utils/dependency-import';

export const TOOLS_KEY = ['rag-studio', 'routing', 'tools'] as const;

export function useToolsWorkspace(onError?: (message: string) => void) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const reportError = (message: string, err: unknown) => {
    console.error(message, err);
    onError?.(message);
  };

  const query = useQuery({
    queryKey: TOOLS_KEY,
    queryFn: async () => {
      try {
        return await apiClient.get<MCPTool[]>('/tools/list');
      } catch (err) {
        reportError('Failed to load tools.', err);
        throw err;
      }
    },
  });

  const tools = query.data ?? [];

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
  }, [queryClient]);

  const handleReindexTool = async (id: string) => {
    try {
      await apiClient.post(`/tools/reindex`, { ids: [id] });
      await invalidate();
    } catch (err) {
      reportError('Failed to reindex tool.', err);
    }
  };

  const handleReindexAll = async () => {
    try {
      await apiClient.post('/tools/reindex');
      await invalidate();
    } catch (err) {
      reportError('Failed to reindex all tools.', err);
    }
  };

  const handleAddDependency = async (toolName: string, depName: string) => {
    try {
      await apiClient.post(`/tools/${encodeURIComponent(toolName)}/dependencies`, { dependency: depName });
      await invalidate();
    } catch (err) {
      reportError('Failed to add dependency.', err);
    }
  };

  const handleRemoveDependency = async (toolName: string, depName: string) => {
    try {
      await apiClient.delete(`/tools/${encodeURIComponent(toolName)}/dependencies/${encodeURIComponent(depName)}`);
      await invalidate();
    } catch (err) {
      reportError('Failed to remove dependency.', err);
    }
  };

  const handleExportTools = (visibleTools: MCPTool[] = tools) => {
    const payload = {
      format: 'najm-rag-tool-dependency-source',
      exportedCount: visibleTools.length,
      totalCount: tools.length,
      instructions: 'Generate JSON as { "dependencies": { "tool_name": ["dependency_tool_name"] }. Use only tool names present in tools[].name. Do not include self-dependencies.',
      tools: visibleTools.map((tool) => ({
        name: tool.name,
        group: tool.group,
        description: tool.description,
        parameters: tool.parameters ?? [],
        existingDependencies: tool.dependencies ?? [],
        confirmation: tool.confirmation,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = visibleTools.length === tools.length ? 'mcp_tools_dependency_source.json' : 'mcp_tools_filtered_dependency_source.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportDependencies = async (file: File) => {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const dependencies = normalizeDependencyImport(parsed, tools);
      await apiClient.patch('/settings', { dependencies });
      await invalidate();
    } catch (err) {
      reportError('Failed to import dependencies.', err);
      throw err;
    }
  };

  const toolGroups = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of tools) {
      const group = tool.group || 'default';
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, total]) => ({ value, label: value, total }));
  }, [tools]);

  const toolGroupByName = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const tool of tools) {
      map[tool.name] = tool.group || 'default';
    }
    return map;
  }, [tools]);

  const visibleTools = React.useMemo(() => tools.map((tool) => tool.name), [tools]);

  return {
    tools,
    loading: query.isFetching,
    availableTools: tools.map((t) => t.name),
    toolGroups,
    toolGroupByName,
    visibleTools,
    loadTools: invalidate,
    handleReindexTool,
    handleReindexAll,
    handleAddDependency,
    handleRemoveDependency,
    handleExportTools,
    handleImportDependencies,
  };
}
