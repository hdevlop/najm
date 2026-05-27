import React, { useEffect, useState } from 'react';
import { TestRunner } from './TestRunner';
import { SemanticBanner } from '@/features/routing-semantics/components/SemanticBanner';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { useToolsWorkspace } from '@/features/routing-tools/hooks/useToolsWorkspace';
import { useBanner } from '@/shared/hooks/useBanner';
import { useLocalStorageState } from 'najm-ui';
import { NErrorBoundary } from 'najm-ui';
import { useCrossFeatureDrafts } from '@/features/chat/hooks/useCrossFeatureDrafts';
import type { JsonViewColors } from '@/features/routing-tests/types';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';
import type { PendingTestDraft } from '@/lib/chatDraftsContext';

interface TestsViewProps {
  onViewContextChange?: (context: Record<string, unknown>) => void;
  resetNonce?: number;
}

export function TestsView({ onViewContextChange, resetNonce }: TestsViewProps) {
  const { banner, showBanner, dismissBanner } = useBanner();
  const { consumeTestDraft } = useCrossFeatureDrafts(() => {});
  const [consumedTestDraft, setConsumedTestDraft] = useState<PendingTestDraft | null>(null);

  const [jsonViewColors, setJsonViewColors] = useLocalStorageState<JsonViewColors>(
    'najm-rag-studio:jsonViewColors',
    defaultJsonViewColors,
  );

  const [settingsOpen, setSettingsOpen] = useLocalStorageState<boolean>(
    'najm-rag-studio:settingsOpen',
    false,
  );

  const { visibleTools, toolGroupByName } = useToolsWorkspace((msg) => showBanner('error', msg));

  useEffect(() => {
    const draft = consumeTestDraft();
    if (draft) setConsumedTestDraft(draft);
  }, [consumeTestDraft]);

  useEffect(() => {
    onViewContextChange?.({ view: 'routing-tests' });
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
          <TestRunner
            availableTools={visibleTools}
            toolGroupByName={toolGroupByName}
            jsonViewColors={jsonViewColors}
            pendingDraft={consumedTestDraft}
            resetNonce={resetNonce}
          />
        </NErrorBoundary>
      </div>
    </div>
  );
}
