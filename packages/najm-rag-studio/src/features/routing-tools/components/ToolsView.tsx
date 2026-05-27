import React from 'react';
import { ToolList } from './ToolList';
import { SemanticBanner } from '@/features/routing-semantics/components/SemanticBanner';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { useToolsWorkspace } from '../hooks/useToolsWorkspace';
import { useBanner } from '@/shared/hooks/useBanner';
import { useLocalStorageState } from 'najm-ui';
import { NErrorBoundary } from 'najm-ui';
import type { JsonViewColors, ToolsViewMode } from '@/features/routing-tools/types';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';

interface ToolsViewProps {
  onViewContextChange?: (context: Record<string, unknown>) => void;
}

export function ToolsView({ onViewContextChange }: ToolsViewProps) {
  const { banner, showBanner, dismissBanner } = useBanner();

  const [jsonViewColors, setJsonViewColors] = useLocalStorageState<JsonViewColors>(
    'najm-rag-studio:jsonViewColors',
    defaultJsonViewColors,
  );
  const [toolsViewMode, setToolsViewMode] = useLocalStorageState<ToolsViewMode>(
    'najm-rag-studio:toolsViewMode',
    'table',
  );

  const [settingsOpen, setSettingsOpen] = useLocalStorageState<boolean>(
    'najm-rag-studio:settingsOpen',
    false,
  );

  const {
    tools,
    loading: toolsLoading,
    toolGroups,
    toolGroupByName,
    visibleTools,
    handleReindexTool,
    handleReindexAll,
    handleAddDependency,
    handleRemoveDependency,
    handleExportTools,
    handleImportDependencies,
  } = useToolsWorkspace((msg) => showBanner('error', msg));

  React.useEffect(() => {
    onViewContextChange?.({ view: 'routing-tools', toolCount: tools.length });
  }, [tools.length, onViewContextChange]);

  return (
    <div className="flex flex-col h-full">
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        jsonViewColors={jsonViewColors}
        onJsonViewColorsChange={setJsonViewColors}
      />
      <div className="shrink-0">
        <SemanticBanner banner={banner} onDismiss={dismissBanner} />
      </div>
      <div className="flex-1 overflow-hidden">
        <NErrorBoundary fallbackTitle="Routing view error">
          <ToolList
            tools={tools}
            loading={toolsLoading}
            onReindex={handleReindexTool}
            onReindexAll={handleReindexAll}
            onAddDependency={handleAddDependency}
            onRemoveDependency={handleRemoveDependency}
            onExportTools={handleExportTools}
            onImportDependencies={handleImportDependencies}
            viewMode={toolsViewMode}
            onViewModeChange={setToolsViewMode}
            jsonViewColors={jsonViewColors}
          />
        </NErrorBoundary>
      </div>
    </div>
  );
}
