import React from 'react';
import { KnowledgeWorkspace } from '@/features/knowledge';
import { LabView } from '@/features/routing-lab';
import { SemanticsView } from '@/features/routing-semantics';
import { TestsView } from '@/features/routing-tests';
import { ToolsView } from '@/features/routing-tools';
import { UnmatchedInbox, LogsWorkspace } from '@/features/logs';
import { Dashboard } from '@/features/dashboard';
import { StudioChat } from '@/features/chat';
import type { Workspace, KnowledgeView } from '@/shared/hooks/useWorkspace';
import type { MCPTool, UnmatchedQuery } from '@/features/logs/types';

interface Props {
  activeWorkspace: Workspace;
  setActiveWorkspace: (w: Workspace) => void;
  workspaceResetNonce?: number;
  enableKnowledge: boolean;
  onViewContextChange: (ctx: Record<string, unknown>) => void;
  onCitationClick: (chunkId: string, documentId: string) => void;
  onOpenSettings: () => void;
  unmatched: {
    items: UnmatchedQuery[];
    tools: MCPTool[];
    loading: boolean;
    onRefresh: () => void;
    onMap: (id: string, toolName: string) => Promise<void>;
    onDiscard: (id: string) => Promise<void>;
  };
}

export function WorkspaceRouter(props: Props) {
  const {
    activeWorkspace, setActiveWorkspace, workspaceResetNonce, enableKnowledge,
    onViewContextChange, onCitationClick, onOpenSettings, unmatched,
  } = props;

  if (activeWorkspace === 'dashboard') {
    return <Dashboard onNavigate={setActiveWorkspace} />;
  }
  if (activeWorkspace.startsWith('knowledge-')) {
    if (!enableKnowledge) {
      return <RoutingWorkspace view="lab" onViewContextChange={onViewContextChange} />;
    }
    const view = activeWorkspace.slice('knowledge-'.length) as KnowledgeView;
    return <KnowledgeWorkspace view={view} onCitationClick={onCitationClick} onViewContextChange={onViewContextChange} />;
  }
  if (activeWorkspace === 'routing-tools') {
    return <ToolsView onViewContextChange={onViewContextChange} />;
  }
  if (activeWorkspace === 'routing-semantics') {
    return <SemanticsView onViewContextChange={onViewContextChange} resetNonce={workspaceResetNonce} />;
  }
  if (activeWorkspace === 'routing-lab') {
    return <LabView onViewContextChange={onViewContextChange} />;
  }
  if (activeWorkspace === 'routing-tests') {
    return <TestsView onViewContextChange={onViewContextChange} resetNonce={workspaceResetNonce} />;
  }
  if (activeWorkspace === 'chat') {
    return <StudioChat onNavigate={setActiveWorkspace} onOpenSettings={onOpenSettings} />;
  }
  if (activeWorkspace === 'logs') {
    return <LogsWorkspace />;
  }
  if (activeWorkspace === 'logs-unmatched') {
    return (
      <UnmatchedInbox
        items={unmatched.items}
        tools={unmatched.tools}
        loading={unmatched.loading}
        onRefresh={unmatched.onRefresh}
        onMap={unmatched.onMap}
        onDiscard={unmatched.onDiscard}
      />
    );
  }
  return <KnowledgeWorkspace view="documents" onCitationClick={onCitationClick} onViewContextChange={onViewContextChange} />;
}
