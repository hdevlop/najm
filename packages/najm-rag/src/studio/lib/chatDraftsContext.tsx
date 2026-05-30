import React, { createContext, useContext, useState, useCallback } from 'react';

export interface PendingRoutingLabQuery {
  query: string;
  autoRun: boolean;
}

export interface PendingTestDraft {
  query: string;
  expectedTools: string[];
}

export interface PendingSemanticDraft {
  toolName: string;
  phrase: string;
}

interface ChatDraftsState {
  pendingLabQuery: PendingRoutingLabQuery | null;
  pendingTestDraft: PendingTestDraft | null;
  pendingSemanticDraft: PendingSemanticDraft | null;
  setPendingLabQuery: (q: PendingRoutingLabQuery | null) => void;
  setPendingTestDraft: (d: PendingTestDraft | null) => void;
  setPendingSemanticDraft: (d: PendingSemanticDraft | null) => void;
}

const ChatDraftsContext = createContext<ChatDraftsState>({
  pendingLabQuery: null,
  pendingTestDraft: null,
  pendingSemanticDraft: null,
  setPendingLabQuery: () => {},
  setPendingTestDraft: () => {},
  setPendingSemanticDraft: () => {},
});

export function ChatDraftsProvider({ children }: { children: React.ReactNode }) {
  const [pendingLabQuery, setPendingLabQuery] = useState<PendingRoutingLabQuery | null>(null);
  const [pendingTestDraft, setPendingTestDraft] = useState<PendingTestDraft | null>(null);
  const [pendingSemanticDraft, setPendingSemanticDraft] = useState<PendingSemanticDraft | null>(null);

  const value = React.useMemo(() => ({
    pendingLabQuery,
    pendingTestDraft,
    pendingSemanticDraft,
    setPendingLabQuery,
    setPendingTestDraft,
    setPendingSemanticDraft,
  }), [pendingLabQuery, pendingTestDraft, pendingSemanticDraft]);

  return (
    <ChatDraftsContext.Provider value={value}>
      {children}
    </ChatDraftsContext.Provider>
  );
}

export function useChatDraftsContext() {
  return useContext(ChatDraftsContext);
}
