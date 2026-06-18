import React, { useCallback, useEffect, useState } from 'react';
import { RoutingLab } from './RoutingLab';
import { SemanticBanner } from '@/features/routing-semantics/components/SemanticBanner';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { useApiClient } from '@/lib/api';
import { useBanner } from '@/shared/hooks/useBanner';
import { useLocalStorageState } from 'najm-kit';
import { NErrorBoundary } from 'najm-kit';
import { useCrossFeatureDrafts } from '@/features/chat/hooks/useCrossFeatureDrafts';
import type { RoutingPreviewResult, JsonViewColors } from '@/features/routing-lab/types';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';
import type { PendingRoutingLabQuery } from '@/lib/chatDraftsContext';

interface LabViewProps {
  onViewContextChange?: (context: Record<string, unknown>) => void;
}

export function LabView({ onViewContextChange }: LabViewProps) {
  const apiClient = useApiClient();
  const { banner, showBanner, dismissBanner } = useBanner();
  const { consumeLabQuery } = useCrossFeatureDrafts(() => {});
  const [consumedLabQuery, setConsumedLabQuery] = useState<PendingRoutingLabQuery | null>(null);

  const [jsonViewColors, setJsonViewColors] = useLocalStorageState<JsonViewColors>(
    'najm-rag-studio:jsonViewColors',
    defaultJsonViewColors,
  );

  const [settingsOpen, setSettingsOpen] = useLocalStorageState<boolean>(
    'najm-rag-studio:settingsOpen',
    false,
  );

  const handlePreview = useCallback(async (query: string): Promise<RoutingPreviewResult> => {
    return apiClient.post<RoutingPreviewResult>('/routing/preview', { query });
  }, [apiClient]);

  useEffect(() => {
    const draft = consumeLabQuery();
    if (draft) setConsumedLabQuery(draft);
  }, [consumeLabQuery]);

  useEffect(() => {
    onViewContextChange?.({ view: 'lab' });
  }, [onViewContextChange]);

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
          <RoutingLab onPreview={handlePreview} pendingQuery={consumedLabQuery} />
        </NErrorBoundary>
      </div>
    </div>
  );
}
