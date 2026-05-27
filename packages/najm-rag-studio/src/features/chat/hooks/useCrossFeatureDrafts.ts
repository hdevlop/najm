import { useCallback } from 'react';
import { useChatDraftsContext } from '@/lib/chatDraftsContext';
import type { PendingRoutingLabQuery, PendingTestDraft, PendingSemanticDraft } from '@/lib/chatDraftsContext';

export type { PendingRoutingLabQuery, PendingTestDraft, PendingSemanticDraft };

export function useCrossFeatureDrafts(onNavigate: (workspace: string) => void) {
  const { pendingLabQuery, pendingTestDraft, pendingSemanticDraft, setPendingLabQuery, setPendingTestDraft, setPendingSemanticDraft } = useChatDraftsContext();

  const openInLab = useCallback((query: string) => {
    setPendingLabQuery({ query, autoRun: true });
    onNavigate('routing-lab');
  }, [onNavigate, setPendingLabQuery]);

  const createTest = useCallback((query: string, expectedTools: string[]) => {
    setPendingTestDraft({ query, expectedTools });
    onNavigate('routing-tests');
  }, [onNavigate, setPendingTestDraft]);

  const createSemanticPhrase = useCallback((toolName: string, phrase: string) => {
    setPendingSemanticDraft({ toolName, phrase });
    onNavigate('routing-semantics');
  }, [onNavigate, setPendingSemanticDraft]);

  const consumeLabQuery = useCallback(() => {
    const q = pendingLabQuery;
    setPendingLabQuery(null);
    return q;
  }, [pendingLabQuery, setPendingLabQuery]);

  const consumeTestDraft = useCallback(() => {
    const d = pendingTestDraft;
    setPendingTestDraft(null);
    return d;
  }, [pendingTestDraft, setPendingTestDraft]);

  const consumeSemanticDraft = useCallback(() => {
    const d = pendingSemanticDraft;
    setPendingSemanticDraft(null);
    return d;
  }, [pendingSemanticDraft, setPendingSemanticDraft]);

  return {
    pendingLabQuery,
    pendingTestDraft,
    pendingSemanticDraft,
    openInLab,
    createTest,
    createSemanticPhrase,
    consumeLabQuery,
    consumeTestDraft,
    consumeSemanticDraft,
  };
}
