import React from 'react';
import { SemanticsBucket } from './SemanticsBucket';
import { TestsBucket } from './TestsBucket';
import type { Workspace, StorageView } from '@/shared/hooks/useWorkspace';

interface StorageWorkspaceProps {
  view: StorageView;
  onNavigate: (workspace: Workspace) => void;
}

export function StorageWorkspace({ view }: StorageWorkspaceProps) {
  if (view === 'semantics') return <SemanticsBucket />;
  return <TestsBucket />;
}
