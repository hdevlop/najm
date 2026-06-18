import React, { useState } from 'react';
import { RefreshCw, Download, Wrench } from 'lucide-react';
import {
  Button,
  NTable,
  NPageHeader,
  FileImportButton,
  NEmptyState,
} from 'najm-kit';
import { ToolDetailSheet } from './ToolDetailSheet';
import { ToolFilters } from './ToolFilters';
import { ToolCard } from './ToolCard';
import { toolColumns } from './columns';
import { useToolFilters } from '../hooks/useToolFilters';
import { useToolDependencyPopover } from '../hooks/useToolDependencyPopover';
import type { MCPTool, ToolsViewMode, JsonViewColors } from '@/features/routing-tools/types';

interface ToolListProps {
  tools: MCPTool[];
  loading: boolean;
  onReindex: (id: string) => void;
  onReindexAll?: () => void;
  onAddDependency?: (toolId: string, depName: string) => void;
  onRemoveDependency?: (toolId: string, depName: string) => void;
  onExportTools?: (visibleTools: MCPTool[]) => void;
  onImportDependencies?: (file: File) => Promise<void>;
  viewMode?: ToolsViewMode;
  onViewModeChange?: (mode: ToolsViewMode) => void;
  jsonViewColors?: JsonViewColors;
}

export function ToolList({
  tools,
  loading,
  onReindex,
  onReindexAll,
  onAddDependency,
  onRemoveDependency,
  onExportTools,
  onImportDependencies,
  viewMode = 'table',
  onViewModeChange,
  jsonViewColors,
}: ToolListProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [confirmationFilter, setConfirmationFilter] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  const { safeTools, filtered, toolGroups, confirmationOptions } = useToolFilters({
    tools,
    search,
    groupFilter,
    confirmationFilter,
  });

  const {
    openFor,
    depSearch,
    setDepSearch,
    open,
    close,
    addDependency,
    getFilteredCandidates,
  } = useToolDependencyPopover({ tools: safeTools, onAddDependency });

  const selectedTool = filtered.find((t) => t.id === selectedToolId) ?? null;

  const subtitle = `${safeTools.length} registered tool${safeTools.length !== 1 ? 's' : ''}`;
  const hasTools = safeTools.length > 0;
  const showToolbar = hasTools && !!onViewModeChange;

  return (
    <>
      <NPageHeader
        icon={Wrench}
        title="MCP Tools"
        subtitle={subtitle}
        actions={
          <>
            {onImportDependencies && (
              <FileImportButton
                accept="application/json,.json"
                onFile={(file) => onImportDependencies?.(file)}
              >
                <span className="hidden sm:inline">Import Deps</span>
              </FileImportButton>
            )}
            {onExportTools && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onExportTools(filtered)}
                disabled={filtered.length === 0}
                className="gap-1.5 px-2"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export Visible</span>
              </Button>
            )}
            <Button variant="outline" onClick={onReindexAll} disabled={!onReindexAll} className="gap-1.5 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reindex All</span>
            </Button>
          </>
        }
      />
      <div className={viewMode === 'json' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-auto'}>
        <NTable<MCPTool, 'table' | 'json'>
          data={filtered}
          columns={toolColumns}
          getRowId={(tool) => tool.id}
          renderCard={ToolCard}
          responsiveCards
          availableModes={['table', 'json'] as const}
          mode={viewMode}
          onModeChange={onViewModeChange}
          jsonValue={filtered}
          jsonColors={jsonViewColors}
          loading={loading && !hasTools}
          showViewToggle={!!onViewModeChange}
          isEmpty={!hasTools}
          isFilteredEmpty={hasTools && filtered.length === 0}
          selectedRowId={selectedToolId}
          onRowClick={(tool) => setSelectedToolId(tool.id)}
          renderEmpty={() => (
            <NEmptyState icon={Wrench} title="No MCP tools registered" />
          )}
          renderFilteredEmpty={() => (
            <NEmptyState
              icon={Wrench}
              title="No tools match your filters"
              description="Try adjusting your search."
            />
          )}
          renderToolbar={
            showToolbar
              ? () => (
                  <ToolFilters
                    search={search}
                    onSearchChange={setSearch}
                    groupFilter={groupFilter}
                    onGroupFilterChange={setGroupFilter}
                    confirmationFilter={confirmationFilter}
                    onConfirmationFilterChange={setConfirmationFilter}
                    toolGroups={toolGroups}
                    confirmationOptions={confirmationOptions}
                  />
                )
              : undefined
          }
        />
      </div>

      <ToolDetailSheet
        tool={selectedTool}
        open={!!selectedToolId}
        onOpenChange={(open) => {
          if (!open) setSelectedToolId(null);
        }}
        onAddDependency={addDependency}
        onRemoveDependency={onRemoveDependency}
        depPopoverOpenFor={openFor}
        depSearch={depSearch}
        onDepSearchChange={setDepSearch}
        onOpenDepPopover={open}
        onCloseDepPopover={close}
        getFilteredCandidates={getFilteredCandidates}
      />
    </>
  );
}
